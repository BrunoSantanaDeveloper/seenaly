/**
 * Tests for the local product draft.
 *
 * Usage:  npm run test:product-draft
 *
 * This guards a crash pad for work the user has NOT managed to save. The
 * failure modes are asymmetric: dropping a good draft costs them a long form,
 * while restoring a corrupt or ancient one silently poisons a fresh start. So
 * every branch below pins one of those two directions.
 */
import process from "node:process";

import {
  clearDraft,
  DRAFT_MAX_AGE_MS,
  draftKey,
  isWorthSaving,
  loadDraft,
  saveDraft,
} from "../apps/web/src/app/(dashboard)/products/lib/draft";

let failures = 0;
let passes = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passes++;
    return;
  }
  failures++;
  console.log(`FAIL  ${name}\n        expected ${e}\n        actual   ${a}`);
};

/** In-memory stand-in for window.localStorage. */
function memory(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    size: () => map.size,
  };
}

const ORG = "org-1";
const NOW = 1_700_000_000_000;

// Round trip.
{
  const s = memory();
  saveDraft(s, ORG, { name: "Curso" }, NOW);
  check("round trip returns the values", loadDraft<{ name: string }>(s, ORG, NOW)?.values, { name: "Curso" });
  check("round trip keeps the timestamp", loadDraft(s, ORG, NOW)?.savedAt, NOW);
}

// Nothing stored.
check("no draft yields null", loadDraft(memory(), ORG, NOW), null);

// Org isolation — one browser, two orgs, never crossed.
{
  const s = memory();
  saveDraft(s, "org-a", { name: "A" }, NOW);
  check("another org sees no draft", loadDraft(s, "org-b", NOW), null);
  check("keys are namespaced", draftKey("org-a") === draftKey("org-b"), false);
}

// Expiry: a month-old abandoned form must not ambush a fresh start.
{
  const s = memory();
  saveDraft(s, ORG, { name: "Antigo" }, NOW);
  const justInside = NOW + DRAFT_MAX_AGE_MS - 1000;
  check("a draft inside the window is still offered", loadDraft(s, ORG, justInside)?.values, { name: "Antigo" });

  const s2 = memory();
  saveDraft(s2, ORG, { name: "Antigo" }, NOW);
  check("an expired draft is not offered", loadDraft(s2, ORG, NOW + DRAFT_MAX_AGE_MS + 1000), null);
  check("an expired draft is also purged", s2.size(), 0);
}

// A clock that moved backwards must not make a draft look invalid.
{
  const s = memory();
  saveDraft(s, ORG, { name: "Futuro" }, NOW);
  check("a future timestamp still loads", loadDraft(s, ORG, NOW - 60_000)?.values, { name: "Futuro" });
}

// Corruption: half-restoring a form is worse than not restoring it.
for (const [label, raw] of [
  ["not json", "{{{"],
  ["json but not an object", '"just a string"'],
  ["missing savedAt", '{"values":{"name":"x"}}'],
  ["savedAt not a number", '{"values":{"name":"x"},"savedAt":"ontem"}'],
  ["savedAt NaN", '{"values":{"name":"x"},"savedAt":null}'],
  ["missing values", `{"savedAt":${NOW}}`],
  ["values is a string", `{"values":"x","savedAt":${NOW}}`],
] as const) {
  const s = memory({ [draftKey(ORG)]: raw });
  check(`corrupt draft rejected: ${label}`, loadDraft(s, ORG, NOW), null);
}

// Clearing.
{
  const s = memory();
  saveDraft(s, ORG, { name: "x" }, NOW);
  clearDraft(s, ORG);
  check("cleared draft is gone", loadDraft(s, ORG, NOW), null);
}

// Storage that throws (private mode / blocked) must never break the form.
{
  const hostile = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  check("hostile storage: load degrades to null", loadDraft(hostile, ORG, NOW), null);
  saveDraft(hostile, ORG, { name: "x" }, NOW); // must not throw
  clearDraft(hostile, ORG); // must not throw
  check("hostile storage: save and clear do not throw", true, true);
}

// Worth-saving: an untouched form must leave no crumb.
check("empty form is not worth saving", isWorthSaving({ name: "", mainPromise: "" }, ["name", "mainPromise"]), false);
check("whitespace only is not worth saving", isWorthSaving({ name: "   " }, ["name"]), false);
check("a typed name is worth saving", isWorthSaving({ name: "Curso" }, ["name", "mainPromise"]), true);
check("a non-watched field does not count", isWorthSaving({ name: "", notes: "abc" }, ["name"]), false);
check("a filled list counts", isWorthSaving({ objections: ["cara demais"] }, ["objections"]), true);
check("an empty list does not count", isWorthSaving({ objections: [] }, ["objections"]), false);

console.log(
  failures === 0 ? `\nALL PASS — ${passes} assertions.` : `\n${failures} FAILURE(S) out of ${passes + failures}.`,
);
process.exit(failures === 0 ? 0 : 1);
