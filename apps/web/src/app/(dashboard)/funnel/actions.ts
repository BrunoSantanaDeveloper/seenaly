"use server";

import type { FunnelInput } from "./types";

import { createClient } from "@flyee/auth/server";

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Create or update a funnel snapshot. RLS enforces that the caller is a member
 * of input.orgId; no service role.
 */
export async function saveFunnelSnapshot(input: FunnelInput): Promise<SaveResult> {
  const supabase = await createClient();

  const row = {
    org_id: input.orgId,
    product_id: input.productId,
    label: input.label || null,
    period_start: input.periodStart || null,
    period_end: input.periodEnd || null,
    source: input.source || null,
    visits: input.visits,
    checkout_initiated: input.checkoutInitiated,
    purchases: input.purchases,
    refunds: input.refunds,
    pending: input.pending,
    upsells: input.upsells,
    gross_revenue: input.grossRevenue,
    net_revenue: input.netRevenue,
    notes: input.notes || null,
  };

  if (input.id) {
    const { error } = await supabase.from("funnel_snapshots").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: input.id };
  }

  const { data: user } = await supabase.auth.getUser();
  const { data: created, error } = await supabase
    .from("funnel_snapshots")
    .insert({ ...row, created_by: user.user?.id ?? null })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: error?.message ?? "Falha ao salvar o snapshot." };
  return { ok: true, id: created.id as string };
}

/** Delete a funnel snapshot. RLS enforces org membership. */
export async function deleteFunnelSnapshot(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("funnel_snapshots").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
