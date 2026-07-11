---
name: product-screen
description: UX playbook for authenticated app screens (everything under apps/web/src/app/(dashboard) that is NOT marketing). Use BEFORE creating or substantially editing any product screen — it stops the default drift into CRUD tables and forces goal-first, activation-driven design (empty states, onboarding, progressive disclosure) with honest, research-backed engagement patterns.
---

# Product screen playbook

You are designing a screen inside a paid product, not an admin CRUD. The failure mode this skill exists to prevent: **defaulting to a table of rows with add/edit/delete**, because that is the statistically common shape. Real products are designed around what the user is trying to ACHIEVE and how fast they reach value.

Scope: every screen under `apps/web/src/app/(dashboard)/**` (the authenticated app). Marketing (`(marketing)`) has its own skill. A `PreToolUse` hook loads this automatically on edits here — you never wait to be asked.

## Pass 0 — goal, not table

Before any layout, write down: **who** is on this screen, **what job** they came to do, and **what "success" looks like** for them here. Design backward from that. Ask: if this screen were not a table, what would it be? A table is a valid answer only when the job is genuinely "scan/compare/manage many rows" — otherwise it is the lazy default. Prefer: a focused summary + the one primary action; a guided flow; a single object view with its context; a dashboard that answers a question.

## The activation principle (from onboarding research)

The best products bring the user to VALUE fast (the "aha moment") — they sell the outcome, not the feature list.

- **First-run is not a blank screen.** A brand-new account must land on a path to value: a welcome + the first meaningful action, or a short setup. Show what the product will do for them.
- **Personalize when it earns its keep**, and then *show what the answer unlocked* — a home already populated with the user's relevant content beats an empty one.
- **Onboarding checklist** (`OnboardingChecklist` + `@flyee/onboarding`): a persistent, dismissible-but-reopenable list of the few steps to first result. Replacing pop-ups/banners with a checklist lifted one-week retention +10% (Mural). It doubles as the honest gamification below.
- **Progressive disclosure** (`SetupWizard`): one decision per screen with a visible progress rail; a long setup that never feels long. Splitting a form across steps can *raise* conversion (House +15%).
- **Reassure along the way**: inline validation (a password field that ticks requirements as you type), microcopy that explains the impact of a step, tooltips on dry concepts. None of it is flashy; it makes the flow feel effortless.

## Empty states (non-negotiable)

Every zero-data view uses `EmptyState` — icon + one line of why + the ONE next action (the nudge). A bare "No data" / empty table is a UX failure. The empty state is often a user's FIRST impression of a feature: make it teach and invite.

## Engagement patterns — what works vs theater

Distilled from the gamification research — most of it is a WARNING:

- **Use: completion drive.** Progress toward closing an open loop (Gestalt closure — Apple activity rings drove 49.5% behavior change). This is the onboarding checklist + `ActivationProgress` ring. It maps REAL setup/usage progress.
- **Use: competence feedback.** Signals that the user got better at the actual thing (real personal records, meaningful milestones tied to genuine work) — the need most tied to lasting motivation. Domain-specific: design it into the product's own data, not as a bolt-on.
- **Avoid: PBL theater** — points, badges, leaderboards bolted on. The three most-documented failures (LinkedIn, Foursquare, Google News all retired theirs); they drive quantity over the behavior the business needs.
- **Avoid: streak traps.** Streaks shift from motivating to obligational and carry active regulatory risk (EU Digital Fairness Act). Do not ship a streak by default.
- **Avoid the S-curve.** Stacking streaks + points + badges + challenges reverses engagement (Habitica: 100% of studied users had counterproductive effects). If you're stacking mechanics, you're past the peak.
- **Local, winnable competition** beats a global leaderboard when competition fits the product at all (Strava segments).

## Layout & craft (dashboards)

- Arrange by the QUESTION the screen answers, not by table schema. Group related data; decide how much belongs on one screen before it clutters.
- Lead cards/sections with a meaningful icon (show, don't tell — same as marketing). Use the harmonic tones (`components/marketing/tone.ts` hues via tokens) for categorical families; primary for the primary action.
- MUI v9 first, theme tokens only (never hardcode colors), Formik+Yup for forms with inline errors near the field, next-intl for every string.
- Respect the loading and error states — skeletons that reserve space (no layout shift), errors that say what to do next.

## Reusable building blocks

`apps/web/src/components/product/`: `EmptyState`, `OnboardingChecklist`, `OnboardingChecklistCard`, `ActivationProgress`, `SetupWizard`. State persistence: `@flyee/onboarding` (`getOnboardingState`, `completeStep`, `computeProgress`) over `onboarding_state` (migration 0009). Step definitions live in the project's code; only state is persisted.

**Live predicates are the preferred path** (not click-tracking): give a step a `done` derived from real product state (`{ key, title, done: hasConnection }`) so the checklist reflects reality; `completeStep` is only for steps with no observable signal. Strings in these components come from the `product` i18n namespace (all 5 locales). For multi-tenant setup work, set `ONBOARDING_ORG_SCOPED = true` so activation is shared across an org's members instead of per user.

**Wiring (already in place):** declare the steps in `apps/web/src/lib/onboarding.ts` (`ONBOARDING_STEPS`; empty ⇒ everything degrades to the app root). The four auth entry points (sign-in, sign-up, `/auth/callback`, `/auth/two-factor`) call `resolvePostAuthDestination`, sending a user with pending onboarding to `/onboarding` (the `SetupWizard`, self-guarding) and everyone else to `DEFAULTS.appRoot`. The app home mounts `OnboardingChecklistCard` for the remaining steps. Do NOT put this check in the middleware — it runs on every request and must stay query-free.

## Before finishing

Walk the screen as a brand-new user (empty data) AND as a returning one. Confirm: no blank empty states; a first-run path to value exists; no CRUD table where a focused view fits the job better; strings translated; tokens only; `npm run build` + `npm run lint:fix` pass.
