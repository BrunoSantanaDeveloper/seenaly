---
name: product-verify
description: Journey verification of the authenticated app — runs the app and WALKS the flows a real user takes (new + returning, desktop + mobile viewport), judging dead ends, lost context, error-vs-empty, fake surfaces and destructive actions. Use AFTER building or substantially editing screens/flows under apps/web/src/app/(dashboard), before declaring them done; also when asked to "verify the product", audit a flow, or check UX end-to-end.
---

# Product journey verification

A product screen is not "done" because it typechecks, and not even because it looks right in isolation. The failure mode this skill exists to catch — proven by a real derived-project audit — is **screens that pass individually while the journey between them is broken**: a blocked action with no way to resolve the prerequisite, a detour that loses the user's half-filled form, a network error rendered as "no data", template demo surfaces shipping to real users. Marketing has `marketing-verify` for pixels; this is its product sibling for FLOWS.

## 1. Run the app

- `npm run dev` from the repo root, in the background; reuse an already-running dev server.
- **New-user pass**: without Supabase env vars (or against a freshly seeded local Supabase) every screen renders its zero-data reality — this is the first-impression state to judge.
- **Returning-user pass**: with a seeded local Supabase, sign in as a test user that has real data, so lists, timelines and dashboards render populated.
- Never point this at production data.

## 2. Walk journeys, not routes

Screenshots go to the session scratchpad (never into the repo). Setup is the same as marketing-verify (`npm i playwright && npx playwright install chromium` in the scratchpad). Viewports: **1440×900 and 390×844**, light AND dark.

Do not just open each page. Script (or manually drive) the top 2–3 jobs the touched screens serve, end to end — e.g. "create the first X", "complete the daily task", "recover from a mistake". For each journey capture every step.

## 2b. Deterministic probes (measure before you judge)

```js
// Error ≠ empty: kill the app's data calls and confirm an ERROR renders, not the empty state.
await page.route("**/api/**", (r) => r.abort());
await page.route("**/rest/v1/**", (r) => r.abort()); // Supabase
await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
// FAIL if the screen now shows the EmptyState / "no data" copy instead of an error + retry.

// Unnamed icon controls: must be 0 on every screen you touched.
const unnamed = await page.evaluate(
  () =>
    [...document.querySelectorAll("button")].filter(
      (b) => !b.textContent.trim() && !b.getAttribute("aria-label") && !b.getAttribute("aria-labelledby"),
    ).length,
);

// Template leftovers reaching real users: open the command palette / search / shortcuts
// and grep the DOM for demo-dataset terms.
const leftovers = await page.evaluate(() =>
  ["Add Product", "Add Category", "Discounts", "ThemeForest"].filter((t) => document.body.innerText.includes(t)),
);

// Context preservation: fill a form field, take the prerequisite detour the UI offers,
// come back — assert the field still holds the value.
```

## 3. Judge the journey bar (PASS/FAIL each item, with the step screenshot as evidence)

1. **First-run path to value** — a brand-new account never lands on a blank screen; every zero-data view is an `EmptyState` with why + ONE action that actually works when clicked.
2. **No dead ends** — every blocked/disabled action states its prerequisite and offers resolution **in place** (quick-create, inline step) or a navigation that provably returns. A disabled CTA with no explanation FAILS.
3. **Context survives detours** — form drafts, selected dates/entities and the origin screen are preserved across any prerequisite side-trip (patient-before-appointment class of flows). Losing the user's input FAILS.
4. **Error ≠ empty** — with data calls aborted (probe above), the screen shows an error with retry. Empty-state-on-failure FAILS.
5. **Every CTA lands in context** — checklist items, "prepare X", menu entries and notifications land on the specific in-product destination, never on generic settings, a marketing page inside the app shell, or an unrelated module.
6. **No fake or leftover surfaces** — search, shortcuts, assistants and menus contain only THIS product's entities and actions (probe above finds nothing). Demo e-commerce data reaching a user FAILS.
7. **Destructive actions confirm** — cancel/delete/revoke name the consequence before executing and offer undo where feasible; concurrent state changes (already-started, already-cancelled) are handled, not clobbered.
8. **Locale integrity** — every walked screen renders in the project's default locale; leaked English in a non-English product FAILS.
9. **Mobile 390** — the journey is completable: primary action reachable, no floating widget covering fields, no horizontal scroll, long forms usable.
10. **Keyboard/a11y quick pass** — the main journey is Tab-walkable, focus lands sensibly after dialogs open/close and after errors, `unnamed === 0` on every screen.

## 4. Close the loop

- Report the verdict table to the user (one line per item, with the failing step/screenshot named).
- FAIL items: fix under the `product-screen` skill rules, then re-walk the journey and re-judge. Do not report "done" with open FAILs.
- Clean up: screenshots and scripts stay in the scratchpad; nothing from this skill is committed.

## Degraded mode (no browser available)

Say so explicitly, then do the best static pass: `npm run build` must succeed; trace each journey through the code (entry → prerequisite → return), and check items 2–7 by reading the handlers; list what could NOT be verified live and ask the user to walk the flow once. Never silently claim journey verification that didn't happen.
