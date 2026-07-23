"use server";

import type { ExperimentInput } from "./types";

import type { DiagnosisOutput } from "@/lib/diagnosis/schema";
import { isReadinessOutput } from "@/lib/readiness/schema";
import { createClient } from "@flyee/auth/server";

export type SaveResult = { ok: true; id: string; justConcluded?: boolean } | { ok: false; error: string };
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
  // A transition INTO concluded is the moment the experiment memory changed —
  // the best time to nudge a fresh diagnosis that builds on the new learning.
  let justConcluded = false;
  if (experimentId) {
    const { data: prior } = await supabase.from("experiments").select("status").eq("id", experimentId).maybeSingle();
    const { error } = await supabase.from("experiments").update(row).eq("id", experimentId);
    if (error) return { ok: false, error: error.message };
    justConcluded = input.status === "concluded" && prior?.status !== "concluded";
  } else {
    const { data: user } = await supabase.auth.getUser();
    const { data: created, error } = await supabase
      .from("experiments")
      .insert({ ...row, created_by: user.user?.id ?? null })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: error?.message ?? "Falha ao salvar o experimento." };
    experimentId = created.id as string;
    justConcluded = input.status === "concluded";
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

  return { ok: true, id: experimentId, justConcluded };
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

  // Idempotent: registering the same diagnosis twice (double click, back
  // navigation) must reuse the experiment instead of duplicating the journal.
  const { data: existing, error: existingError } = await supabase
    .from("experiments")
    .select("id")
    .eq("diagnosis_id", diagnosis.id)
    .limit(1)
    .maybeSingle();
  if (existingError) return { ok: false, error: existingError.message };
  if (existing) return { ok: true, id: existing.id as string };

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

/**
 * Turn ONE finding of a readiness verdict into a tracked experiment.
 *
 * This closes the readiness loop the same way `registerExperimentFromDiagnosis`
 * closes the campaign one: a recommendation nobody tracks teaches nothing, and
 * the experiment memory is what makes the engine an expert in THIS account
 * (docs/PRODUCT.md — the key differentiator).
 *
 * Per FINDING, not per verdict: a verdict carries up to seven independent fixes
 * ("install the pixel", "add PIX at checkout") and collapsing them into one
 * experiment would destroy the very learning the memory exists to keep.
 *
 * Idempotency uses (diagnosis_id, change_made) rather than a new column: the
 * finding's recommended action already identifies it, so a double click reuses
 * the experiment. Two findings that genuinely recommend the same action SHOULD
 * collapse — that is one piece of work, not two.
 */
export async function registerExperimentFromReadinessFinding(
  verdictId: string,
  findingIndex: number,
): Promise<SaveResult> {
  const supabase = await createClient();
  const { data: verdict, error } = await supabase
    .from("diagnoses")
    .select("id, org_id, product_id, output, scope")
    .eq("id", verdictId)
    .maybeSingle();
  if (error || !verdict) return { ok: false, error: error?.message ?? "Veredito não encontrado." };
  if (verdict.scope !== "readiness") return { ok: false, error: "Este registro não é um veredito de prontidão." };

  const output = verdict.output;
  if (!isReadinessOutput(output)) return { ok: false, error: "O veredito está fora do formato esperado." };
  const finding = output.findings[findingIndex];
  if (!finding) return { ok: false, error: "Achado não encontrado no veredito." };

  const changeMade = finding.recommended_action;
  const { data: existing, error: existingError } = await supabase
    .from("experiments")
    .select("id")
    .eq("diagnosis_id", verdict.id)
    .eq("change_made", changeMade)
    .limit(1)
    .maybeSingle();
  if (existingError) return { ok: false, error: existingError.message };
  if (existing) return { ok: true, id: existing.id as string };

  const { data: user } = await supabase.auth.getUser();
  const { data: created, error: insertError } = await supabase
    .from("experiments")
    .insert({
      org_id: verdict.org_id,
      product_id: verdict.product_id,
      diagnosis_id: verdict.id,
      title: changeMade.slice(0, 80),
      status: "planned",
      // The finding states what is wrong; that IS the hypothesis being acted on.
      hypothesis: finding.finding,
      change_made: changeMade,
      reason: `Prontidão — ${finding.dimension} (impacto ${finding.impact}, esforço ${finding.effort})`,
      primary_metric: finding.success_criterion,
      created_by: user.user?.id ?? null,
    })
    .select("id")
    .single();
  if (insertError || !created) return { ok: false, error: insertError?.message ?? "Falha ao registrar o experimento." };
  return { ok: true, id: created.id as string };
}
