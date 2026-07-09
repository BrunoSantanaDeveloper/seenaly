# @flyee/onboarding

Activation mechanism for **onboarding checklists** and **setup wizards** — persists which steps a user completed; the step *definitions* stay in the derived project's code. This is the honest, effective side of "gamification": **completion drive** (Gestalt closure — "3 of 5 done"), not points/badges/streaks.

## Split

- **Mechanism (template)**: `onboarding_state` (0011) stores completed step keys, dismissal, and the `completed_at` activation moment, per `(user, org?, flow)`. RLS: users read/write only their own rows.
- **Domain (project)**: the step catalog — labels, links, and optional live done-predicates — is an `OnboardingStep[]` declared in code. A project may run several flows (`user-activation`, `org-setup`).

## Usage

```ts
import { getOnboardingState, completeStep, computeProgress, type OnboardingStep } from "@flyee/onboarding";

const steps: OnboardingStep[] = [
  { key: "connect-source", title: "Connect your data source", href: "/settings/connections", done: hasConnection },
  { key: "invite-team", title: "Invite a teammate", href: "/settings/organization" },
  { key: "first-report", title: "Open your first report", href: "/reports" },
];

const state = await getOnboardingState(supabase, { userId, orgId, flow: "user-activation" });
const progress = computeProgress(steps, state); // { done, total, percent, nextStep, complete }
await completeStep(supabase, { userId, orgId, flow: "user-activation" }, "invite-team", steps.filter(s => s.required !== false).map(s => s.key));
```

`step.done` (a live predicate) wins over the stored flag, so the checklist reflects reality, not just clicks.

## UI + wiring

The React components live in `apps/web/src/components/product/` (they travel with the app): `OnboardingChecklist`, `OnboardingChecklistCard`, `ActivationProgress`, `EmptyState`, `SetupWizard`. See the `product-screen` skill for when to reach for each.

The flow is declared once in `apps/web/src/lib/onboarding.ts` (`ONBOARDING_STEPS` — empty in the template, so everything degrades to the app root). `resolvePostAuthDestination` is called by sign-in, sign-up, `/auth/callback` and `/auth/two-factor`: a user with pending onboarding lands on `/onboarding` (setup wizard), everyone else on the app root. The app home mounts `OnboardingChecklistCard` for the remaining steps. The check never runs in the middleware (query-free by design).

## Migration

`packages/db/migrations/0011_onboarding.sql`. No env vars.
