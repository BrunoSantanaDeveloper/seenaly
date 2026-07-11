"use server";

import type { ExperimentInput } from "./types";

import type { DiagnosisOutput } from "@/lib/diagnosis/schema";
import { createClient } from "@flyee/auth/server";

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Create or update an experiment and replace its creative links. RLS enforces
 * that the caller is a member of input.orgId; no service role.
 */
export async function saveExperiment(input: ExperimentInput): Promise<SaveResult> {
  const supabase = await createClient();
  if (!input.title.trim()) return { ok: false, error: "O título do experimento é obrigatório." };

  const row = {
    org_id: input.orgId,
    product_id: input.productId,
    diagnosis_id: input.diagnosisId,
    title: input.title.trim(),
    status: input.status,
    hypothesis: input.hypothesis || null,
    change_made: input.changeMade || null,
    reason: input.reason || null,
    period_start: input.periodStart || null,
    period_end: input.periodEnd || null,
    budget: input.budget,
    primary_metric: input.primaryMetric || null,
    secondary_metric: input.secondaryMetric || null,
    result: input.result || null,
    conclusion: input.conclusion || null,
    next_step: input.nextStep || null,
    notes: input.notes || null,
  };

  let experimentId = input.id;
  if (experimentId) {
    const { error } = await supabase.from("experiments").update(row).eq("id", experimentId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: user } = await supabase.auth.getUser();
    const { data: created, error } = await supabase
      .from("experiments")
      .insert({ ...row, created_by: user.user?.id ?? null })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: error?.message ?? "Falha ao salvar o experimento." };
    experimentId = created.id as string;
  }

  // Replace the creative links (small, fully-owned set).
  const { error: delError } = await supabase.from("experiment_creatives").delete().eq("experiment_id", experimentId);
  if (delError) return { ok: false, error: delError.message };
  const creativeIds = [...new Set(input.creativeIds)].filter(Boolean);
  if (creativeIds.length > 0) {
    const { error } = await supabase
      .from("experiment_creatives")
      .insert(creativeIds.map((creativeId) => ({ experiment_id: experimentId, creative_id: creativeId })));
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true, id: experimentId };
}

/** Delete an experiment (creative links cascade). RLS enforces org membership. */
export async function deleteExperiment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("experiments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Close the loop: turn a diagnosis into a planned experiment, pre-filling the
 * hypothesis, change and success criterion from the recommendation. Returns
 * the new experiment id so the UI can open it for editing.
 */
export async function registerExperimentFromDiagnosis(diagnosisId: string): Promise<SaveResult> {
  const supabase = await createClient();
  const { data: diagnosis, error } = await supabase
    .from("diagnoses")
    .select("id, org_id, product_id, output")
    .eq("id", diagnosisId)
    .maybeSingle();
  if (error || !diagnosis) return { ok: false, error: error?.message ?? "Diagnóstico não encontrado." };

  const output = diagnosis.output as DiagnosisOutput;
  const { data: user } = await supabase.auth.getUser();
  const { data: created, error: insertError } = await supabase
    .from("experiments")
    .insert({
      org_id: diagnosis.org_id,
      product_id: diagnosis.product_id,
      diagnosis_id: diagnosis.id,
      title: output.recommended_action.slice(0, 80),
      status: "planned",
      hypothesis: output.hypothesis,
      change_made: output.recommended_action,
      // The diagnosis' success criterion is the experiment's primary metric target.
      primary_metric: output.success_criterion,
      next_step: output.next_review,
      created_by: user.user?.id ?? null,
    })
    .select("id")
    .single();
  if (insertError || !created) return { ok: false, error: insertError?.message ?? "Falha ao registrar o experimento." };
  return { ok: true, id: created.id as string };
}
