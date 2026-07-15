#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hooksRoot = join(repoRoot, ".claude", "hooks");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runHook(name, input) {
  const result = spawnSync(process.execPath, [join(hooksRoot, name)], {
    cwd: repoRoot,
    encoding: "utf8",
    input: JSON.stringify(input),
  });
  assert(result.status === 0, `${name} exited with ${result.status}: ${result.stderr}`);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

const codexBase = {
  cwd: repoRoot,
  hook_event_name: "PreToolUse",
  model: "codex-harness-test",
};

const marketingPatch = [
  "*** Begin Patch",
  "*** Update File: apps/web/src/components/marketing/hero.tsx",
  "*** End Patch",
].join("\n");
const marketingCodex = runHook("marketing-guard.mjs", {
  ...codexBase,
  tool_input: { command: marketingPatch },
});
assert(marketingCodex?.systemMessage?.includes("marketing-page"), "Codex marketing guard did not fire");
assert(marketingCodex.systemMessage.includes("COMPONENT CATALOG"), "Marketing catalog was not injected");

const marketingClaude = runHook("marketing-guard.mjs", {
  cwd: repoRoot,
  hook_event_name: "PreToolUse",
  tool_input: { file_path: join(repoRoot, "apps/web/src/app/(marketing)/page.tsx") },
});
assert(
  marketingClaude?.hookSpecificOutput?.additionalContext?.includes("marketing-page"),
  "Claude marketing guard compatibility failed",
);

const mixedPatch = [
  "*** Begin Patch",
  "*** Update File: apps/web/src/components/marketing/hero.tsx",
  "*** Update File: apps/web/src/app/(dashboard)/settings/page.tsx",
  "*** End Patch",
].join("\n");
const productCodex = runHook("product-screen-guard.mjs", {
  ...codexBase,
  tool_input: { command: mixedPatch },
});
assert(productCodex?.systemMessage?.includes("product-screen"), "Codex product guard did not fire");

const lintPath = "apps/web/src/components/marketing/__harness_probe__.tsx";
const lintCodex = runHook("marketing-lint.mjs", {
  ...codexBase,
  hook_event_name: "PostToolUse",
  tool_input: {
    command: `*** Begin Patch\n*** Add File: ${lintPath}\n*** End Patch`,
    content: 'export const probe = "#fff";',
  },
});
assert(lintCodex?.systemMessage?.includes("[raw-color]"), "Codex marketing lint did not report a violation");

const lintClaude = runHook("marketing-lint.mjs", {
  cwd: repoRoot,
  hook_event_name: "PostToolUse",
  tool_input: {
    file_path: join(repoRoot, lintPath),
    content: 'export const probe = "#fff";',
  },
});
assert(lintClaude?.decision === "block", "Claude marketing lint compatibility failed");

const unrelated = runHook("marketing-guard.mjs", {
  ...codexBase,
  tool_input: { command: "*** Begin Patch\n*** Update File: README.md\n*** End Patch" },
});
assert(unrelated === null, "Marketing guard fired for an unrelated file");

const harnessSync = runHook("harness-sync.mjs", {
  ...codexBase,
  hook_event_name: "PostToolUse",
  tool_input: { command: "*** Begin Patch\n*** Update File: CLAUDE.md\n*** End Patch" },
});
assert(harnessSync === null, "Shared harness synchronization failed");

console.log("Claude/Codex harness tests passed.");
