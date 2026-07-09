import { DEFAULTS } from "@/config";
import { computeProgress, getOnboardingState, type OnboardingStep } from "@flyee/onboarding";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Onboarding declaration point for THIS project (the template ships none —
 * see packages/onboarding/README.md and the `product-screen` skill).
 *
 * Fill ONBOARDING_STEPS with the few steps that take a brand-new user to
 * their first real result. Everything degrades gracefully while it is
 * empty: post-auth lands on the app root and no checklist is rendered.
 *
 * Example:
 *   export const ONBOARDING_STEPS: OnboardingStep[] = [
 *     { key: "connect-source", title: "Connect your data source", href: "/settings/connections" },
 *     { key: "first-report", title: "Open your first report", href: "/reports" },
 *   ];
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
