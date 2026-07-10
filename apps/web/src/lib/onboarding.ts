import { DEFAULTS } from "@/config";
import { computeProgress, getOnboardingState, type OnboardingStep } from "@flyee/onboarding";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Onboarding declaration point for THIS project (the template ships none —
 * see packages/onboarding/README.md and the `product-screen` skill).
 *
 * SEENALY CHOICE — keep ONBOARDING_STEPS EMPTY on purpose. Seenaly's
 * activation is org-scoped and state-driven (does the org have product
 * context? a Meta connection?), which the template's static, user-scoped
 * ONBOARDING_STEPS can't express. So the real activation surface is
 * `components/activation/activation-checklist.tsx` (flow "activation",
 * org-scoped, live done-predicates, i18n), rendered on `/home` and
 * `/products`. Leaving this empty makes `resolvePostAuthDestination` send new
 * users straight to the app root (`/home`), where that checklist greets them.
 * Do NOT fill this array — it would spin up a second, inferior checklist
 * (user-scoped, click-based) via the template's OnboardingChecklistCard.
 */
export const ONBOARDING_FLOW = "user-activation";

export const ONBOARDING_STEPS: OnboardingStep[] = [];

/** Route hosting the post-signup setup wizard. */
export const ONBOARDING_ROUTE = "/onboarding";

export const isOnboardingEnabled = ONBOARDING_STEPS.length > 0;

/**
 * Where a user goes right after signing up / signing in. Called from the
 * three auth entry points (sign-in, sign-up, /auth/callback) — never from
 * the middleware, which runs on every request and must stay query-free.
 * Falls back to the app root on any failure: auth must never dead-end.
 */
export async function resolvePostAuthDestination(supabase: SupabaseClient, userId: string): Promise<string> {
  if (!isOnboardingEnabled) return DEFAULTS.appRoot;
  try {
    const state = await getOnboardingState(supabase, { userId, flow: ONBOARDING_FLOW });
    if (state.completedAt) return DEFAULTS.appRoot;
    const progress = computeProgress(ONBOARDING_STEPS, state);
    return progress.complete ? DEFAULTS.appRoot : ONBOARDING_ROUTE;
  } catch {
    return DEFAULTS.appRoot;
  }
}
