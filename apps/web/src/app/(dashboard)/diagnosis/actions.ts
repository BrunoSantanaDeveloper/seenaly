"use server";

import { computeFunnelRates, type FunnelCounts } from "../funnel/types";
import { mapProductRow } from "../products/lib/map";
import type { ProductWithChildren } from "../products/types";

import { DIAGNOSIS_JSON_SCHEMA, DIAGNOSIS_SCHEMA_NAME, isDiagnosisOutput } from "@/lib/diagnosis/schema";
import { type AiProviderName, type AssistantConfig, getChatProvider } from "@flyee/ai";
import { createClient } from "@flyee/auth/server";
import { buildKnowledgeContext, resolveCollectionIds, searchKnowledge } from "@flyee/knowledge";

export type GenerateResult = { ok: true; id: string } | { ok: false; error: string };

const ASSISTANT_SLUG = "diagnosis-engine";
/** Trailing window summarized for the engine when campaign data exists. */
const CAMPAIGN_WINDOW_DAYS = 30;
/** Guard against pulling an unbounded ad x day result set into memory. */
const MAX_INSIGHT_ROWS = 5000;
/** Most recent tagged creatives summarized for the engine. */
const MAX_CREATIVES = 20;
/** Most recent experiments summarized for the engine (memory feedback loop). */
const MAX_EXPERIMENTS = 15;

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

interface ExperimentSummaryRow {
  title: string;
  status: string;
  hypothesis: string | null;
  result: string | null;
  conclusion: string | null;
  next_step: string | null;
}

interface CampaignSummary {
  windowStart: string;
  windowEnd: string;
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  purchases: number;
  purchaseValue: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  frequency: number | null;
  adsWithSpend: number;
  /** The insight query hit MAX_INSIGHT_ROWS — the aggregates are a floor, not the full window. */
  truncated: boolean;
}

const shiftDays = (days: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Aggregate the trailing window of ad x day insights for the product's
 * connection. Returns null when there is no connection or no rows — the
 * cold-start path, which is a valid diagnosis input, not an error.
 */
async function summarizeCampaignData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  connectionId: string,
): Promise<CampaignSummary | null> {
  const windowStart = shiftDays(-CAMPAIGN_WINDOW_DAYS);
  const windowEnd = shiftDays(0);

  const { data } = await supabase
    .from("meta_insights_daily")
    .select("spend, impressions, clicks, inline_link_clicks, purchases, purchase_value, frequency, ad_id")
    .eq("connection_id", connectionId)
    .gte("date", windowStart)
    .lte("date", windowEnd)
    .limit(MAX_INSIGHT_ROWS);

  if (!data?.length) return null;

  const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
  const adsWithSpend = new Set<string>();
  let spend = 0,
    impressions = 0,
    clicks = 0,
    linkClicks = 0,
    purchases = 0,
    purchaseValue = 0,
    frequencySum = 0,
    frequencyCount = 0;

  for (const row of data) {
    const rowSpend = num(row.spend);
    spend += rowSpend;
    impressions += num(row.impressions);
    clicks += num(row.clicks);
    linkClicks += num(row.inline_link_clicks);
    purchases += num(row.purchases);
    purchaseValue += num(row.purchase_value);
    if (row.frequency !== null && row.frequency !== undefined) {
      frequencySum += num(row.frequency);
      frequencyCount += 1;
    }
    if (rowSpend > 0 && row.ad_id) adsWithSpend.add(String(row.ad_id));
  }

  return {
    windowStart,
    windowEnd,
    spend,
    impressions,
    clicks,
    linkClicks,
    purchases,
    purchaseValue,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
    cpa: purchases > 0 ? spend / purchases : null,
    roas: spend > 0 ? purchaseValue / spend : null,
    frequency: frequencyCount > 0 ? frequencySum / frequencyCount : null,
    adsWithSpend: adsWithSpend.size,
    truncated: data.length >= MAX_INSIGHT_ROWS,
  };
}

const line = (label: string, value: unknown): string | null =>
  value === null || value === undefined || value === "" ? null : `- ${label}: ${value}`;

/** The product context block — always present, the heart of every diagnosis. */
function productContextBlock(product: ProductWithChildren): string {
  const rows = [
    line("Produto", product.name),
    line("Descrição", product.description),
    line("Moeda", product.currency),
    line("Preço", product.price),
    line("Custo unitário", product.unitCost),
    line("Margem (%)", product.marginPct),
    line("Ticket médio", product.avgTicket),
    line("LTV", product.ltv),
    line("CAC máximo aceitável", product.targetCac),
    line("Orçamento mensal", product.monthlyBudget),
    line("Tipo de conversão desejada", product.conversionType),
    line("Etapa do funil", product.funnelStage),
    line("Público-alvo", product.audience),
    line("Promessa principal", product.mainPromise),
    line("Página de destino", product.landingPageUrl),
    line("Taxa de conversão da página (%)", product.landingConversionRate),
    line("Evento de otimização", product.optimizationEvent),
    line("Observações", product.notes),
  ].filter(Boolean);

  if (product.objections.length > 0) {
    rows.push(`- Objeções: ${product.objections.join("; ")}`);
  }
  if (product.proofs.length > 0) {
    rows.push(
      `- Provas disponíveis: ${product.proofs.map((p) => (p.kind ? `${p.kind}: ${p.content}` : p.content)).join("; ")}`,
    );
  }
  return rows.join("\n");
}

function campaignBlock(summary: CampaignSummary | null): string {
  if (!summary) {
    return [
      "NÃO HÁ DADOS DE CAMPANHA.",
      "Nenhuma conta Meta conectada, ou nenhum dado sincronizado ainda.",
      "Isto NÃO impede o diagnóstico: oriente a partir do passo 0 usando o contexto do produto e a documentação oficial.",
      "Marque insufficient_data=true e explique qual volume mínimo buscar antes de concluir qualquer coisa.",
    ].join("\n");
  }
  const round = (v: number | null, digits = 2) => (v === null ? "n/d" : v.toFixed(digits));
  return [
    `Janela: ${summary.windowStart} a ${summary.windowEnd} (últimos ${CAMPAIGN_WINDOW_DAYS} dias)`,
    summary.truncated
      ? `ATENÇÃO: volume de linhas atingiu o limite (${MAX_INSIGHT_ROWS}); estes totais são um PISO, não a janela completa — trate valores absolutos (gasto, compras) como subestimados e priorize as taxas.`
      : null,
    `- Anúncios com veiculação: ${summary.adsWithSpend}`,
    `- Gasto: ${round(summary.spend)}`,
    `- Impressões: ${summary.impressions}`,
    `- Cliques: ${summary.clicks} (cliques no link: ${summary.linkClicks})`,
    `- CTR: ${round(summary.ctr)}%`,
    `- CPC: ${round(summary.cpc)}`,
    `- Frequência média: ${round(summary.frequency)}`,
    `- Compras: ${summary.purchases}`,
    `- Valor de conversão: ${round(summary.purchaseValue)}`,
    `- CPA: ${round(summary.cpa)}`,
    `- ROAS: ${round(summary.roas)}`,
  ]
    .filter(Boolean)
    .join("\n");
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
 * Experiment memory (docs/PRODUCT.md — the key differentiator). Concluded
 * tests feed back so the engine builds on prior learning and does NOT
 * recommend re-testing what was already disproven.
 */
const EXPERIMENT_STATUS_PRIORITY: Record<string, number> = {
  concluded: 0,
  running: 1,
  planned: 2,
  abandoned: 3,
};

function experimentsBlock(experiments: ExperimentSummaryRow[]): string {
  if (experiments.length === 0) {
    return "Nenhum experimento registrado ainda. Ao recomendar um teste, oriente a registrá-lo na memória de experimentos (hipótese → mudança → resultado → conclusão) para não repetir o que já foi testado.";
  }
  // Concluded first (they carry the learning the engine must not re-test),
  // abandoned last; the DB query only gives us the most-recent window.
  return [...experiments]
    .sort((a, b) => (EXPERIMENT_STATUS_PRIORITY[a.status] ?? 9) - (EXPERIMENT_STATUS_PRIORITY[b.status] ?? 9))
    .map((e) => {
      const parts = [
        e.hypothesis && `hipótese: ${e.hypothesis}`,
        e.result && `resultado: ${e.result}`,
        e.conclusion && `conclusão: ${e.conclusion}`,
        e.next_step && `próximo passo: ${e.next_step}`,
      ]
        .filter(Boolean)
        .join(" | ");
      return `- [${e.status}] ${e.title}${parts ? ` — ${parts}` : ""}`;
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
  return [
    `Período: ${snapshot.label ?? snapshot.period_end ?? "mais recente"}`,
    `- Visitas na página: ${num(snapshot.visits)}`,
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
function retrievalQuery(product: ProductWithChildren, summary: CampaignSummary | null): string {
  const base = [product.conversionType, product.funnelStage, product.optimizationEvent].filter(Boolean).join(" ");
  const postClick =
    "taxa de conversão pós-clique, conversion rate ranking, qualidade da página de destino, evento de otimização correto, pixel e API de Conversões";
  return summary
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
    { data: creativeRows },
    { data: experimentRows },
    { data: funnelRow },
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).maybeSingle(),
    supabase.from("product_objections").select("content").eq("product_id", productId).order("created_at"),
    supabase.from("product_proofs").select("kind, content").eq("product_id", productId).order("created_at"),
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
      .limit(MAX_EXPERIMENTS),
    // Latest funnel snapshot — the page/checkout/purchase numbers Meta can't see.
    supabase
      .from("funnel_snapshots")
      .select("label, period_end, visits, checkout_initiated, purchases, refunds, pending, upsells, net_revenue")
      .eq("product_id", productId)
      .order("period_end", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!row) return { ok: false, error: "Produto não encontrado." };
  const product = mapProductRow(row, { objections: objections ?? [], proofs: proofs ?? [] });

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

  // 4. Campaign data, when the product is bridged to a synced connection.
  const summary = product.connectionId ? await summarizeCampaignData(supabase, product.connectionId) : null;

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
    const query = retrievalQuery(product, summary);
    for (const slug of collectionSlugs) {
      const collectionIds = await resolveCollectionIds(supabase, [slug]);
      if (collectionIds.length === 0) continue;
      excerpts.push(...(await searchKnowledge(supabase, query, { collectionIds, matchCount: perCollection })));
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
    "## Memória de experimentos",
    experimentsBlock((experimentRows as ExperimentSummaryRow[]) ?? []),
    "",
    "## Funil e vendas reais",
    funnelBlock((funnelRow as FunnelSnapshotRow | null) ?? null),
    "",
    "## Dados de campanha",
    campaignBlock(summary),
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
      had_campaign_data: Boolean(summary),
      data_window_start: summary?.windowStart ?? null,
      data_window_end: summary?.windowEnd ?? null,
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
