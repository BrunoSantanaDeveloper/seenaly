import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A single checklist/wizard step, DEFINED IN THE DERIVED PROJECT'S CODE.
 * Only completion state is persisted (see 0011_onboarding.sql) — the label,
 * link and (optionally) a live done-predicate belong to the product.
 */
export interface OnboardingStep {
  /** Stable key stored in completed_steps — never reuse across meanings. */
  key: string;
  title: string;
  description?: string;
  /** Where the step takes the user to complete it. */
  href?: string;
  /**
   * When set, the step is considered done by live product state (e.g. "has
   * connected an ad account") regardless of the stored flag — the checklist
   * reflects reality, not just clicks. Omit to rely on completed_steps.
   */
  done?: boolean;
  /** Required steps gate the "activated" (completed_at) moment. Default: true. */
  required?: boolean;
}

export interface OnboardingStateRow {
  completedSteps: string[];
  dismissed: boolean;
  completedAt: string | null;
}

export interface FlowKey {
  userId: string;
  /** Null for personal flows; the org id for org-setup flows. */
  orgId?: string | null;
  flow: string;
}

const EMPTY: OnboardingStateRow = { completedSteps: [], dismissed: false, completedAt: null };

/** Read the persisted state for a flow (defaults when the row does not exist yet). */
export async function getOnboardingState(supabase: SupabaseClient, key: FlowKey): Promise<OnboardingStateRow> {
  const query = supabase
    .from("onboarding_state")
    .select("completed_steps, dismissed, completed_at")
    .eq("user_id", key.userId)
    .eq("flow", key.flow);
  const scoped = key.orgId ? query.eq("org_id", key.orgId) : query.is("org_id", null);
  const { data } = await scoped.maybeSingle();
  if (!data) return EMPTY;
  return {
    completedSteps: (data.completed_steps as string[]) ?? [],
    dismissed: Boolean(data.dismissed),
    completedAt: (data.completed_at as string | null) ?? null,
  };
}

async function upsert(supabase: SupabaseClient, key: FlowKey, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from("onboarding_state")
    .upsert(
      { user_id: key.userId, org_id: key.orgId ?? null, flow: key.flow, ...patch },
      { onConflict: "user_id,org_id,flow" },
    );
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/**
 * Mark a step complete. When `allRequired` is provided and every required
 * step is now done, stamps completed_at (the activation / aha moment).
 */
export async function completeStep(
  supabase: SupabaseClient,
  key: FlowKey,
  step: string,
  allRequired?: string[],
) {
  const state = await getOnboardingState(supabase, key);
  const completedSteps = state.completedSteps.includes(step)
    ? state.completedSteps
    : [...state.completedSteps, step];
  const activated =
    allRequired && allRequired.length > 0 && allRequired.every((s) => completedSteps.includes(s));
  return upsert(supabase, key, {
    completed_steps: completedSteps,
    ...(activated && !state.completedAt ? { completed_at: new Date().toISOString() } : {}),
  });
}

/** Hide the checklist card (it can be reopened — never delete the row). */
export const dismissFlow = (supabase: SupabaseClient, key: FlowKey) => upsert(supabase, key, { dismissed: true });
export const reopenFlow = (supabase: SupabaseClient, key: FlowKey) => upsert(supabase, key, { dismissed: false });

export interface FlowProgress {
  done: number;
  total: number;
  /** 0–100. */
  percent: number;
  /** First not-yet-done step — the natural next nudge. */
  nextStep: OnboardingStep | null;
  complete: boolean;
}

/** Merge step definitions with stored/live state into a progress summary. */
export function computeProgress(steps: OnboardingStep[], state: OnboardingStateRow): FlowProgress {
  const isDone = (step: OnboardingStep) => step.done ?? state.completedSteps.includes(step.key);
  const total = steps.length;
  const done = steps.filter(isDone).length;
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    nextStep: steps.find((step) => !isDone(step)) ?? null,
    complete: total > 0 && done === total,
  };
}
