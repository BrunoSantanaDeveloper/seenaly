"use server";

import { buildCreativeEvidenceBlock } from "../creatives/plan-actions";
import { computeFunnelRates, type FunnelCounts } from "../funnel/types";
import { mapProductRow } from "../products/lib/map";
import type { ProductWithChildren } from "../products/types";

import { recordAudit } from "@/lib/audit";
import { buildCampaignBrief } from "@/lib/campaign-data";
import { productContextBlock } from "@/lib/diagnosis/product-brief";
import { DIAGNOSIS_JSON_SCHEMA, DIAGNOSIS_SCHEMA_NAME, isDiagnosisOutput } from "@/lib/diagnosis/schema";
import { EXPERIMENT_BRIEF_LIMIT, experimentsBlock, type ExperimentSummaryRow } from "@/lib/experiments/brief";
import { type AiProviderName, type AssistantConfig, getChatProvider } from "@flyee/ai";
import { createClient } from "@flyee/auth/server";
import { buildKnowledgeContext, resolveCollectionIds, searchKnowledge } from "@flyee/knowledge";

export type GenerateResult = { ok: true; id: string } | { ok: false; error: string };

export type DiagnosisRating = "useful" | "not_useful" | "incorrect";
export type FeedbackResult = { ok: true } | { ok: false; error: string };

/**
 * Record whether a diagnosis was useful — the signal that lets us measure and
 * tune the engine (docs analysis 2026-07-19). One rating per user per diagnosis
 * (upsert); RLS confirms the diagnosis belongs to the caller's org.
 */
export async function recordDiagnosisFeedback(
  orgId: string,
  diagnosisId: string,
  rating: DiagnosisRating,
): Promise<FeedbackResult> {
  if (!(["useful", "not_useful", "incorrect"] as const).includes(rating)) {
    return { ok: false, error: "Avaliação inválida." };
  }
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ok: false, error: "Sessão expirada." };

  const { error } = await supabase
    .from("diagnosis_feedback")
    .upsert(
      { org_id: orgId, diagnosis_id: diagnosisId, user_id: user.user.id, rating },
      { onConflict: "diagnosis_id,user_id" },
    );
  if (error) return { ok: false, error: error.message };

  await recordAudit(supabase, "diagnosis.feedback_recorded", {
    orgId,
    entityType: "diagnosis",
    entityId: diagnosisId,
    metadata: { rating },
  });
  return { ok: true };
}

const ASSISTANT_SLUG = "diagnosis-engine";
/** Most recent tagged creatives summarized for the engine. */
const MAX_CREATIVES = 20;

interface FunnelSnapshotRow extends FunnelCounts {
  label: string | null;
  period_end: string | null;
  pending: number | null;
  upsells: number | null;
}

interface CreativeSummaryRow {
  name: string;
  status: string;
  format: string | null;
  angle: string | null;
  hook: string | null;
  proof_type: string | null;
  emotion: string | null;
  result_summary: string | null;
}

/**
 * The tagged creative library (pillar 4) — lets the engine reason about WHY
 * winners won and spot patterns, instead of "test new angles" in the abstract.
 */
function creativesBlock(creatives: CreativeSummaryRow[]): string {
  if (creatives.length === 0) {
    return "Nenhum criativo cadastrado na biblioteca. Se recomendar criativos, oriente a etiquetar (gancho, ângulo, prova) desde o primeiro teste para virar aprendizado reutilizável.";
  }
  return creatives
    .map((c) => {
      const tags = [
        c.format && `formato ${c.format}`,
        c.angle && `ângulo: ${c.angle}`,
        c.hook && `gancho: ${c.hook}`,
        c.proof_type && `prova: ${c.proof_type}`,
        c.emotion && `emoção: ${c.emotion}`,
        c.result_summary && `resultado: ${c.result_summary}`,
      ]
        .filter(Boolean)
        .join("; ");
      return `- [${c.status}] ${c.name}${tags ? ` — ${tags}` : ""}`;
    })
    .join("\n");
}

/**
 * Funnel & real-sales data (docs/PRODUCT.md pillar 3) — what Meta cannot see.
 * This is precisely what lets the engine separate PAGE from CHECKOUT from
 * OFFER instead of asking for it in missing_data.
 */
function funnelBlock(snapshot: FunnelSnapshotRow | null): string {
  if (!snapshot) {
    return "Nenhum dado de funil informado (visitas, checkout iniciado, compras, reembolsos). Sem ele, você NÃO consegue separar página de checkout de oferta — peça esses números em missing_data em vez de supor.";
  }
  const rates = computeFunnelRates(snapshot);
  const pct = (r: number | null) => (r == null ? "n/d" : `${r.toFixed(1)}%`);
  const num = (v: number | null) => (v == null ? "n/d" : String(v));
  // Only present in a trial-first funnel; a direct-response product leaves it
  // empty and the line disappears rather than reporting a meaningless "n/d".
  const trialLines =
    snapshot.signups == null
      ? []
      : [
          `- Cadastros/trials iniciados: ${num(snapshot.signups)} (visita → cadastro: ${pct(rates.visitToSignup)})`,
          `- Conversão trial → pagante: ${pct(rates.signupToPurchase)}`,
          "ATENÇÃO: este é um funil com cadastro antes da compra. O anúncio otimiza o CADASTRO, então cadastro barato NÃO é sucesso — o que fecha a conta é a taxa trial → pagante. O CAC real usa PAGANTES no denominador, nunca cadastros.",
        ];
  return [
    `Período: ${snapshot.label ?? snapshot.period_end ?? "mais recente"}`,
    `- Visitas na página: ${num(snapshot.visits)}`,
    ...trialLines,
    `- Checkout iniciado: ${num(snapshot.checkout_initiated)} (página → checkout: ${pct(rates.pageToCheckout)})`,
    `- Compras: ${num(snapshot.purchases)} (checkout → compra: ${pct(rates.checkoutToPurchase)})`,
    `- Conversão total (visita → compra): ${pct(rates.overall)}`,
    `- Reembolsos: ${num(snapshot.refunds)} (taxa de reembolso: ${pct(rates.refundRate)})`,
    `- Pendentes (boleto/Pix): ${num(snapshot.pending)} | Upsells: ${num(snapshot.upsells)}`,
    `- Receita líquida: ${num(snapshot.net_revenue)}`,
    "Use estas taxas para localizar o gargalo: queda forte página→checkout aponta a PÁGINA; queda forte checkout→compra aponta CHECKOUT/OFERTA/PREÇO.",
  ].join("\n");
}

/**
 * What we ask the knowledge base, shaped by whether campaign data exists.
 * Deliberately spans BOTH sides of the click: pre-click signals (creative,
 * hook, audience) and post-click ones (conversion rate ranking, optimization
 * event, pixel/CAPI), because the bottleneck is often not in the ads manager.
 */
function retrievalQuery(product: ProductWithChildren, hadCampaignData: boolean): string {
  const base = [product.conversionType, product.funnelStage, product.optimizationEvent].filter(Boolean).join(" ");
  const postClick =
    "taxa de conversão pós-clique, conversion rate ranking, qualidade da página de destino, evento de otimização correto, pixel e API de Conversões";
  return hadCampaignData
    ? `diagnóstico de gargalo em campanha de ${base}: fase de aprendizado, fadiga de criativo, CTR CPC e CPA, estratégia de lance, diagnóstico de relevância (quality, engagement, conversion rate ranking), ${postClick}`
    : `como estruturar a primeira campanha de ${base}: qual evento de otimização escolher, fase de aprendizado e volume mínimo de eventos, estrutura de conta, diversificação de criativo, ${postClick}`;
}

/**
 * Generate one structured diagnosis for a product.
 *
 * Degrades gracefully across the maturity spectrum (docs/PRODUCT.md #6):
 * product context and official Meta docs always ground the answer; campaign
 * data enriches it when a connection has synced. A beginner with zero
 * campaigns gets cold-start guidance, not an error.
 */
export async function generateDiagnosis(productId: string): Promise<GenerateResult> {
  const supabase = await createClient();

  // 1. Product context + creative library + experiment memory (RLS-scoped).
  const [
    { data: row },
    { data: objections },
    { data: proofs },
    { data: planRows },
    { data: creativeRows },
    { data: experimentRows },
    { data: funnelRow },
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
      .from("creatives")
      .select("name, status, format, angle, hook, proof_type, emotion, result_summary")
      .eq("product_id", productId)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(MAX_CREATIVES),
    // Most-recent window; experimentsBlock re-orders it concluded-first (a raw
    // `order by status` is alphabetical — "abandoned" would sort ahead of the
    // "concluded" rows that actually carry the learning the engine must not ignore).
    supabase
      .from("experiments")
      .select("title, status, hypothesis, result, conclusion, next_step")
      .eq("product_id", productId)
      .order("updated_at", { ascending: false })
      .limit(EXPERIMENT_BRIEF_LIMIT),
    // Latest funnel snapshot — the page/checkout/purchase numbers Meta can't see.
    supabase
      .from("funnel_snapshots")
      .select(
        "label, period_end, visits, signups, checkout_initiated, purchases, refunds, pending, upsells, net_revenue",
      )
      .eq("product_id", productId)
      .order("period_end", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!row) return { ok: false, error: "Produto não encontrado." };
  const product = mapProductRow(row, {
    objections: objections ?? [],
    proofs: proofs ?? [],
    plans: planRows ?? [],
  });

  // 1b. Pre-paid creative evidence (docs/PRODUCT.md phase 8): which library
  // creatives already carry linked organic publications, aggregated per tag.
  // Counts only — the cross-network invariant forbids ranking raw metrics —
  // and it exists to ORDER paid hypotheses, never to predict paid results.
  const evidenceBlock = await buildCreativeEvidenceBlock(productId);

  // 2. SaaS gate: active subscription. Credits are only DEBITED after a valid
  // diagnosis is produced (step 7) — a failed RAG/LLM call must never charge the
  // user. We still pre-check the balance here so a broke org is rejected before
  // we spend an LLM call on it.
  const { data: entitlements, error: entitlementsError } = await supabase.rpc("org_entitlements", {
    target_org: product.orgId,
  });
  if (entitlementsError) return { ok: false, error: entitlementsError.message };
  const ent = entitlements as { active?: boolean; suspended?: boolean; credit_balance?: number } | null;
  if (!ent?.active) {
    return {
      ok: false,
      error: ent?.suspended
        ? "Assinatura suspensa — fale com o suporte."
        : "Nenhuma assinatura ativa para esta organização.",
    };
  }

  // 3. The engine is an editable assistant row (instructions tuned in /admin/ai).
  const { data: assistant } = await supabase
    .from("assistants")
    .select("slug, provider, model, system_prompt, temperature, max_tokens, credits_per_message, config")
    .eq("slug", ASSISTANT_SLUG)
    .eq("is_active", true)
    .maybeSingle();
  if (!assistant) return { ok: false, error: `Assistente "${ASSISTANT_SLUG}" não encontrado ou inativo.` };

  // Pre-check only (does not debit): avoid spending an LLM call for an org that
  // cannot pay. The atomic charge happens after the diagnosis validates.
  if (assistant.credits_per_message > 0 && (ent.credit_balance ?? 0) < assistant.credits_per_message) {
    return { ok: false, error: "Créditos insuficientes para gerar um diagnóstico." };
  }

  // 4. Campaign data via the platform's brief provider. The engine stays
  // platform-agnostic: Meta Ads is the only provider today, but a new platform
  // (Google/TikTok) registers its own CampaignBriefProvider and this call, the
  // brief and the prompt are unchanged. No connection or no synced rows → the
  // cold-start brief (a valid input, not an error — maturity spectrum).
  let briefConnection: { id: string; provider: string } | null = null;
  if (product.connectionId) {
    const { data: conn } = await supabase
      .from("connections")
      .select("id, provider")
      .eq("id", product.connectionId)
      .maybeSingle();
    if (conn) briefConnection = { id: conn.id as string, provider: conn.provider as string };
  }
  const campaignBrief = await buildCampaignBrief(supabase, briefConnection);

  // 5. Ground in the knowledge base: official Meta docs (trust 1) + the
  // authored growth playbook (CRO/checkout/offer/creative, per-doc trust).
  // Retrieved PER COLLECTION: the search RPC ranks by similarity + a trust
  // bonus ((5 - trust) * 0.03), so the large trust-1 Meta corpus produces
  // walls of mid-similarity chunks that crowd the trust-4/5 playbook out of
  // any combined window on platform-vocabulary queries. A per-collection
  // budget guarantees the brief carries both platform rules and playbook.
  const knowledgeConfig = (assistant.config as { knowledge?: { collections?: string[]; matchCount?: number } })
    ?.knowledge;
  const collectionSlugs = knowledgeConfig?.collections ?? ["meta-ads-docs", "growth-playbook"];
  const matchCount = knowledgeConfig?.matchCount ?? 8;
  const perCollection = Math.max(2, Math.ceil(matchCount / Math.max(collectionSlugs.length, 1)));
  const excerpts: Awaited<ReturnType<typeof searchKnowledge>> = [];
  try {
    const query = retrievalQuery(product, campaignBrief.hadData);
    for (const slug of collectionSlugs) {
      const collectionIds = await resolveCollectionIds(supabase, [slug]);
      if (collectionIds.length === 0) continue;
      excerpts.push(
        ...(await searchKnowledge(supabase, query, { collectionIds, matchCount: perCollection, maxPerDocument: 2 })),
      );
    }
  } catch (error) {
    return { ok: false, error: `Falha ao consultar a base de conhecimento: ${(error as Error).message}` };
  }

  // 6. The brief.
  const brief = [
    "## Contexto do produto",
    productContextBlock(product),
    "",
    "## Biblioteca de criativos",
    creativesBlock((creativeRows as CreativeSummaryRow[]) ?? []),
    "",
    "## Evidência criativa pré-paga (teste orgânico)",
    evidenceBlock,
    "",
    "## Memória de experimentos",
    experimentsBlock((experimentRows as ExperimentSummaryRow[]) ?? []),
    "",
    "## Funil e vendas reais",
    funnelBlock((funnelRow as FunnelSnapshotRow | null) ?? null),
    "",
    "## Dados de campanha",
    campaignBrief.block,
    buildKnowledgeContext(excerpts),
    "",
    "## Tarefa",
    "Diagnostique o gargalo mais provável desta oferta e proponha o próximo experimento.",
    "Construa sobre a memória de experimentos: NÃO recomende testar de novo o que já foi concluído; parta do que foi aprendido.",
    "Ancore cada evidência em product_context, campaign_data, meta_docs ou growth_playbook. Nunca invente números.",
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
      name: DIAGNOSIS_SCHEMA_NAME,
      description: "Diagnóstico estruturado no formato fixo do Seenaly.",
      schema: DIAGNOSIS_JSON_SCHEMA,
    });
  } catch (error) {
    return { ok: false, error: `O motor falhou ao gerar o diagnóstico: ${(error as Error).message}` };
  }

  if (!isDiagnosisOutput(output)) {
    return { ok: false, error: "O motor devolveu um diagnóstico fora do formato exigido." };
  }

  // 7. Charge now — only a valid diagnosis costs credits (a race that emptied the
  // balance since the pre-check surfaces here, before anything is persisted).
  if (assistant.credits_per_message > 0) {
    const { error: creditError } = await supabase.rpc("consume_credits", {
      target_org: product.orgId,
      amount: assistant.credits_per_message,
      reason: `Diagnóstico — ${product.name}`,
    });
    if (creditError) return { ok: false, error: "Créditos insuficientes para gerar um diagnóstico." };
  }

  // 8. Persist — a diagnosis you cannot revisit teaches nothing (phase 5 seed).
  const { data: user } = await supabase.auth.getUser();
  // When to bring the user back to re-read this (the review-reminder cron reads
  // next_review_at). Clamp the model's day count to a sane window; skip when absent.
  const reviewDays =
    typeof output.next_review_days === "number" && output.next_review_days > 0
      ? Math.min(Math.round(output.next_review_days), 90)
      : null;
  const nextReviewAt = reviewDays ? new Date(Date.now() + reviewDays * 24 * 60 * 60 * 1000).toISOString() : null;
  const { data: created, error: insertError } = await supabase
    .from("diagnoses")
    .insert({
      org_id: product.orgId,
      product_id: product.id,
      connection_id: product.connectionId,
      scope: "product",
      assistant_slug: assistant.slug,
      model: assistant.model,
      output,
      confidence: output.confidence,
      insufficient_data: output.insufficient_data,
      had_campaign_data: campaignBrief.hadData,
      data_window_start: campaignBrief.windowStart,
      data_window_end: campaignBrief.windowEnd,
      next_review_at: nextReviewAt,
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
  if (insertError || !created) return { ok: false, error: insertError?.message ?? "Falha ao salvar o diagnóstico." };

  return { ok: true, id: created.id };
}
