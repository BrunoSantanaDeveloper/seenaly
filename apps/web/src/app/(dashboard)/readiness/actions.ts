"use server";

import { mapProductRow } from "../products/lib/map";

import { recordAudit } from "@/lib/audit";
import { productContextBlock } from "@/lib/diagnosis/product-brief";
import { readinessChecklistBlock, readinessRetrievalQuery, readinessSignalsBlock } from "@/lib/readiness/brief";
import {
  CHECKOUT_TYPES,
  type CheckoutType,
  EMPTY_READINESS_PROFILE,
  evaluateReadiness,
  READINESS_ITEM_KEYS,
  type ReadinessProfile,
  toReadinessProfile,
  toReadinessRow,
} from "@/lib/readiness/checklist";
import {
  isReadinessOutput,
  READINESS_JSON_SCHEMA,
  READINESS_SCHEMA_NAME,
  reconcileVerdict,
} from "@/lib/readiness/schema";
import { type AiProviderName, type AssistantConfig, getChatProvider } from "@flyee/ai";
import { createClient } from "@flyee/auth/server";
import { buildKnowledgeContext, resolveCollectionIds, searchKnowledge } from "@flyee/knowledge";

const ASSISTANT_SLUG = "readiness-engine";

export type SaveReadinessResult = { ok: true } | { ok: false; error: string };
export type GenerateReadinessResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Never trust the client shape: rebuild the profile key by key from the spec so
 * an extra or renamed field can never reach the database.
 */
function sanitizeProfile(input: unknown): ReadinessProfile {
  const raw = (input ?? {}) as Record<string, unknown>;
  const profile: ReadinessProfile = { ...EMPTY_READINESS_PROFILE };
  for (const key of READINESS_ITEM_KEYS) {
    profile[key] = raw[key] === true;
  }
  const checkoutType = raw.checkoutType;
  profile.checkoutType = CHECKOUT_TYPES.includes(checkoutType as CheckoutType) ? (checkoutType as CheckoutType) : null;
  const days = Number(raw.guaranteeDays);
  profile.guaranteeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : null;
  return profile;
}

/** Persist the declared structure. Free — no credits, no LLM call. */
export async function saveReadiness(productId: string, input: unknown): Promise<SaveReadinessResult> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ok: false, error: "Sessão expirada." };

  // RLS would reject the write anyway; reading the product first gives us the
  // org_id the row needs and a clear error instead of a policy violation.
  const { data: product } = await supabase
    .from("products")
    .select("id, org_id, name")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, error: "Produto não encontrado." };

  const profile = sanitizeProfile(input);
  const { error } = await supabase.from("product_readiness").upsert(
    {
      product_id: productId,
      org_id: product.org_id,
      ...toReadinessRow(profile),
      updated_by: user.user.id,
    },
    { onConflict: "product_id" },
  );
  if (error) return { ok: false, error: error.message };

  await recordAudit(supabase, "readiness.profile_saved", {
    orgId: product.org_id as string,
    entityType: "product",
    entityId: productId,
    metadata: { confirmed: READINESS_ITEM_KEYS.filter((key) => profile[key]).length },
  });
  return { ok: true };
}

/**
 * Produce one readiness verdict for a product.
 *
 * This is the SAME engine as `/diagnosis`, pointed at the structure instead of
 * the media data: same assistant mechanism, same knowledge base, same credit
 * policy, and the verdict is stored in `diagnoses` with `scope = 'readiness'`.
 * It needs no campaign data and no Meta connection by construction — readiness
 * is the zero-data front door of the maturity spectrum (docs/PRODUCT.md #6).
 */
export async function generateReadiness(productId: string): Promise<GenerateReadinessResult> {
  const supabase = await createClient();

  const [{ data: row }, { data: objections }, { data: proofs }, { data: planRows }, { data: readinessRow }] =
    await Promise.all([
      supabase.from("products").select("*").eq("id", productId).maybeSingle(),
      supabase.from("product_objections").select("content").eq("product_id", productId).order("created_at"),
      supabase.from("product_proofs").select("kind, content").eq("product_id", productId).order("created_at"),
      supabase
        .from("product_plans")
        .select("name, price, period, quantity, share_pct, is_primary, sort")
        .eq("product_id", productId)
        .order("sort"),
      supabase.from("product_readiness").select("*").eq("product_id", productId).maybeSingle(),
    ]);
  if (!row) return { ok: false, error: "Produto não encontrado." };
  const product = mapProductRow(row, {
    objections: objections ?? [],
    proofs: proofs ?? [],
    plans: planRows ?? [],
  });

  const profile = toReadinessProfile(readinessRow as Record<string, unknown> | null);
  const evaluation = evaluateReadiness(profile, {
    hasLandingPage: Boolean(product.landingPageUrl),
    hasPrice: product.price != null || (product.plans?.some((plan) => plan.price != null) ?? false),
  });

  // Subscription gate. Credits are only DEBITED after a valid verdict (step 6)
  // — a failed RAG/LLM call must never charge the user.
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

  const { data: assistant } = await supabase
    .from("assistants")
    .select("slug, provider, model, system_prompt, temperature, max_tokens, credits_per_message, config")
    .eq("slug", ASSISTANT_SLUG)
    .eq("is_active", true)
    .maybeSingle();
  if (!assistant) return { ok: false, error: `Assistente "${ASSISTANT_SLUG}" não encontrado ou inativo.` };

  if (assistant.credits_per_message > 0 && (ent.credit_balance ?? 0) < assistant.credits_per_message) {
    return { ok: false, error: "Créditos insuficientes para verificar a prontidão." };
  }

  // Ground in the knowledge base. Per collection (same reason as the diagnosis
  // engine): the large trust-1 Meta corpus would otherwise crowd out the
  // growth playbook, which carries most of the pre-spend structure knowledge.
  const knowledgeConfig = (assistant.config as { knowledge?: { collections?: string[]; matchCount?: number } })
    ?.knowledge;
  const collectionSlugs = knowledgeConfig?.collections ?? ["growth-playbook", "meta-ads-docs"];
  const matchCount = knowledgeConfig?.matchCount ?? 8;
  const perCollection = Math.max(2, Math.ceil(matchCount / Math.max(collectionSlugs.length, 1)));
  const excerpts: Awaited<ReturnType<typeof searchKnowledge>> = [];
  try {
    const query = readinessRetrievalQuery(Boolean(product.landingPageUrl));
    for (const slug of collectionSlugs) {
      const collectionIds = await resolveCollectionIds(supabase, [slug]);
      if (collectionIds.length === 0) continue;
      excerpts.push(...(await searchKnowledge(supabase, query, { collectionIds, matchCount: perCollection })));
    }
  } catch (error) {
    return { ok: false, error: `Falha ao consultar a base de conhecimento: ${(error as Error).message}` };
  }

  const brief = [
    "## Contexto do produto",
    productContextBlock(product),
    "",
    "## Checklist de prontidão declarado pelo usuário",
    readinessChecklistBlock(profile),
    "",
    "## Sinais locais (verificação determinística já exibida ao usuário)",
    readinessSignalsBlock(evaluation),
    buildKnowledgeContext(excerpts),
    "",
    "## Tarefa",
    "Audite a prontidão desta estrutura para receber tráfego pago e devolva o veredito.",
    "Ordene as findings por alavancagem real: o que devolve mais dinheiro se for consertado primeiro.",
    "Item não marcado significa NÃO CONFIRMADO, nunca inexistente — quando confirmar for barato, a ação é confirmar.",
    "Ancore cada evidência em product_context, growth_playbook ou meta_docs. Nunca invente números.",
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
      name: READINESS_SCHEMA_NAME,
      description: "Veredito de prontidão estruturado do Seenaly.",
      schema: READINESS_JSON_SCHEMA,
    });
  } catch (error) {
    return { ok: false, error: `O motor falhou ao verificar a prontidão: ${(error as Error).message}` };
  }

  if (!isReadinessOutput(output)) {
    return { ok: false, error: "O motor devolveu um veredito fora do formato exigido." };
  }
  const verdict = reconcileVerdict(output);

  // Charge now — only a valid verdict costs credits.
  if (assistant.credits_per_message > 0) {
    const { error: creditError } = await supabase.rpc("consume_credits", {
      target_org: product.orgId,
      amount: assistant.credits_per_message,
      reason: `Prontidão — ${product.name}`,
    });
    if (creditError) return { ok: false, error: "Créditos insuficientes para verificar a prontidão." };
  }

  const { data: user } = await supabase.auth.getUser();
  const { data: created, error: insertError } = await supabase
    .from("diagnoses")
    .insert({
      org_id: product.orgId,
      product_id: product.id,
      scope: "readiness",
      assistant_slug: assistant.slug,
      model: assistant.model,
      output: verdict,
      confidence: verdict.confidence,
      insufficient_data: verdict.insufficient_data,
      // Readiness never reads media data — that is the whole point.
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
  if (insertError || !created) return { ok: false, error: insertError?.message ?? "Falha ao salvar o veredito." };

  await recordAudit(supabase, "readiness.verdict_generated", {
    orgId: product.orgId,
    entityType: "diagnosis",
    entityId: created.id,
    metadata: { verdict: verdict.verdict, blocking: verdict.blocking.length },
  });

  return { ok: true, id: created.id };
}
