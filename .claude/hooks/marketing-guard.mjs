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
 * Cross-platform: pure Node (present in every derived project), no shell.
 */

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let filePath = "";
  try {
    const input = JSON.parse(raw || "{}");
    filePath = input?.tool_input?.file_path ?? input?.tool_input?.path ?? "";
  } catch {
    // Malformed payload — stay silent, never block a tool call.
    process.exit(0);
  }

  // Normalize Windows/relative/absolute paths to forward slashes.
  const p = String(filePath).replace(/\\/g, "/");
  const isMarketing =
    /\/app\/\(marketing\)\//.test(p) || /\/components\/marketing\//.test(p);
  if (!isMarketing) process.exit(0);

  const reminder = [
    "MARKETING LAYER — mandatory before this write/edit:",
    "1. Load the `marketing-page` skill and obey it (design direction, conversion structure, premium bar).",
    "2. If `docs/DESIGN.md` exists, INHERIT that committed direction. Do NOT re-run the direction engine and do NOT restyle the UI — STRICT MODE: only redesign when the user explicitly asks (\"redesign\" / \"nova direção\"). If it does not exist yet, run Pass 0 and write it.",
    "3. Applies equally to NEW pages, EDITS to existing pages, and ADDING/CHANGING a section. Whenever you add or change a section, run a WHOLE-PAGE coherence pass: every existing section must stay aesthetically aligned with the new one and pass the premium bar. If the new work raises the bar, bring the older sections up to it — never leave a page half at the old level and half at the new.",
  ].join("\n");

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: reminder,
      },
    }),
  );
  process.exit(0);
});
