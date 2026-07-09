#!/usr/bin/env node
/**
 * PreToolUse guard for the authenticated app (product screens).
 *
 * Fires on every Write/Edit/MultiEdit under app/(dashboard)/** or
 * components/product/**, injecting a non-blocking reminder so the
 * `product-screen` skill applies to NEW screens, EDITS and added sections
 * alike — the default drift into CRUD tables never gets a free pass.
 *
 * Marketing paths are excluded: they have their own guard.
 * Cross-platform: pure Node, no shell.
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
    process.exit(0); // Malformed payload — never block a tool call.
  }

  const p = String(filePath).replace(/\\/g, "/");
  if (/\/app\/\(marketing\)\//.test(p) || /\/components\/marketing\//.test(p)) process.exit(0);

  const isProduct = /\/app\/\(dashboard\)\//.test(p) || /\/components\/product\//.test(p);
  if (!isProduct) process.exit(0);

  const reminder = [
    "PRODUCT SCREEN — mandatory before this write/edit:",
    "1. Load the `product-screen` skill and obey it.",
    "2. GOAL, NOT TABLE: state who is on this screen, what job they came to do, and what success looks like. Do NOT default to a CRUD table of rows — a table is right only when the job really is scan/compare/manage many rows.",
    "3. Activation: a brand-new user must find a path to value (aha moment), never a blank screen. Every zero-data view uses `EmptyState` (icon + why + the ONE next action). Long setups use `SetupWizard` (progressive disclosure); first-result steps use `OnboardingChecklist` + `@flyee/onboarding`.",
    "4. Engagement: use completion drive (`ActivationProgress`) and competence feedback. Do NOT add points, badges, leaderboards or streaks — they are documented failures and streaks carry regulatory risk.",
  ].join("\n");

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: reminder },
    }),
  );
  process.exit(0);
});
