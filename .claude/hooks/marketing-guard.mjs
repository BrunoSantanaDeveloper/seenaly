#!/usr/bin/env node
/**
 * PreToolUse guard for the marketing layer.
 *
 * Fires on every Write/Edit/MultiEdit whose target is a public marketing
 * page or a marketing component. It injects a non-blocking reminder so the
 * `marketing-page` skill and the committed design direction are ALWAYS
 * applied — to new pages, edits to existing pages, and new sections alike —
 * without the user having to ask. Deterministic (the harness runs it), which
 * the advisory rule alone is not.
 *
 * It also injects a digest of the component catalog
 * (apps/web/src/components/marketing/catalog.json) so the library's FULL
 * expressive range is in context on every generation — pages compose the
 * archetypes instead of reinventing the few the model remembers.
 *
 * Cross-platform: pure Node (present in every derived project), no shell.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { extractToolPaths, isCodexHook, normalizeToolPath } from "./lib/tool-paths.mjs";

function catalogDigest(cwd) {
  try {
    const json = readFileSync(join(cwd, "apps", "web", "src", "components", "marketing", "catalog.json"), "utf8");
    const catalog = JSON.parse(json);
    const lines = (catalog.components ?? []).map(
      (c) => `- ${c.name}(${c.props})${c.funnel ? ` [${c.funnel}]` : ""} — ${c.use}`,
    );
    if (!lines.length) return "";
    return [
      "5. COMPONENT CATALOG (compose these — never invent per-page layout):",
      ...lines,
      `   Tones: ${catalog.tones?.rule ?? ""}`,
    ].join("\n");
  } catch {
    return ""; // Catalog pruned or unreadable — the reminder still stands on its own.
  }
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let input = {};
  try {
    input = JSON.parse(raw || "{}");
  } catch {
    // Malformed payload — stay silent, never block a tool call.
    process.exit(0);
  }

  const isMarketing = extractToolPaths(input)
    .map(normalizeToolPath)
    .some((path) => /\/app\/\(marketing\)\//.test(path) || /\/components\/marketing\//.test(path));
  if (!isMarketing) process.exit(0);

  const reminder = [
    "MARKETING LAYER — mandatory before this write/edit:",
    "1. Load the `marketing-page` skill and obey it (design direction, conversion structure, premium bar).",
    '2. If `docs/DESIGN.md` exists, INHERIT that committed direction. Do NOT re-run the direction engine and do NOT restyle the UI — STRICT MODE: only redesign when the user explicitly asks ("redesign" / "nova direção"). If it does not exist yet, run Pass 0 and write it.',
    "3. Applies equally to NEW pages, EDITS to existing pages, and ADDING/CHANGING a section. Whenever you add or change a section, run a WHOLE-PAGE coherence pass: every existing section must stay aesthetically aligned with the new one and pass the premium bar. If the new work raises the bar, bring the older sections up to it — never leave a page half at the old level and half at the new.",
    '4. SEO is part of the page (see the skill\'s SEO section + `docs/SEO.md`): exactly one <h1> (the page title — `SectionHeader as="h1"` / `PricingSection headingAs="h1"` when the lead is not a <Hero>), a localized title + distinct description via `generateMetadata`, the route in `PUBLIC_PREFIXES` + `sitemap.ts`, and structured data via <JsonLd> for schema-eligible blocks (Organization/FAQPage/Product are already emitted — don\'t duplicate).',
    catalogDigest(input?.cwd ?? process.cwd()),
  ]
    .filter(Boolean)
    .join("\n");

  const output = isCodexHook(input)
    ? { systemMessage: reminder }
    : {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext: reminder,
        },
      };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
});
