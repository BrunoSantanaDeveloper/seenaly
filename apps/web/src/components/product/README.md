# Product UX components

Building blocks for the authenticated app (dashboard/product screens) — the counterpart to `components/marketing/`. They exist so product screens are designed around **user goals and activation**, not defaulted to CRUD tables. See the `product-screen` skill for the full playbook.

- `EmptyState` — never ship a blank zero-data view: icon + why + the ONE next action (the nudge).
- `OnboardingChecklist` — persistent activation checklist (the Mural pattern, +10% one-week retention); shows real progress, nudges the next step, survives dismissal. Steps declared in code; state from `@flyee/onboarding`.
- `OnboardingChecklistCard` — drop-in wrapper of the above: fetches user + state itself and renders nothing when onboarding is undeclared, complete or dismissed. Mounted on the app home; safe to mount unconditionally.
- `ActivationProgress` — completion-drive ring (Gestalt closure). The one research-backed gamification pattern — no points/badges/streaks.
- `SetupWizard` — multi-step setup shell (progressive disclosure): one decision per screen with a visible progress rail, so long setups don't feel long.

## Where the flow is wired

- **Declare it** in `apps/web/src/lib/onboarding.ts`: `ONBOARDING_STEPS` (empty in the template ⇒ everything degrades to the app root). Also exports `resolvePostAuthDestination`.
- **Post-auth routing**: sign-in, sign-up, `/auth/callback` and `/auth/two-factor` all call `resolvePostAuthDestination` — a user with pending onboarding goes to `/onboarding`, everyone else to `DEFAULTS.appRoot`. Never checked in the middleware (it runs on every request and must stay query-free).
- **`/onboarding`** (`app/onboarding/page.tsx`) hosts the post-signup `SetupWizard` and guards itself (no flow / already activated ⇒ app root).
- **App home** mounts `OnboardingChecklistCard` for the remaining steps.

State persistence lives in `@flyee/onboarding` (migration `0011_onboarding.sql`).
