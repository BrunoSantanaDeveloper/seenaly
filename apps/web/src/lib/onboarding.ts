import { DEFAULTS } from "@/config";
import { computeProgress, type FlowKey, getOnboardingState, type OnboardingStep } from "@flyee/onboarding";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Onboarding declaration point for THIS project (the template ships none —
 * see packages/onboarding/README.md and the `product-screen` skill).
 *
 * Fill ONBOARDING_STEPS with the few steps that take a brand-new user to
 * their first real result. Everything degrades gracefully while it is
 * empty: post-auth lands on the app root and no checklist is rendered.
 *
 * Prefer LIVE step predicates over click-tracking: give a step a `done`
 * derived from real product state (e.g. "has connected a data source") so
 * the checklist reflects reality, not just clicks. `completeStep` remains
 * for steps that have no observable signal.
 *
 * Example:
 *   export const ONBOARDING_STEPS: OnboardingStep[] = [
 *     { key: "connect-source", title: "Connect your data source", href: "/settings/connections", done: hasConnection },
 *     { key: "first-report", title: "Open your first report", href: "/reports" },
 *   ];
 */
export const ONBOARDING_FLOW = "user-activation";

/**
 * SEENALY INITIAL ONBOARDING — defines the full-screen mandatory setup step
 * for new users to register their first Product Context before accessing the dashboard.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: "welcome-and-product", title: "Configuração Inicial do Produto", href: "/onboarding" },
];

/** Route hosting the post-signup setup wizard. */
export const ONBOARDING_ROUTE = "/onboarding";

/**
 * Scope of the activation flow:
 * - `false` (default): PER USER — personal activation, the same across orgs.
 * - `true`: PER ORGANIZATION — setup shared by the org's members (e.g. "connect
 *   the data source", "invite the team"); one member completing it activates
 *   the org. More correct for multi-tenant setup work. When true, the flow key
 *   carries the user's active org id.
 */
export const ONBOARDING_ORG_SCOPED = false;

export const isOnboardingEnabled = ONBOARDING_STEPS.length > 0;

/** The user's active organization (first membership) — for org-scoped flows. */
async function getActiveOrgId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

/**
 * The flow key shared by the resolver, the checklist card and the /onboarding
 * page, so they all read/write the SAME onboarding_state row (adds org_id when
 * the flow is org-scoped). Use this instead of hand-building the key.
 */
export async function getOnboardingFlowKey(supabase: SupabaseClient, userId: string): Promise<FlowKey> {
  const orgId = ONBOARDING_ORG_SCOPED ? await getActiveOrgId(supabase, userId) : null;
  return { userId, orgId, flow: ONBOARDING_FLOW };
}

/**
 * Where a user goes right after signing up / signing in. Called from the auth
 * entry points (never the middleware, which runs on every request and must
 * stay query-free). Falls back to the app root on any failure: auth must never
 * dead-end.
 */
export async function resolvePostAuthDestination(supabase: SupabaseClient, userId: string): Promise<string> {
  if (!isOnboardingEnabled) return DEFAULTS.appRoot;
  try {
    const key = await getOnboardingFlowKey(supabase, userId);
    const state = await getOnboardingState(supabase, key);
    if (state.completedAt) return DEFAULTS.appRoot;
    const progress = computeProgress(ONBOARDING_STEPS, state);
    return progress.complete ? DEFAULTS.appRoot : ONBOARDING_ROUTE;
  } catch {
    return DEFAULTS.appRoot;
  }
}
