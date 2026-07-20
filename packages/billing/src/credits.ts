import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Monthly credit grants for recurring paid plans.
 *
 * Recurring plans (`kind='recurring'`) never grant credits through the payment
 * webhook — that path only fires for `kind='credits'` plans. Without this, a
 * paying Pro/Scale org would sit at a zero balance and be unable to run a
 * single diagnosis. The amount is read from `plans.limits.credits_monthly`
 * (editable in /admin/billing), so the policy stays data-driven.
 *
 * Idempotent per org per calendar month via the transaction description, the
 * same lever the beta seed uses. Runs from a session-less context (Inngest
 * cron or an operator script), so it reads subscriptions/plans and writes
 * credit_transactions with a service-role client — the membership-gated RPCs
 * (org_credit_balance/consume_credits) cannot run here.
 */

const GRANT_KIND = "grant";

/** Month bucket in America/Sao_Paulo, so a run near midnight lands in one month. */
export function currentCreditMonth(now: Date = new Date()): string {
  // en-CA yields YYYY-MM-DD; slice to YYYY-MM.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .slice(0, 7);
}

export function monthlyGrantDescription(month: string): string {
  return `Créditos mensais do plano — ${month}`;
}

export interface MonthlyGrantResult {
  month: string;
  eligibleOrgs: number;
  granted: number;
  skipped: number;
}

interface PlanLimits {
  credits_monthly?: number;
}

/**
 * Grant `credits_monthly` to every active/trialing org on a plan that defines
 * it, once for the current month. Returns a summary; never throws for the
 * "nothing to do" case.
 */
export async function grantMonthlyCredits(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<MonthlyGrantResult> {
  const month = currentCreditMonth(now);
  const description = monthlyGrantDescription(month);

  // Active, non-suspended subscriptions and their plan's monthly credit limit.
  // Read directly (not via org_entitlements) — service role has no membership.
  const { data: subs, error: subsError } = await supabase
    .from("subscriptions")
    .select("org_id, plans(limits)")
    .eq("admin_suspended", false)
    .in("status", ["trialing", "active"]);
  if (subsError) throw new Error(`Listing subscriptions failed: ${subsError.message}`);

  // Highest monthly grant per org (an org should have one active sub, but be safe).
  const amountByOrg = new Map<string, number>();
  for (const sub of subs ?? []) {
    const plan = (sub as { plans?: { limits?: PlanLimits } | { limits?: PlanLimits }[] }).plans;
    const limits = Array.isArray(plan) ? plan[0]?.limits : plan?.limits;
    const monthly = Number(limits?.credits_monthly ?? 0);
    if (!Number.isFinite(monthly) || monthly <= 0) continue;
    const orgId = (sub as { org_id: string }).org_id;
    amountByOrg.set(orgId, Math.max(amountByOrg.get(orgId) ?? 0, monthly));
  }

  const eligibleOrgs = [...amountByOrg.keys()];
  if (eligibleOrgs.length === 0) return { month, eligibleOrgs: 0, granted: 0, skipped: 0 };

  // Orgs that already received this month's grant — one query, not N.
  const { data: existing, error: existingError } = await supabase
    .from("credit_transactions")
    .select("org_id")
    .eq("kind", GRANT_KIND)
    .eq("description", description)
    .in("org_id", eligibleOrgs);
  if (existingError) throw new Error(`Listing existing grants failed: ${existingError.message}`);
  const alreadyGranted = new Set((existing ?? []).map((r) => (r as { org_id: string }).org_id));

  const rows = eligibleOrgs
    .filter((orgId) => !alreadyGranted.has(orgId))
    .map((orgId) => ({
      org_id: orgId,
      amount: amountByOrg.get(orgId)!,
      kind: GRANT_KIND,
      description,
    }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("credit_transactions").insert(rows);
    if (insertError) throw new Error(`Granting monthly credits failed: ${insertError.message}`);
  }

  return {
    month,
    eligibleOrgs: eligibleOrgs.length,
    granted: rows.length,
    skipped: eligibleOrgs.length - rows.length,
  };
}
