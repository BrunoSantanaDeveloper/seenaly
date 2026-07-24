---
paths: ["apps/web/src/app/(dashboard)/**", "apps/web/src/components/product/**"]
---

# Product (authenticated app) UX

- The `product-screen` skill is MANDATORY for any create/edit here — a `PreToolUse` hook (`.claude/hooks/product-screen-guard.mjs`) loads it automatically; you never wait to be asked.
- **Goal, not table**: design from the user's job and what success looks like. Never default to a CRUD table of rows — that shape is allowed only when the job really is scan/compare/manage many rows.
- **Never a blank screen**: every zero-data view uses `EmptyState` (icon + why + the ONE next action). A brand-new user must find a path to value (the aha moment).
- Long setups use `SetupWizard` (progressive disclosure); steps to first result use `OnboardingChecklist` + `@flyee/onboarding` (state only; step definitions live in the project's code).
- **Engagement**: completion drive (`ActivationProgress`) and competence feedback. Celebration/level mechanics are allowed **only when the progress they celebrate is machine-verified** — e.g. the readiness checklist, where a claim the page scan disproves is refused, so a tick cannot be inflated (`lib/readiness/checklist.ts` → `verifyItem`). Progress the user can simply assert is NOT a scoreboard: it rewards saying "done" over being done, and in a diagnostic product that poisons the very data the verdict is built on. **Never ship streaks or leaderboards** — streaks create obligation and carry regulatory risk (EU Digital Fairness Act), and ranking is meaningless in a one-org-per-account tool.
- MUI v9 + theme tokens only, next-intl for every string, inline form errors near the field, skeletons that reserve space.
- **Semantic fields**: phone, CPF/CNPJ, CEP and money never go in a raw `TextField` — use `components/product/fields/*` (mask + check-digit validation + CEP auto-fill via `@flyee/fields`); persist `onlyDigits()`, never the masked string.
