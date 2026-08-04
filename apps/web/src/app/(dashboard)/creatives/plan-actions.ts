"use server";

import { mapProductRow } from "../products/lib/map";

import { recordAudit } from "@/lib/audit";
import {
  creativeEvidenceBlock,
  planCohortBlock,
  planCreativesBlock,
  planOrganicBlock,
  type PlanOrganicPresence,
  planRetrievalQuery,
} from "@/lib/creative-plan/brief";
import { loadCreativeEvidence } from "@/lib/creative-plan/evidence";
import {
  CREATIVE_PLAN_JSON_SCHEMA,
  CREATIVE_PLAN_SCHEMA_NAME,
  type CreativePlanOutput,
  isCreativePlanOutput,
  sanitizeCreativePlan,
} from "@/lib/creative-plan/schema";
import { productContextBlock } from "@/lib/diagnosis/product-brief";
import { type AiProviderName, type AssistantConfig, getChatProvider } from "@flyee/ai";
import { createClient } from "@flyee/auth/server";
import { buildKnowledgeContext, embedQuery, resolveCollectionIds, searchKnowledge } from "@flyee/knowledge";

const ASSISTANT_SLUG = "creative-plan-engine";

export type GeneratePlanResult =
  | { ok: true; id: string }
  // `code` lets the UI turn a dead-end message into an actionable one instead
  // of the user guessing. Never detect this by matching the message string.
  | { ok: false; error: string; code?: "insufficient_credits" | "no_subscription"; balance?: number; cost?: number };

/** What a plan costs and what the org currently has — shown BEFORE spending. */
export type PlanCreditInfo = { ok: true; balance: number; cost: number } | { ok: false; error: string };

export async function getCreativePlanCreditInfo(orgId: string): Promise<PlanCreditInfo> {
  const supabase = await createClient();
  const [{ data: assistant, error: assistantError }, { data: balance, error: balanceError }] = await Promise.all([
    supabase.from("assistants").select("credits_per_message").eq("slug", ASSISTANT_SLUG).maybeSingle(),
    supabase.rpc("org_credit_balance", { target_org: orgId }),
  ]);
  const error = assistantError ?? balanceError;
  if (error) return { ok: false, error: error.message };
  return { ok: true, balance: Number(balance ?? 0), cost: Number(assistant?.credits_per_message ?? 0) };
}

/** Exposed for the paid diagnosis briefing (fase C). */
export async function buildCreativeEvidenceBlock(productId: string): Promise<string> {
  const supabase = await createClient();
  return creativeEvidenceBlock(await loadCreativeEvidence(supabase, productId));
}

/**
 * Produce one Creative Test Plan for a product.
 *
 * This is the SAME engine mechanism as `/diagnosis` and `/readiness`, pointed
 * at the CREATIVE EVIDENCE: same assistant row, same knowledge base, same
 * credit policy, and the plan is stored in `diagnoses` with
 * `scope = 'creative_plan'`. Zero-data by construction — a beginner with an
 * empty library is exactly who it serves (docs/PRODUCT.md phase 8).
 */
export async function generateCreativePlan(productId: string): Promise<GeneratePlanResult> {
  const supabase = await createClient();

  const [
    { data: row },
    { data: objections },
    { data: proofs },
    { data: planRows },
    { data: organicLinks },
    { data: organicReview },
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).maybeSingle(),
    supabase.from("product_objections").select("content").eq("product_id", productId).order("created_at"),
    supabase.from("product_proofs").select("kind, content").eq("product_id", productId).order("created_at"),
    supabase
      .from("product_plans")
      .select("name, price, period, quantity, share_pct, is_primary, sort")
      .eq("product_id", productId)
      .order("sort"),
    supabase
      .from("organic_content_products")
      .select("content_id, organic_content_items(platform, published_at)")
      .eq("product_id", productId)
      .limit(200),
    supabase
      .from("organic_reviews")
      .select("period_end, insufficient_data")
      .eq("product_id", productId)
      .eq("status", "completed")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!row) return { ok: false, error: "Produto não encontrado." };
  const product = mapProductRow(row, {
    objections: objections ?? [],
    proofs: proofs ?? [],
    plans: planRows ?? [],
  });

  const creatives = await loadCreativeEvidence(supabase, productId);

  // PostgREST returns an embedded resource as an ARRAY, even for a to-one
  // relationship — flatten it rather than assuming a single object.
  const organicRows = (organicLinks ?? []) as {
    organic_content_items: { platform: string | null; published_at: string | null }[] | null;
  }[];
  const organicItems = organicRows.flatMap((link) => link.organic_content_items ?? []);
  const publishedDates = organicItems
    .map((item) => item.published_at)
    .filter((value): value is string => Boolean(value))
    .sort();
  const organic: PlanOrganicPresence = {
    contentCount: organicRows.length,
    platforms: [...new Set(organicItems.map((item) => item.platform).filter((p): p is string => Boolean(p)))],
    latestPublishedAt: publishedDates.at(-1) ?? null,
    hasReview: Boolean(organicReview),
    reviewInsufficientData: (organicReview?.insufficient_data as boolean | null) ?? null,
  };

  // Subscription gate. Credits are only DEBITED after a valid plan — a failed
  // RAG/LLM call must never charge the user.
  const { data: entitlements, error: entitlementsError } = await supabase.rpc("org_entitlements", {
    target_org: product.orgId,
  });
  if (entitlementsError) return { ok: false, error: entitlementsError.message };
  const ent = entitlements as { active?: boolean; suspended?: boolean; credit_balance?: number } | null;
  if (!ent?.active) {
    return {
      ok: false,
      code: "no_subscription",
      error: ent?.suspended
        ? "Assinatura suspensa — fale com o suporte."
        : "Nenhuma assinatura ativa para esta organização.",
    };
  }

  const { data: assistant } = await supabase
    .from("assistants")
    .select("slug, provider, model, system_prompt, temperature, max_tokens, credits_per_message, config")
    .eq("slug", ASSISTANT_SLUG)
    .eq("is_active", true)
    .maybeSingle();
  if (!assistant) return { ok: false, error: `Assistente "${ASSISTANT_SLUG}" não encontrado ou inativo.` };

  if (assistant.credits_per_message > 0 && (ent.credit_balance ?? 0) < assistant.credits_per_message) {
    return {
      ok: false,
      code: "insufficient_credits",
      balance: ent.credit_balance ?? 0,
      cost: assistant.credits_per_message,
      error: "Créditos insuficientes para gerar o plano de teste criativo.",
    };
  }

  // Ground in the knowledge base, per collection (same reason as the other
  // engines): the large trust-1 Meta corpus would otherwise crowd out the
  // growth playbook, which carries the creative-craft knowledge.
  const knowledgeConfig = (assistant.config as { knowledge?: { collections?: string[]; matchCount?: number } })
    ?.knowledge;
  const collectionSlugs = knowledgeConfig?.collections ?? ["growth-playbook", "meta-ads-docs"];
  const matchCount = knowledgeConfig?.matchCount ?? 8;
  const perCollection = Math.max(2, Math.ceil(matchCount / Math.max(collectionSlugs.length, 1)));
  const excerpts: Awaited<ReturnType<typeof searchKnowledge>> = [];
  try {
    const query = planRetrievalQuery();
    // The query is a constant, so its vector is too — embed once and reuse it
    // across collections instead of paying the API per slug.
    const embedding = await embedQuery(query);
    for (const slug of collectionSlugs) {
      const collectionIds = await resolveCollectionIds(supabase, [slug]);
      if (collectionIds.length === 0) continue;
      excerpts.push(...(await searchKnowledge(supabase, embedding, { collectionIds, matchCount: perCollection })));
    }
  } catch (error) {
    return { ok: false, error: `Falha ao consultar a base de conhecimento: ${(error as Error).message}` };
  }

  // Same rule as the other two engines: an empty retrieval is an operational
  // fault, and a plan written without a single retrieved excerpt is a generic
  // plan wearing the costume of a grounded one.
  if (excerpts.length === 0) {
    return {
      ok: false,
      error: "A base de conhecimento não retornou nenhum trecho. Sem base, o plano seria genérico — nada foi cobrado.",
    };
  }

  const brief = [
    "## Contexto do produto",
    productContextBlock(product),
    "",
    "## Evidência criativa atual (biblioteca)",
    planCreativesBlock(creatives),
    "",
    "## Presença orgânica deste produto",
    planOrganicBlock(organic),
    "",
    "## Regra de volume",
    planCohortBlock(),
    buildKnowledgeContext(excerpts),
    "",
    "## Tarefa",
    "Monte o plano de teste criativo orgânico deste produto e devolva o objeto JSON.",
    "Cada hipótese deve nomear ângulo, gancho e prova ESPECÍFICOS deste produto — nada genérico.",
    "Cubra lacunas de evidência; não repita o que a biblioteca já tem com leitura.",
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
      name: CREATIVE_PLAN_SCHEMA_NAME,
      description: "Plano de teste criativo estruturado do Seenaly.",
      schema: CREATIVE_PLAN_JSON_SCHEMA,
    });
  } catch (error) {
    return { ok: false, error: `O motor falhou ao gerar o plano: ${(error as Error).message}` };
  }

  if (!isCreativePlanOutput(output)) {
    return { ok: false, error: "O motor devolveu um plano fora do formato exigido." };
  }
  const plan = sanitizeCreativePlan(output);

  // Charge now — only a valid plan costs credits.
  if (assistant.credits_per_message > 0) {
    const { error: creditError } = await supabase.rpc("consume_credits", {
      target_org: product.orgId,
      amount: assistant.credits_per_message,
      reason: `Plano de teste criativo — ${product.name}`,
    });
    if (creditError) {
      return {
        ok: false,
        code: "insufficient_credits",
        balance: ent.credit_balance ?? 0,
        cost: assistant.credits_per_message,
        error: "Créditos insuficientes para gerar o plano de teste criativo.",
      };
    }
  }

  const { data: user } = await supabase.auth.getUser();
  const { data: created, error: insertError } = await supabase
    .from("diagnoses")
    .insert({
      org_id: product.orgId,
      product_id: product.id,
      scope: "creative_plan",
      assistant_slug: assistant.slug,
      model: assistant.model,
      output: plan,
      confidence: plan.confidence,
      insufficient_data: plan.insufficient_data,
      // The plan never reads media data — that is the whole point.
      had_campaign_data: false,
      knowledge_refs: excerpts.map((excerpt) => ({
        title: excerpt.title,
        source: excerpt.source,
        trust_level: excerpt.trust_level,
        similarity: excerpt.similarity,
      })),
      created_by: user.user?.id ?? null,
    })
    .select("id")
    .single();
  if (insertError || !created) return { ok: false, error: insertError?.message ?? "Falha ao salvar o plano." };

  await recordAudit(supabase, "creative_plan.generated", {
    orgId: product.orgId,
    entityType: "diagnosis",
    entityId: created.id,
    metadata: { hypotheses: plan.hypotheses.length, insufficient: plan.insufficient_data },
  });

  return { ok: true, id: created.id };
}

/* -------------------------------------------------------------------------- */
/*  Fase B — hypothesis → library creative                                     */
/* -------------------------------------------------------------------------- */

export type MaterializeResult =
  | { ok: true; creativeId: string; alreadyExisted: boolean }
  | { ok: false; error: string };

/**
 * Turn one plan hypothesis into a `creatives` row, tags pre-filled from the
 * hypothesis slugs — the "why" is born labelled (pillar 4).
 *
 * Idempotent by the (diagnosis_id, hypothesis_key) unique constraint: clicking
 * twice, or racing, reuses the creative instead of duplicating it.
 */
export async function materializeHypothesis(planId: string, hypothesisKey: string): Promise<MaterializeResult> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ok: false, error: "Sessão expirada." };

  const { data: plan } = await supabase
    .from("diagnoses")
    .select("id, org_id, product_id, output, scope")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plano não encontrado." };
  if (plan.scope !== "creative_plan") return { ok: false, error: "Este registro não é um plano de teste criativo." };
  const output = plan.output;
  if (!isCreativePlanOutput(output)) return { ok: false, error: "O plano está fora do formato esperado." };
  const hypothesis = (output as CreativePlanOutput).hypotheses.find((h) => h.key === hypothesisKey);
  if (!hypothesis) return { ok: false, error: "Hipótese não encontrada no plano." };

  const { data: existing } = await supabase
    .from("creative_plan_links")
    .select("creative_id")
    .eq("diagnosis_id", planId)
    .eq("hypothesis_key", hypothesisKey)
    .maybeSingle();
  if (existing) return { ok: true, creativeId: existing.creative_id as string, alreadyExisted: true };

  const { data: creative, error: creativeError } = await supabase
    .from("creatives")
    .insert({
      org_id: plan.org_id,
      product_id: plan.product_id,
      name: hypothesis.angle.slice(0, 120),
      status: "idea",
      source: "planned",
      format: hypothesis.format,
      funnel_stage: hypothesis.funnel_stage,
      angle: hypothesis.angle,
      hook: hypothesis.hook,
      proof_type: hypothesis.proof_type,
      emotion: hypothesis.emotion,
      // The brief travels with the creative so it stays copiable and editable
      // where the work happens.
      notes: `Hipótese do plano de teste (${hypothesis.key}).\n\n${hypothesis.rationale}\n\nPrompt sugerido:\n${hypothesis.prompt_brief}`,
      created_by: user.user.id,
    })
    .select("id")
    .single();
  if (creativeError || !creative) {
    return { ok: false, error: creativeError?.message ?? "Falha ao criar o criativo." };
  }

  const { error: linkError } = await supabase.from("creative_plan_links").insert({
    org_id: plan.org_id,
    diagnosis_id: planId,
    hypothesis_key: hypothesisKey,
    creative_id: creative.id,
    created_by: user.user.id,
  });
  if (linkError) {
    // The unique constraint fired: a race got here first. Their creative wins;
    // ours must not linger as an orphan duplicate.
    if (linkError.code === "23505") {
      await supabase.from("creatives").delete().eq("id", creative.id);
      const { data: raced } = await supabase
        .from("creative_plan_links")
        .select("creative_id")
        .eq("diagnosis_id", planId)
        .eq("hypothesis_key", hypothesisKey)
        .maybeSingle();
      if (raced) return { ok: true, creativeId: raced.creative_id as string, alreadyExisted: true };
    }
    return { ok: false, error: linkError.message };
  }

  await recordAudit(supabase, "creative_plan.hypothesis_materialized", {
    orgId: plan.org_id as string,
    entityType: "creative",
    entityId: creative.id,
    metadata: { plan: planId, hypothesis: hypothesisKey },
  });

  return { ok: true, creativeId: creative.id as string, alreadyExisted: false };
}
