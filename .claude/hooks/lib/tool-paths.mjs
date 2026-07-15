import { isAbsolute, resolve } from "node:path";

const PATCH_PATH = /^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$/gm;
const MOVE_PATH = /^\*\*\* Move to:\s*(.+?)\s*$/gm;
const UNIFIED_PATH = /^\+\+\+\s+(?:b\/)?(.+?)\s*$/gm;

function addPath(paths, value) {
  if (typeof value !== "string") return;
  const path = value.trim().replace(/^['"]|['"]$/g, "");
  if (path && path !== "/dev/null") paths.add(path);
}

function addPatchPaths(paths, value) {
  if (typeof value !== "string") return;
  for (const pattern of [PATCH_PATH, MOVE_PATH, UNIFIED_PATH]) {
    pattern.lastIndex = 0;
    for (const match of value.matchAll(pattern)) addPath(paths, match[1]);
  }
}

function visitToolInput(paths, value, depth = 0) {
  if (depth > 4 || value == null) return;
  if (typeof value === "string") {
    addPatchPaths(paths, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => visitToolInput(paths, item, depth + 1));
    return;
  }
  if (typeof value !== "object") return;

  addPath(paths, value.file_path);
  addPath(paths, value.filePath);
  addPath(paths, value.path);
  addPatchPaths(paths, value.patch);
  addPatchPaths(paths, value.input);
  addPatchPaths(paths, value.command);

  for (const key of ["edits", "files", "changes"]) {
    visitToolInput(paths, value[key], depth + 1);
  }
}

export function extractToolPaths(input) {
  const paths = new Set();
  visitToolInput(paths, input?.tool_input ?? input?.toolInput ?? input?.input);
  return [...paths];
}

export function normalizeToolPath(path) {
  return String(path).replace(/\\/g, "/");
}

export function resolveToolPath(input, path) {
  return isAbsolute(path) ? path : resolve(input?.cwd ?? process.cwd(), path);
}

export function isCodexHook(input) {
  return Object.prototype.hasOwnProperty.call(input ?? {}, "model");
}
