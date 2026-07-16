---
paths: ["apps/web/src/app/(dashboard)/**", "apps/web/src/components/product/**"]
---

# Product (authenticated app) UX

- The `product-screen` skill is MANDATORY for any create/edit here — a `PreToolUse` hook (`.claude/hooks/product-screen-guard.mjs`) loads it automatically; you never wait to be asked.
- **Goal, not table**: design from the user's job and what success looks like. Never default to a CRUD table of rows — that shape is allowed only when the job really is scan/compare/manage many rows.
- **Never a blank screen**: every zero-data view uses `EmptyState` (icon + why + the ONE next action). A brand-new user must find a path to value (the aha moment).
- Long setups use `SetupWizard` (progressive disclosure); steps to first result use `OnboardingChecklist` + `@flyee/onboarding` (state only; step definitions live in the project's code).
- **Engagement**: completion drive (`ActivationProgress`) and competence feedback only. Never ship points, badges, leaderboards or streaks — documented failures, and streaks carry regulatory risk.
- MUI v9 + theme tokens only, next-intl for every string, inline form errors near the field, skeletons that reserve space.
- **Semantic fields**: phone, CPF/CNPJ, CEP and money never go in a raw `TextField` — use `components/product/fields/*` (mask + check-digit validation + CEP auto-fill via `@flyee/fields`); persist `onlyDigits()`, never the masked string.
