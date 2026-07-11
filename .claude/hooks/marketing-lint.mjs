#!/usr/bin/env node
/**
 * PostToolUse lint for the marketing layer — the deterministic half of the
 * quality system (the PreToolUse guard reminds BEFORE writing; this checks
 * the RESULT after every Write/Edit, Lovable-style "adherence enforcement").
 *
 * Hard violations (token bypasses, library bypasses) come back as a blocking
 * reason so the agent fixes them immediately; heuristic findings (possible
 * hardcoded copy, unregistered routes) come back as advisory context.
 *
 * Cross-platform: pure Node (present in every derived project), no shell.
 * It must NEVER crash a tool call: any internal error exits silently.
 */

import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const LINTABLE = /\.(tsx|ts|jsx|js|css)$/;

/** Tailwind's default palette — off-system here (tokens use primary/secondary/accent-N/grey). */
const TW_DEFAULT_PALETTE =
  /(?:^|[\s"'`:])(?:bg|text|border|from|to|via|fill|stroke|ring|decoration|outline|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

/** Arbitrary values on spacing/size/type/color utilities, unless they reference a token var. */
const ARBITRARY_UTILITY =
  /(?:^|[\s"'`:])-?(?:(?:p|m)(?:x|y|t|b|l|r|s|e)?|gap(?:-[xy])?|space-[xy]|text|leading|tracking|w|h|size|max-w|min-w|max-h|min-h|top|left|right|bottom|inset(?:-x|-y)?|rounded(?:-\w+)?|bg|border(?:-[a-z]+)?|shadow|ring)-\[(?!var\(--)([^\]]*)\]/;

/** Values that are layout facts, not stealth design tokens (pure viewport units, var()-based calc). */
const ARBITRARY_ALLOWED = /^(?:\d+(?:\.\d+)?(?:d|s|l)?v[hw]|calc\(.*var\(--.*\))$/;

const RAW_HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/;
const RAW_COLOR_FN = /\b(?:rgba?|oklch)\s*\(/;
const RAW_HSL = /\bhsla?\(\s*(?!var\()/;
const ICON_LIB_IMPORT =
  /from\s+["'](?:@phosphor-icons\/|lucide-react|react-icons|@tabler\/icons|@mui\/icons-material)/;
/** JSX text node with 3+ words and no expression — likely copy that belongs in i18n. */
const JSX_TEXT = />\s*([A-Za-zÀ-ÿ][^<>{}]*?\s+\S+\s+\S+[^<>{}]*?)\s*</;
const ATTR_TEXT = /\b(?:alt|aria-label|placeholder)=["'][A-Za-zÀ-ÿ][^"']+["']/;

function lint(filePath, content) {
  const p = filePath.replace(/\\/g, "/");
  const isPage = /\/app\/\(marketing\)\//.test(p);
  const file = basename(p);
  const violations = [];
  const advisories = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, i) => {
    const at = `line ${i + 1}`;
    if (RAW_HEX.test(line))
      violations.push(`[raw-color] ${at}: hex literal — colors come from tokens (hsl(var(--token)) / token Tailwind classes).`);
    if (RAW_COLOR_FN.test(line))
      violations.push(`[raw-color] ${at}: rgb()/oklch() literal — use hsl(var(--token)).`);
    if (RAW_HSL.test(line))
      violations.push(`[raw-color] ${at}: hsl() with raw values — only hsl(var(--token) / alpha) is allowed.`);
    if (TW_DEFAULT_PALETTE.test(line))
      violations.push(`[raw-color] ${at}: Tailwind default-palette class — use the token classes (primary/secondary/accent-1..4/grey-*).`);
    const arb = line.match(ARBITRARY_UTILITY);
    if (arb && !ARBITRARY_ALLOWED.test(arb[1]))
      violations.push(`[arbitrary-value] ${at}: "${arb[0].trim()}" — spacing/size/type come from the marketing tokens or the fluid display scale (text-display-*), never per-page arbitrary values.`);
    if (ICON_LIB_IMPORT.test(line))
      violations.push(`[icon-import] ${at}: direct icon-library import — marketing imports icons only via @/icons/nexture/ni-* (see .claude/rules/icons.md).`);
    if (isPage) {
      const text = line.match(JSX_TEXT);
      if (text)
        advisories.push(`[hardcoded-copy?] ${at}: JSX text "${text[1].slice(0, 60)}" — marketing copy goes through the marketing i18n namespace in ALL 5 locales.`);
      if (ATTR_TEXT.test(line))
        advisories.push(`[hardcoded-copy?] ${at}: literal alt/aria-label/placeholder — translate it via the marketing namespace.`);
    }
  });

  if (/from\s+["']@?gsap/.test(content) && !/^\s*["']use client["']/m.test(content))
    violations.push(`[gsap-server] GSAP imported without "use client" — GSAP lives only in marketing client components (Reveal/useGSAP).`);

  if (file !== "json-ld.tsx" && /application\/ld\+json/.test(content))
    violations.push(`[seo-jsonld] hand-written ld+json script — structured data goes through <JsonLd> (components/marketing/json-ld.tsx) per docs/SEO.md.`);

  if (isPage && file === "page.tsx" && !content.includes("@/components/marketing/"))
    violations.push(`[library-bypass] marketing page without a single @/components/marketing/* import — pages compose Section/SectionHeader and the archetypes, never raw layout.`);

  // New public route → must be registered in PUBLIC_PREFIXES and the sitemap.
  if (isPage && file === "page.tsx" && p.includes("/src/app/(marketing)/")) {
    const route = routeFromPath(p);
    if (route) {
      const webRoot = p.slice(0, p.indexOf("/src/app/(marketing)/"));
      const prefix = "/" + route.split("/")[0];
      const middleware = tryRead(join(webRoot, "src", "middleware.ts"));
      const sitemap = tryRead(join(webRoot, "src", "app", "sitemap.ts"));
      if (middleware && !middleware.includes(`"${prefix}"`) && !middleware.includes(`'${prefix}'`))
        advisories.push(`[route] ${prefix} not found in PUBLIC_PREFIXES (src/middleware.ts) — every public route must be listed.`);
      if (sitemap && !sitemap.includes(prefix))
        advisories.push(`[route] ${prefix} not found in src/app/sitemap.ts — every public route enters the sitemap.`);
    }
  }

  return { violations, advisories };
}

/** app/(marketing)/pricing/page.tsx → "pricing"; the home ("") returns null. */
function routeFromPath(p) {
  const rel = p.split("/app/(marketing)/")[1];
  if (!rel) return null;
  const segments = dirname(rel)
    .split("/")
    .filter((s) => s && s !== "." && !s.startsWith("("));
  return segments.length ? segments.join("/") : null;
}

function tryRead(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw || "{}");
    const filePath = String(input?.tool_input?.file_path ?? input?.tool_input?.path ?? "");
    const p = filePath.replace(/\\/g, "/");
    const isMarketing = /\/app\/\(marketing\)\//.test(p) || /\/components\/marketing\//.test(p);
    if (!isMarketing || !LINTABLE.test(p)) process.exit(0);

    // PostToolUse: the file is already on disk — lint the real result.
    const content = tryRead(filePath) ?? String(input?.tool_input?.content ?? "");
    if (!content) process.exit(0);

    const { violations, advisories } = lint(filePath, content);
    if (!violations.length && !advisories.length) process.exit(0);

    const header = `MARKETING LINT — ${p.slice(p.indexOf("apps/") >= 0 ? p.indexOf("apps/") : 0)}`;
    if (violations.length) {
      const reason = [
        `${header}: the file you just wrote breaks the marketing contract. Fix these NOW (edit the file), then continue:`,
        ...violations.map((v, i) => `${i + 1}. ${v}`),
        ...(advisories.length ? ["Also check:", ...advisories.map((a) => `- ${a}`)] : []),
        "Rules: .claude/rules/marketing.md + the marketing-page skill.",
      ].join("\n");
      process.stdout.write(JSON.stringify({ decision: "block", reason }));
    } else {
      const context = [`${header} — advisory findings (verify, fix if real):`, ...advisories.map((a) => `- ${a}`)].join("\n");
      process.stdout.write(
        JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context } }),
      );
    }
    process.exit(0);
  } catch {
    process.exit(0); // Never break a tool call.
  }
});
