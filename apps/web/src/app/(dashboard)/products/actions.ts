"use server";

import type { ProductInput } from "./types";

import { createClient } from "@flyee/auth/server";

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Create or update a product and replace its objection/proof lists.
 * RLS enforces that the caller is a member of input.orgId; no service role.
 */
export async function saveProduct(input: ProductInput): Promise<SaveResult> {
  const supabase = await createClient();

  if (!input.name.trim()) return { ok: false, error: "Product name is required." };

  const row = {
    org_id: input.orgId,
    name: input.name.trim(),
    status: input.status,
    description: input.description || null,
    currency: input.currency || null,
    price: input.price,
    unit_cost: input.unitCost,
    margin_pct: input.marginPct,
    avg_ticket: input.avgTicket,
    ltv: input.ltv,
    target_cac: input.targetCac,
    monthly_budget: input.monthlyBudget,
    conversion_type: input.conversionType || null,
    funnel_stage: input.funnelStage || null,
    audience: input.audience || null,
    main_promise: input.mainPromise || null,
    landing_page_url: input.landingPageUrl || null,
    landing_conversion_rate: input.landingConversionRate,
    optimization_event: input.optimizationEvent || null,
    notes: input.notes || null,
    connection_id: input.connectionId,
    meta_account_id: input.metaAccountId || null,
    pricing_model: input.pricingModel || null,
    pricing_inputs: input.pricingInputs ?? {},
  };

  let productId = input.id;

  if (productId) {
    const { error } = await supabase.from("products").update(row).eq("id", productId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: user } = await supabase.auth.getUser();
    const { data: created, error } = await supabase
      .from("products")
      .insert({ ...row, created_by: user.user?.id ?? null })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: error?.message ?? "Insert failed." };
    productId = created.id as string;
  }

  // Replace child lists (simplest correct model for a small, fully-owned set).
  const [{ error: objDelError }, { error: proofDelError }, { error: planDelError }] = await Promise.all([
    supabase.from("product_objections").delete().eq("product_id", productId),
    supabase.from("product_proofs").delete().eq("product_id", productId),
    supabase.from("product_plans").delete().eq("product_id", productId),
  ]);
  if (objDelError) return { ok: false, error: objDelError.message };
  if (proofDelError) return { ok: false, error: proofDelError.message };
  if (planDelError) return { ok: false, error: planDelError.message };

  // Pricing rows (tiers / packs / ladder items) — a row counts once it has a price.
  const plans = (input.plans ?? []).filter((plan) => plan.price !== null || plan.name.trim());
  if (plans.length > 0) {
    const { error } = await supabase.from("product_plans").insert(
      plans.map((plan, index) => ({
        product_id: productId,
        name: plan.name.trim() || null,
        price: plan.price,
        period: plan.period || null,
        quantity: plan.quantity,
        share_pct: plan.sharePct,
        is_primary: plan.isPrimary,
        sort: index,
      })),
    );
    if (error) return { ok: false, error: error.message };
  }

  const objections = input.objections.map((content) => content.trim()).filter(Boolean);
  if (objections.length > 0) {
    const { error } = await supabase
      .from("product_objections")
      .insert(objections.map((content) => ({ product_id: productId, content })));
    if (error) return { ok: false, error: error.message };
  }

  const proofs = input.proofs
    .map((proof) => ({ kind: proof.kind.trim(), content: proof.content.trim() }))
    .filter((proof) => proof.content);
  if (proofs.length > 0) {
    const { error } = await supabase
      .from("product_proofs")
      .insert(proofs.map((proof) => ({ product_id: productId, kind: proof.kind || null, content: proof.content })));
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true, id: productId };
}

/** Delete a product (children cascade). RLS enforces org membership. */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
