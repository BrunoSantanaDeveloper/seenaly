"use server";

import { mapProductRow } from "../products/lib/map";

import { recordAudit } from "@/lib/audit";
import { isCreativePlanOutput } from "@/lib/creative-plan/schema";
import { productContextBlock } from "@/lib/diagnosis/product-brief";
import { EXPERIMENT_BRIEF_LIMIT, experimentsBlock, type ExperimentSummaryRow } from "@/lib/experiments/brief";
import {
  launchPlanAuthoritativeBlock,
  launchPlanCreativeBlock,
  type LaunchPlanHypothesisRow,
  launchPlanReadinessBlock,
  launchPlanRetrievalPlan,
} from "@/lib/launch-plan/brief";
import { failure, type LaunchPlanActionFailure } from "@/lib/launch-plan/errors";
import { learningPhaseFloor, resolveOptimizationEvent } from "@/lib/launch-plan/math";
import {
  citedLaunchPlanExcerptIndexes,
  isLaunchPlanOutput,
  LAUNCH_PLAN_JSON_SCHEMA,
  LAUNCH_PLAN_SCHEMA_NAME,
  sanitizeLaunchPlan,
} from "@/lib/launch-plan/schema";
import { evaluateReadiness, toReadinessProfile } from "@/lib/readiness/checklist";
import type { ScanSignals } from "@/lib/readiness/scan-analyze";
import { isReadinessOutput } from "@/lib/readiness/schema";
import { type AiProviderName, type AssistantConfig, getChatProvider } from "@flyee/ai";
import { createClient } from "@flyee/auth/server";
import { buildKnowledgeContext, embedQueries, resolveCollectionIds, searchKnowledge } from "@flyee/knowledge";

const ASSISTANT_SLUG = "launch-plan-engine";

export type GenerateLaunchPlanResult = { ok: true; id: string } | LaunchPlanActionFailure;

/** What a launch plan costs and what the org currently has — read BEFORE spending. */
export type LaunchPlanCreditInfo = { ok: true; balance: number; cost: number } | LaunchPlanActionFailure;

export async function getLaunchPlanCreditInfo(orgId: string): Promise<LaunchPlanCreditInfo> {
  const supabase = await createClient();
  const [{ data: assistant, error: assistantError }, { data: balance, error: balanceError }] = await Promise.all([
    supabase.from("assistants").select("credits_per_message").eq("slug", ASSISTANT_SLUG).maybeSingle(),
    supabase.rpc("org_credit_balance", { target_org: orgId }),
  ]);
  const error = assistantError ?? balanceError;
  if (error) return failure("load_failed", { detail: error.message });
  return { ok: true, balance: Number(balance ?? 0), cost: Number(assistant?.credits_per_message ?? 0) };
}

/**
 * Produce one Launch Plan for a product — docs/PRODUCT.md phase 9.
 *
 * Same engine mechanism as readiness and the creative plan: a `diagnoses` row
 * with scope = 'launch_plan'. What is different: the optimization event and
 * the budget floor are computed HERE, deterministically, from data already in
 * the database — never left to the model. See lib/launch-plan/math.ts.
 */
export async function generateLaunchPlan(productId: string): Promise<GenerateLaunchPlanResult> {
  const supabase = await createClient();

  const [
    { data: row },
    { data: objections },
    { data: proofs },
    { data: planRows },
    { data: readinessRow },
    { data: scanRow },
    { data: readinessVerdictRow },
    { data: creativePlanRow },
    { data: experimentRows },
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).maybeSingle(),
    supabase.from("product_objections").select("content").eq("product_id", productId).order("created_at"),
    supabase.from("product_proofs").select("kind, content").eq("product_id", productId).order("created_at"),
    supabase
      .from("product_plans")
      .select("name, price, period, quantity, share_pct, is_primary, sort")
      .eq("product_id", productId)
      .order("sort"),
    supabase.from("product_readiness").select("*").eq("product_id", productId).maybeSingle(),
    supabase
      .from("product_scans")
      .select("ok, result")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("diagnoses")
      .select("output")
      .eq("product_id", productId)
      .eq("scope", "readiness")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("diagnoses")
      .select("id, output")
      .eq("product_id", productId)
      .eq("scope", "creative_plan")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Experiment memory (same rationale as readiness/actions.ts): a launch
    // step already concluded must not be re-recommended.
    supabase
      .from("experiments")
      .select("title, status, hypothesis, result, conclusion, next_step")
      .eq("product_id", productId)
      .order("updated_at", { ascending: false })
      .limit(EXPERIMENT_BRIEF_LIMIT),
  ]);
  if (!row) return failure("product_not_found");
  const product = mapProductRow(row, { objections: objections ?? [], proofs: proofs ?? [], plans: planRows ?? [] });

  const profile = toReadinessProfile(readinessRow as Record<string, unknown> | null);
  const signals = scanRow?.ok ? (scanRow.result as ScanSignals) : null;
  const evaluation = evaluateReadiness(profile, {
    hasLandingPage: Boolean(product.landingPageUrl),
    hasPrice: product.price != null || (product.plans?.some((plan) => plan.price != null) ?? false),
    signals,
  });
  const readinessVerdict =
    readinessVerdictRow && isReadinessOutput(readinessVerdictRow.output) ? readinessVerdictRow.output : null;

  // The two authoritative facts (docs/PRODUCT.md: "o piso de orçamento é
  // aritmética, não opinião") — computed here, never left to the model.
  const eventResolution = resolveOptimizationEvent({
    declaredEvent: product.optimizationEvent || null,
    conversionEventTested: Boolean(readinessRow) && profile.conversionEventTested,
    pixelProved: evaluation.verified.includes("pixelInstalled"),
    hasReadiness: Boolean(readinessRow),
  });
  const floor = learningPhaseFloor({
    targetCac: product.targetCac,
    monthlyBudget: product.monthlyBudget,
    currency: product.currency || null,
    eventBasis: eventResolution.basis,
    eventLabel: eventResolution.event,
  });

  // Creative Test Plan hypotheses + their REAL coverage — presence, not
  // performance, same invariant every engine here respects.
  let hypothesisRows: LaunchPlanHypothesisRow[] = [];
  let validHypothesisKeys: string[] = [];
  if (creativePlanRow && isCreativePlanOutput(creativePlanRow.output)) {
    const output = creativePlanRow.output;
    validHypothesisKeys = output.hypotheses.map((h) => h.key);
    const { data: links } = await supabase
      .from("creative_plan_links")
      .select("hypothesis_key, creative_id")
      .eq("diagnosis_id", creativePlanRow.id as string);
    const linkRows = (links ?? []) as { hypothesis_key: string; creative_id: string }[];
    const creativeIds = linkRows.map((link) => link.creative_id);
    const organicCounts = new Map<string, number>();
    if (creativeIds.length > 0) {
      const { data: publications } = await supabase
        .from("organic_content_items")
        .select("creative_id")
        .in("creative_id", creativeIds)
        .limit(1000);
      for (const publication of (publications ?? []) as { creative_id: string | null }[]) {
        if (!publication.creative_id) continue;
        organicCounts.set(publication.creative_id, (organicCounts.get(publication.creative_id) ?? 0) + 1);
      }
    }
    hypothesisRows = output.hypotheses.map((h) => {
      const link = linkRows.find((entry) => entry.hypothesis_key === h.key);
      return {
        key: h.key,
        angle: h.angle,
        format: h.format,
        funnel_stage: h.funnel_stage,
        content_count: h.content_count,
        organic_count: link ? (organicCounts.get(link.creative_id) ?? 0) : 0,
      };
    });
  }

  // Subscription gate. Credits are only DEBITED after a valid plan — the
  // record RPC below makes "persist + charge" one transaction.
  const { data: entitlements, error: entitlementsError } = await supabase.rpc("org_entitlements", {
    target_org: product.orgId,
  });
  if (entitlementsError) return failure("load_failed", { detail: entitlementsError.message });
  const ent = entitlements as { active?: boolean; suspended?: boolean; credit_balance?: number } | null;
  if (!ent?.active) return failure(ent?.suspended ? "subscription_suspended" : "no_subscription");

  const { data: assistant } = await supabase
    .from("assistants")
    .select("slug, provider, model, system_prompt, temperature, max_tokens, credits_per_message, config")
    .eq("slug", ASSISTANT_SLUG)
    .eq("is_active", true)
    .maybeSingle();
  if (!assistant) return failure("assistant_unavailable");

  if (assistant.credits_per_message > 0 && (ent.credit_balance ?? 0) < assistant.credits_per_message) {
    return failure("insufficient_credits", { balance: ent.credit_balance ?? 0, cost: assistant.credits_per_message });
  }

  // In-flight lock (migration 0046, mirrors readiness's 0040): two tabs must
  // not pay for two plans. FAIL OPEN on RPC errors — the lock is cost control,
  // never a gate on the product's value.
  const { data: claimed, error: claimError } = await supabase.rpc("claim_launch_plan_run", {
    target_product: productId,
  });
  if (!claimError && claimed === false) return failure("generation_in_progress");

  try {
    const plan = launchPlanRetrievalPlan();
    const excerpts: Awaited<ReturnType<typeof searchKnowledge>> = [];
    try {
      const [metaIds, playbookIds, vectors] = await Promise.all([
        resolveCollectionIds(supabase, ["meta-ads-docs"]),
        resolveCollectionIds(supabase, ["growth-playbook"]),
        embedQueries(plan.map((query) => query.text)),
      ]);
      const searches = plan.flatMap((query, index) => {
        const vector = vectors[index];
        const perCorpus: [string[], number][] = [
          [metaIds, query.meta],
          [playbookIds, query.playbook],
        ];
        return perCorpus
          .filter(([ids, count]) => ids.length > 0 && count > 0)
          .map(([collectionIds, matchCount]) =>
            searchKnowledge(supabase, vector, { collectionIds, matchCount, maxPerDocument: 1, queryText: query.text }),
          );
      });
      for (const batch of await Promise.all(searches)) excerpts.push(...batch);
    } catch (error) {
      return failure("knowledge_failed", { detail: (error as Error).message });
    }

    if (excerpts.length === 0) {
      return failure("knowledge_empty", { detail: `queries: ${plan.map((query) => query.key).join(", ")}` });
    }

    const seenChunks = new Set<string>();
    const uniqueExcerpts = excerpts.filter((excerpt) => {
      if (seenChunks.has(excerpt.chunk_id)) return false;
      seenChunks.add(excerpt.chunk_id);
      return true;
    });

    const brief = [
      "## Contexto do produto",
      productContextBlock(product),
      "",
      "## Prontidão deste produto (o que foi provado versus apenas declarado)",
      launchPlanReadinessBlock(evaluation, readinessVerdict),
      "",
      "## Evidência criativa disponível (Plano de Teste Criativo)",
      launchPlanCreativeBlock(hypothesisRows),
      "",
      launchPlanAuthoritativeBlock(eventResolution, floor),
      "",
      "## Memória de experimentos",
      experimentsBlock((experimentRows as ExperimentSummaryRow[]) ?? []),
      buildKnowledgeContext(uniqueExcerpts),
      "",
      "## Tarefa",
      "Escreva a menor aposta paga que produz aprendizado confiável para este produto, seguindo exatamente o schema.",
      "Reproduza os números autoritativos do bloco acima sem recalculá-los. Se viable=false no bloco, explique 'não comece ainda' e o que mudaria isso, em vez de fabricar uma estrutura.",
      "Construa sobre a memória de experimentos: não recomende de novo uma etapa cujo experimento já está CONCLUÍDO.",
      "Ancore cada evidência em product_context, meta_docs ou growth_playbook. Nunca invente números.",
    ].join("\n");

    const config: AssistantConfig = {
      provider: assistant.provider as AiProviderName,
      model: assistant.model,
      systemPrompt: assistant.system_prompt,
      temperature: Number(assistant.temperature),
      maxTokens: assistant.max_tokens,
    };

    let output: unknown;
    try {
      output = await getChatProvider(config.provider).generateStructured(config, [{ role: "user", content: brief }], {
        name: LAUNCH_PLAN_SCHEMA_NAME,
        description: "Plano de Lançamento estruturado do Seenaly.",
        schema: LAUNCH_PLAN_JSON_SCHEMA,
      });
    } catch (error) {
      return failure("engine_failed", { detail: (error as Error).message });
    }
    if (!isLaunchPlanOutput(output)) return failure("engine_malformed");

    const sanitized = sanitizeLaunchPlan(output, { optimizationEvent: eventResolution, floor, validHypothesisKeys });
    const cited = citedLaunchPlanExcerptIndexes(sanitized, uniqueExcerpts.length);

    const reviewDays =
      typeof sanitized.next_review_days === "number" && sanitized.next_review_days > 0
        ? Math.min(30, Math.round(sanitized.next_review_days))
        : null;
    const nextReviewAt = reviewDays ? new Date(Date.now() + reviewDays * 24 * 60 * 60 * 1000).toISOString() : null;

    const { data: recorded, error: recordError } = await supabase.rpc("record_diagnosis_and_charge", {
      target_org: product.orgId,
      target_product: product.id,
      p_scope: "launch_plan",
      p_assistant_slug: assistant.slug,
      p_model: assistant.model,
      p_output: sanitized,
      p_confidence: sanitized.confidence,
      p_insufficient_data: sanitized.insufficient_data,
      // Launch plan never reads media data — that is the whole point.
      p_had_campaign_data: false,
      p_knowledge_refs: uniqueExcerpts.map((excerpt, index) => ({
        title: excerpt.title,
        source: excerpt.source,
        trust_level: excerpt.trust_level,
        similarity: excerpt.similarity,
        used: cited.has(index + 1),
      })),
      p_reason: `Plano de Lançamento — ${product.name}`,
      p_next_review_at: nextReviewAt,
    });
    if (recordError) return failure("save_failed", { detail: recordError.message });
    const payload = recorded as {
      ok?: boolean;
      code?: string;
      id?: string;
      charged?: number;
      balance?: number;
      cost?: number;
    } | null;
    if (!payload?.ok) {
      if (payload?.code === "insufficient_credits") {
        return failure("insufficient_credits", {
          balance: Number(payload.balance ?? ent.credit_balance ?? 0),
          cost: Number(payload.cost ?? assistant.credits_per_message ?? 0),
        });
      }
      return failure("save_failed");
    }

    await recordAudit(supabase, "launch_plan.generated", {
      orgId: product.orgId,
      entityType: "diagnosis",
      entityId: payload.id as string,
      metadata: {
        viable: sanitized.viable,
        optimization_event_basis: sanitized.optimization_event.basis,
        adset_count: sanitized.budget.adset_count,
        credits: Number(payload.charged ?? 0),
      },
    });

    return { ok: true, id: payload.id as string };
  } finally {
    if (!claimError) {
      await supabase.rpc("release_launch_plan_run", { target_product: productId });
    }
  }
}
