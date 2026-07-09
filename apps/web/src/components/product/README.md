# Product UX components

Building blocks for the authenticated app (dashboard/product screens) — the counterpart to `components/marketing/`. They exist so product screens are designed around **user goals and activation**, not defaulted to CRUD tables. See the `product-screen` skill for the full playbook.

- `EmptyState` — never ship a blank zero-data view: icon + why + the ONE next action (the nudge).
- `OnboardingChecklist` — persistent activation checklist (the Mural pattern, +10% one-week retention); shows real progress, nudges the next step, survives dismissal. Steps declared in code; state from `@flyee/onboarding`.
- `ActivationProgress` — completion-drive ring (Gestalt closure). The one research-backed gamification pattern — no points/badges/streaks.
- `SetupWizard` — multi-step setup shell (progressive disclosure): one decision per screen with a visible progress rail, so long setups don't feel long.

State persistence lives in `@flyee/onboarding` (migration `0009_onboarding.sql`).
