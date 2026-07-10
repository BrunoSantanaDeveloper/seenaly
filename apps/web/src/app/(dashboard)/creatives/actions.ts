"use server";

import type { CreativeInput } from "./types";

import { createClient } from "@flyee/auth/server";

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Create or update a creative. RLS enforces that the caller is a member of
 * input.orgId; no service role. The product it belongs to is fixed at creation.
 */
export async function saveCreative(input: CreativeInput): Promise<SaveResult> {
  const supabase = await createClient();
  if (!input.name.trim()) return { ok: false, error: "O nome do criativo é obrigatório." };

  const row = {
    org_id: input.orgId,
    product_id: input.productId,
    name: input.name.trim(),
    status: input.status,
    source: input.source,
    connection_id: input.connectionId,
    meta_creative_id: input.metaCreativeId || null,
    format: input.format || null,
    funnel_stage: input.funnelStage || null,
    duration_seconds: input.durationSeconds,
    thumbnail_url: input.thumbnailUrl || null,
    angle: input.angle || null,
    promise: input.promise || null,
    pain: input.pain || null,
    desire: input.desire || null,
    objection: input.objection || null,
    hook: input.hook || null,
    first_scene: input.firstScene || null,
    cta: input.cta || null,
    proof_type: input.proofType || null,
    visual_style: input.visualStyle || null,
    emotion: input.emotion || null,
    presumed_audience: input.presumedAudience || null,
    result_summary: input.resultSummary || null,
    notes: input.notes || null,
  };

  if (input.id) {
    const { error } = await supabase.from("creatives").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: input.id };
  }

  const { data: user } = await supabase.auth.getUser();
  const { data: created, error } = await supabase
    .from("creatives")
    .insert({ ...row, created_by: user.user?.id ?? null })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: error?.message ?? "Falha ao salvar o criativo." };
  return { ok: true, id: created.id as string };
}

/** Delete a creative. RLS enforces org membership. */
export async function deleteCreative(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("creatives").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
