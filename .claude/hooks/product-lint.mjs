#!/usr/bin/env node
/**
 * PostToolUse lint for the product layer (authenticated app) — the
 * deterministic half of the product quality system, the sibling of
 * marketing-lint.mjs (the PreToolUse guard reminds BEFORE writing; this
 * checks the RESULT after every Write/Edit).
 *
 * Born from a derived-project UX audit: the recurring, machine-checkable
 * failures were hardcoded theme values, unnamed icon buttons/switches
 * (a11y), errors silently rendered as empty states, swallowed promise
 * failures and native confirm() on destructive actions.
 *
 * Hard violations (token bypasses, unnamed controls, GSAP in product code)
 * come back as mandatory hook feedback so the agent fixes them immediately;
 * heuristic findings (error-as-empty, hardcoded copy) come back as advisories.
 *
 * Cross-platform: pure Node (present in every derived project), no shell.
 * It must NEVER crash a tool call: any internal error exits silently.
 */

import { readFileSync } from "node:fs";

import { extractToolPaths, isCodexHook, normalizeToolPath, resolveToolPath } from "./lib/tool-paths.mjs";

const LINTABLE = /\.(tsx|ts|jsx|js|css)$/;

const RAW_HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/;
const RAW_COLOR_FN = /\b(?:rgba?|oklch)\s*\(/;
const RAW_HSL = /\bhsla?\(\s*(?!var\()/;
/** JSX text node with 3+ words and no expression — likely copy that belongs in i18n. */
const JSX_TEXT = />\s*([A-Za-zÀ-ÿ][^<>{}]*?\s+\S+\s+\S+[^<>{}]*?)\s*</;
/** `.catch(() => setX([]))` — a failed fetch rendered as "no data". */
const CATCH_ARROW_EMPTY = /\.catch\(\s*(?:\(\s*\w*\s*\)|\w+)?\s*=>\s*set[A-Z]\w*\(\s*(?:\[\]|null|""|'')\s*\)/;
/** try/catch that only resets state to empty — same failure, statement form. */
const CATCH_BLOCK_EMPTY = /\bcatch\s*(?:\([^)]*\)\s*)?\{[^{}]{0,200}?set[A-Z]\w*\(\s*(?:\[\]|null|""|'')\s*\)[^{}]{0,80}?\}/;
/** Swallowed failures: empty catch block / no-op .catch. */
const CATCH_SWALLOWED = /\bcatch\s*(?:\([^)]*\)\s*)?\{\s*\}|\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/;
const NATIVE_CONFIRM = /\bwindow\.(?:confirm|alert)\s*\(|(?<![.\w])confirm\s*\(/;

/**
 * Find every `<TagName ...>` opening tag, tolerant of multi-line attributes,
 * arrow functions (`=>`) and nested braces inside attribute expressions.
 */
function scanOpeningTags(content, tagName) {
  const tags = [];
  const re = new RegExp(`<${tagName}\\b`, "g");
  let match;
  while ((match = re.exec(content))) {
    let i = match.index + match[0].length;
    let depth = 0;
    while (i < content.length) {
      const ch = content[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth <= 0 && content[i - 1] !== "=") break;
      i++;
    }
    tags.push({ index: match.index, tag: content.slice(match.index, i + 1) });
  }
  return tags;
}

function lineOf(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function hasAccessibleName(tag) {
  return /aria-label|aria-labelledby|inputProps|slotProps|\.\.\./.test(tag);
}

function lint(filePath, content) {
  const p = filePath.replace(/\\/g, "/");
  // Admin consoles are intentionally EN-only (apps/web/CLAUDE.md) — the
  // hardcoded-copy advisory applies to user-facing screens only.
  const isScreen = /\/app\/\(dashboard\)\//.test(p) && !/\/app\/\(dashboard\)\/admin\//.test(p);
  const violations = [];
  const advisories = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, i) => {
    const at = `line ${i + 1}`;
    if (RAW_HEX.test(line))
      violations.push(
        `[raw-color] ${at}: hex literal — theme values come from the design tokens / MUI theme, never hardcoded in an app (CLAUDE.md golden rule).`,
      );
    if (RAW_COLOR_FN.test(line)) violations.push(`[raw-color] ${at}: rgb()/oklch() literal — use the theme/token value.`);
    if (RAW_HSL.test(line))
      violations.push(`[raw-color] ${at}: hsl() with raw values — only hsl(var(--token) / alpha) is allowed.`);
    if (NATIVE_CONFIRM.test(line))
      advisories.push(
        `[native-confirm?] ${at}: window.confirm/alert — destructive or consequential actions use a real dialog that names the consequence (and offers undo where feasible), not a browser popup.`,
      );
    if (isScreen) {
      const text = line.match(JSX_TEXT);
      if (text)
        advisories.push(
          `[hardcoded-copy?] ${at}: JSX text "${text[1].slice(0, 60)}" — product copy goes through the product i18n namespace in ALL 5 locales.`,
        );
    }
  });

  if (/from\s+["']@?gsap/.test(content))
    violations.push(
      `[gsap-in-product] GSAP imported in product code — GSAP lives ONLY in marketing client components (.claude/rules/marketing.md).`,
    );

  // a11y: every icon-only button needs an accessible name.
  for (const { index, tag } of scanOpeningTags(content, "IconButton")) {
    if (!hasAccessibleName(tag))
      violations.push(
        `[a11y-icon-button] line ${lineOf(content, index)}: <IconButton> without aria-label — icon-only controls MUST have an accessible name.`,
      );
  }

  // a11y: raw <label> must be associated with its control.
  for (const { index, tag } of scanOpeningTags(content, "label")) {
    if (!/htmlFor|\.\.\./.test(tag))
      violations.push(
        `[a11y-label] line ${lineOf(content, index)}: <label> without htmlFor — associate it with the input's id (or wrap the control).`,
      );
  }

  // Semantic data in a raw TextField — the field catalog exists for these.
  if (!/\/components\/product\/fields\//.test(p)) {
    for (const { index, tag } of scanOpeningTags(content, "TextField")) {
      const semantic = tag.match(/\b(?:phone|celular|whatsapp|cpf|cnpj|cep|postal|zip.?code)\b/i);
      if (semantic)
        advisories.push(
          `[semantic-field?] line ${lineOf(content, index)}: raw <TextField> named "${semantic[0]}" — use the semantic fields (components/product/fields: PhoneField/CpfField/CnpjField/CepField) for mask + check-digit validation + CEP auto-fill; persist onlyDigits().`,
        );
    }
  }

  // a11y: standalone Switch/Checkbox without a name (FormControlLabel's control={...} names it).
  for (const tagName of ["Switch", "Checkbox"]) {
    for (const { index, tag } of scanOpeningTags(content, tagName)) {
      const before = content.slice(Math.max(0, index - 60), index);
      if (!/control=\{\s*$/.test(before) && !hasAccessibleName(tag))
        advisories.push(
          `[a11y-switch?] line ${lineOf(content, index)}: <${tagName}> with no accessible name — wrap it in FormControlLabel or give it an aria-label.`,
        );
    }
  }

  // Async contract: error must never render as an empty state.
  if (CATCH_ARROW_EMPTY.test(content) || CATCH_BLOCK_EMPTY.test(content))
    advisories.push(
      `[error-as-empty?] a catch resets state to empty ([], null, "") — a failed request must render an ERROR with retry, never the empty state (loading | data | empty | error+retry).`,
    );
  if (CATCH_SWALLOWED.test(content))
    advisories.push(
      `[swallowed-error?] an empty catch block — failures must surface to the user (error state / snackbar), not vanish.`,
    );

  return { violations, advisories };
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
    const findings = [];

    for (const toolPath of extractToolPaths(input)) {
      const p = normalizeToolPath(toolPath);
      const isProduct =
        !/\/app\/\(marketing\)\//.test(p) &&
        !/\/components\/marketing\//.test(p) &&
        (/\/app\/\(dashboard\)\//.test(p) || /\/components\/product\//.test(p));
      if (!isProduct || !LINTABLE.test(p)) continue;

      // PostToolUse: the file is already on disk — lint the real result.
      const filePath = resolveToolPath(input, toolPath);
      const content = tryRead(filePath) ?? String(input?.tool_input?.content ?? "");
      if (!content) continue;

      const result = lint(filePath, content);
      if (result.violations.length || result.advisories.length) {
        const displayPath = p.slice(p.indexOf("apps/") >= 0 ? p.indexOf("apps/") : 0);
        findings.push({ ...result, header: `PRODUCT LINT — ${displayPath}` });
      }
    }

    if (!findings.length) process.exit(0);

    const hardFindings = findings.filter(({ violations }) => violations.length);
    if (hardFindings.length) {
      const reason = [
        "PRODUCT LINT: the write breaks the product contract. Fix these NOW, then continue:",
        ...hardFindings.flatMap(({ header, violations, advisories }) => [
          header,
          ...violations.map((violation, index) => `${index + 1}. ${violation}`),
          ...(advisories.length ? ["Also check:", ...advisories.map((advisory) => `- ${advisory}`)] : []),
        ]),
        "Rules: the product-screen skill + CLAUDE.md golden rules.",
      ].join("\n");

      process.stdout.write(
        JSON.stringify(isCodexHook(input) ? { systemMessage: reason } : { decision: "block", reason }),
      );
    } else {
      const context = findings
        .flatMap(({ header, advisories }) => [
          `${header} — advisory findings (verify, fix if real):`,
          ...advisories.map((advisory) => `- ${advisory}`),
        ])
        .join("\n");
      process.stdout.write(
        JSON.stringify(
          isCodexHook(input)
            ? { systemMessage: context }
            : { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context } },
        ),
      );
    }
    process.exit(0);
  } catch {
    process.exit(0); // Never break a tool call.
  }
});
