/**
 * Stable error codes for every Launch Plan server action — mirrors
 * `lib/readiness/errors.ts` exactly (same contract: a failed action returns
 * `{ ok: false, code, detail? }`, the client translates CODE via the
 * `launchPlan.error-*` catalog keys, `detail` is a raw technical line).
 *
 * Pure module by design — zero imports — so scripts/test-launch-plan.mts can
 * enforce catalog coverage without pulling server code.
 */

export const LAUNCH_PLAN_ERROR_CODES = [
  "product_not_found",
  "no_subscription",
  "subscription_suspended",
  "insufficient_credits",
  "assistant_unavailable",
  "plan_not_found",
  "not_launch_plan",
  "plan_malformed",
  "step_not_found",
  "knowledge_failed",
  "knowledge_empty",
  "engine_failed",
  "engine_malformed",
  "save_failed",
  "load_failed",
  /** Another generation for this product is running — guidance, not error. */
  "generation_in_progress",
] as const;

export type LaunchPlanErrorCode = (typeof LAUNCH_PLAN_ERROR_CODES)[number];

export interface LaunchPlanActionFailure {
  ok: false;
  code: LaunchPlanErrorCode;
  detail?: string;
  /** insufficient_credits only: what the org has vs. what this costs. */
  balance?: number;
  cost?: number;
}

export const failure = (
  code: LaunchPlanErrorCode,
  extra?: Omit<LaunchPlanActionFailure, "ok" | "code">,
): LaunchPlanActionFailure => ({ ok: false, code, ...extra });
