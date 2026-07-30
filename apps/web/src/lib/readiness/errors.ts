/**
 * Stable error codes for every readiness server action.
 *
 * The contract: a failed action returns `{ ok: false, code, detail? }` — the
 * CODE is the message (translated by the client from the `readiness.error-*`
 * catalog keys, present in all five locales), and `detail` carries the raw
 * upstream text (Postgres, provider, fetch) as a secondary technical line the
 * user can screenshot for support. Server code never ships a user-facing
 * pt-BR literal again; matching on message strings is forbidden (and now
 * impossible).
 *
 * Pure module by design — zero imports — so scripts/test-readiness.mts can
 * enforce catalog coverage for every code without pulling server code.
 */

export const READINESS_ERROR_CODES = [
  "session_expired",
  "product_not_found",
  "no_landing_page",
  "invalid_item",
  "assist_unavailable",
  "no_subscription",
  "subscription_suspended",
  "insufficient_credits",
  "assistant_unavailable",
  "verdict_not_found",
  "not_readiness_verdict",
  "verdict_malformed",
  "finding_not_found",
  "knowledge_failed",
  "engine_failed",
  "engine_malformed",
  "save_failed",
  "load_failed",
  /** The page was read moments ago — guidance (info), never a red error. */
  "scan_cooldown",
  /** Another generation for this product is running — guidance, not error. */
  "generation_in_progress",
] as const;

export type ReadinessErrorCode = (typeof READINESS_ERROR_CODES)[number];

/** The uniform failure half of every readiness action result. */
export interface ReadinessActionFailure {
  ok: false;
  code: ReadinessErrorCode;
  /** Raw upstream message (Postgres/provider/fetch), for the technical line. */
  detail?: string;
  /** insufficient_credits only: what the org has vs. what this costs. */
  balance?: number;
  cost?: number;
  /** scan_cooldown only: when the next scan becomes possible. */
  retryAfterSeconds?: number;
}

export const failure = (
  code: ReadinessErrorCode,
  extra?: Omit<ReadinessActionFailure, "ok" | "code">,
): ReadinessActionFailure => ({ ok: false, code, ...extra });
