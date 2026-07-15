#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";

import { extractToolPaths, isCodexHook, normalizeToolPath } from "./lib/tool-paths.mjs";

function findRepoRoot(start) {
  let current = resolve(start);
  const root = parse(current).root;
  while (current !== root) {
    if (existsSync(join(current, ".git")) && existsSync(join(current, "package.json"))) return current;
    current = dirname(current);
  }
  return null;
}

function isCanonicalHarnessPath(path) {
  const normalized = normalizeToolPath(path).replace(/^\.\//, "");
  return (
    normalized === "CLAUDE.md" ||
    /^apps\/[^/]+\/CLAUDE\.md$/.test(normalized) ||
    /^\.claude\/rules\/.*\.md$/.test(normalized) ||
    /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(normalized)
  );
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw || "{}");
    const root = findRepoRoot(input?.cwd ?? process.cwd());
    if (!root) process.exit(0);

    const changed = extractToolPaths(input).some((path) => {
      const absolute = normalizeToolPath(resolve(input?.cwd ?? root, path));
      const relative = absolute.startsWith(`${normalizeToolPath(root)}/`)
        ? absolute.slice(normalizeToolPath(root).length + 1)
        : normalizeToolPath(path);
      return isCanonicalHarnessPath(relative);
    });
    if (!changed) process.exit(0);

    const result = spawnSync(process.execPath, [join(root, "scripts", "sync-agent-harness.mjs")], {
      cwd: root,
      encoding: "utf8",
    });
    if (result.status === 0) process.exit(0);

    const message = `HARNESS SYNC failed: ${result.stderr || result.stdout || `exit ${result.status}`}`.trim();
    process.stdout.write(
      JSON.stringify(
        isCodexHook(input)
          ? { systemMessage: message }
          : { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: message } },
      ),
    );
  } catch {
    process.exit(0);
  }
});
