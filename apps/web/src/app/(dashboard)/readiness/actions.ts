"use server";

import { mapProductRow } from "../products/lib/map";

import { recordAudit } from "@/lib/audit";
import { productContextBlock } from "@/lib/diagnosis/product-brief";
import { notifyPlatformTeam } from "@/lib/notifications";
import {
  type OrganicPresence,
  readinessChecklistBlock,
  readinessOrganicBlock,
  readinessRetrievalQuery,
  readinessScanBlock,
  readinessSignalsBlock,
  type ScanRecord,
} from "@/lib/readiness/brief";
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
import { HOWTO_JSON_SCHEMA, HOWTO_SCHEMA_NAME, type HowToOutput, isHowToOutput } from "@/lib/readiness/howto";
import { scanSite } from "@/lib/readiness/scan";
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
const HOWTO_ASSISTANT_SLUG = "readiness-howto";
/** The concierge catalog entry (migration 0032) — price lives in the DB. */
const ASSIST_OFFERING_SLUG = "readiness-item-session";

export type SaveReadinessResult = { ok: true } | { ok: false; error: string };
export type GenerateReadinessResult =
  | { ok: true; id: string }
  // `code` lets the UI turn a dead-end message into an actionable one (how many
  // credits you have, what this costs, where to get more) instead of the user
  // guessing. Never detect this by matching the message string.
  | { ok: false; error: string; code?: "insufficient_credits" | "no_subscription"; balance?: number; cost?: number };

/** What a readiness check costs and what the org currently has. */
export type ReadinessCreditInfo =
  | { ok: true; balance: number; verdictCost: number; howToCost: number }
  | { ok: false; error: string };

/**
 * Read the price of a readiness check and the org's balance, so the user sees
 * both BEFORE spending. The cost lives on the editable assistant row (tunable
 * in /admin/ai), so it is read rather than hardcoded — a constant here would
 * silently drift from what is actually charged.
 */
export async function getReadinessCreditInfo(orgId: string): Promise<ReadinessCreditInfo> {
  const supabase = await createClient();
  const [
    { data: verdictAssistant, error: verdictError },
    { data: howToAssistant, error: howToError },
    { data: balance, error: balanceError },
  ] = await Promise.all([
    supabase.from("assistants").select("credits_per_message").eq("slug", ASSISTANT_SLUG).maybeSingle(),
    supabase.from("assistants").select("credits_per_message").eq("slug", HOWTO_ASSISTANT_SLUG).maybeSingle(),
    supabase.rpc("org_credit_balance", { target_org: orgId }),
  ]);
  const error = verdictError ?? howToError ?? balanceError;
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    balance: Number(balance ?? 0),
    verdictCost: Number(verdictAssistant?.credits_per_message ?? 0),
    howToCost: Number(howToAssistant?.credits_per_message ?? 0),
  };
}
/** A finished scan is a success even when the site was unreachable — the
 *  outcome is recorded and the UI explains it. Only "we could not even try"
 *  (no product, no URL, no session) is an error. */
export type ScanProductResult = { ok: true; scanned: boolean } | { ok: false; error: string };

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
 * Scan the product's page (docs/PRODUCT.md phase 7, fase B).
 *
 * FREE — no credits, no LLM: it is an HTTP fetch. Charging for it would push
 * users away from the cheapest evidence in the whole product.
 *
 * A failed scan is PERSISTED, not discarded: "your page did not answer our
 * crawler" is a real finding, and losing it would make the failure look like it
 * never happened. The SSRF guarding lives in `lib/readiness/scan.ts`.
 */
export async function scanProductSite(productId: string): Promise<ScanProductResult> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ok: false, error: "Sessão expirada." };

  const { data: product } = await supabase
    .from("products")
    .select("id, org_id, landing_page_url")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, error: "Produto não encontrado." };

  const url = (product.landing_page_url as string | null)?.trim();
  if (!url) {
    return { ok: false, error: "Cadastre a página de destino do produto para poder escanear." };
  }

  const outcome = await scanSite(url);

  const { error } = await supabase.from("product_scans").insert({
    product_id: productId,
    org_id: product.org_id,
    requested_url: outcome.requestedUrl,
    final_url: outcome.finalUrl,
    ok: outcome.ok,
    status_code: outcome.statusCode,
    error: outcome.error,
    result: outcome.signals ?? {},
    created_by: user.user.id,
  });
  if (error) return { ok: false, error: error.message };

  await recordAudit(supabase, "readiness.site_scanned", {
    orgId: product.org_id as string,
    entityType: "product",
    entityId: productId,
    metadata: { ok: outcome.ok, status: outcome.statusCode, error: outcome.error },
  });

  return { ok: true, scanned: outcome.ok };
}

/* -------------------------------------------------------------------------- */
/*  Concierge — the paid human exit when the step-by-step was not enough       */
/* -------------------------------------------------------------------------- */

/** The catalog entry, so the price is shown BEFORE the user commits. */
export type AssistOffering = { id: string; name: string; description: string; credits: number; minutes: number };
export type AssistOfferingResult =
  | { ok: true; offering: AssistOffering | null; openItems: string[] }
  | { ok: false; error: string };

/**
 * Read the concierge catalog plus which items already have an OPEN request.
 *
 * Both together: the UI must never offer to sell a session for something the
 * org already asked for and is waiting on — that is how you double-charge a
 * confused user.
 */
export async function getAssistInfo(orgId: string, productId: string): Promise<AssistOfferingResult> {
  const supabase = await createClient();
  const [{ data: offering, error: offeringError }, { data: open, error: openError }] = await Promise.all([
    supabase
      .from("assist_offerings")
      .select("id, name, description, credits, estimated_minutes")
      .eq("slug", ASSIST_OFFERING_SLUG)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("readiness_assists")
      .select("item_key")
      .eq("product_id", productId)
      .in("status", ["requested", "scheduled", "in_progress"]),
  ]);
  // A missing catalog row is not an error — it means the service is switched
  // off, and the UI simply never offers it.
  if (offeringError && offeringError.code !== "PGRST116") return { ok: false, error: offeringError.message };
  if (openError) return { ok: false, error: openError.message };
  return {
    ok: true,
    offering: offering
      ? {
          id: offering.id as string,
          name: offering.name as string,
          description: offering.description as string,
          credits: Number(offering.credits ?? 0),
          minutes: Number(offering.estimated_minutes ?? 0),
        }
      : null,
    openItems: ((open as { item_key: string }[]) ?? []).map((row) => row.item_key),
  };
}

export type RequestAssistResult =
  | { ok: true; id: string; alreadyOpen: boolean }
  | { ok: false; error: string; code?: "insufficient_credits" | "no_subscription" };

/**
 * Ask the Seenaly team to do one readiness item WITH the user, on a call.
 *
 * Charging order is the whole risk here, so it is explicit: we insert FIRST
 * (the partial unique index makes a double-click or a race collapse into one
 * open request) and charge SECOND, rolling the row back if the debit fails.
 * The alternative — charge then insert — can take the money and lose the
 * request, which is the one outcome a burned-by-agencies user must never see.
 */
export async function requestAssist(
  productId: string,
  itemKey: string,
  reason: string,
  contactNote: string,
): Promise<RequestAssistResult> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { ok: false, error: "Sessão expirada." };

  // Never trust the client's idea of what a checklist item is.
  if (!(READINESS_ITEM_KEYS as string[]).includes(itemKey)) {
    return { ok: false, error: "Item inválido." };
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, org_id, name")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, error: "Produto não encontrado." };

  const { data: offering } = await supabase
    .from("assist_offerings")
    .select("id, credits")
    .eq("slug", ASSIST_OFFERING_SLUG)
    .eq("is_active", true)
    .maybeSingle();
  if (!offering) return { ok: false, error: "Este serviço não está disponível no momento." };
  const cost = Number(offering.credits ?? 0);

  // Already asked and waiting: return the existing request instead of billing
  // again. Idempotency is a billing guarantee here, not a nicety.
  const { data: existing } = await supabase
    .from("readiness_assists")
    .select("id")
    .eq("product_id", productId)
    .eq("item_key", itemKey)
    .in("status", ["requested", "scheduled", "in_progress"])
    .maybeSingle();
  if (existing) return { ok: true, id: existing.id as string, alreadyOpen: true };

  const { data: entitlements } = await supabase.rpc("org_entitlements", { target_org: product.org_id });
  const ent = entitlements as { active?: boolean; credit_balance?: number } | null;
  if (!ent?.active) return { ok: false, code: "no_subscription", error: "Nenhuma assinatura ativa." };
  if (cost > 0 && (ent.credit_balance ?? 0) < cost) {
    return { ok: false, code: "insufficient_credits", error: "Créditos insuficientes para pedir a sessão guiada." };
  }

  const { data: created, error: insertError } = await supabase
    .from("readiness_assists")
    .insert({
      org_id: product.org_id,
      product_id: productId,
      offering_id: offering.id,
      item_key: itemKey,
      reason,
      // Free text only. The UI states we never ask for passwords, and the note
      // is stored as-is for the operator to read before the call.
      contact_note: contactNote.slice(0, 2000) || null,
      credits_charged: cost,
      requested_by: user.user.id,
    })
    .select("id")
    .single();
  if (insertError || !created) {
    // The partial unique index fired: someone (or a double-click) got here
    // first. That is a success from the user's point of view, not an error.
    if (insertError?.code === "23505") {
      const { data: raced } = await supabase
        .from("readiness_assists")
        .select("id")
        .eq("product_id", productId)
        .eq("item_key", itemKey)
        .in("status", ["requested", "scheduled", "in_progress"])
        .maybeSingle();
      if (raced) return { ok: true, id: raced.id as string, alreadyOpen: true };
    }
    return { ok: false, error: insertError?.message ?? "Falha ao registrar o pedido." };
  }

  if (cost > 0) {
    const { error: creditError } = await supabase.rpc("consume_credits", {
      target_org: product.org_id,
      amount: cost,
      reason: `Sessão guiada — ${itemKey}`,
    });
    if (creditError) {
      // Roll the request back so we never leave a queued job nobody paid for.
      await supabase.from("readiness_assists").delete().eq("id", created.id);
      return { ok: false, code: "insufficient_credits", error: "Créditos insuficientes para pedir a sessão guiada." };
    }
  }

  await recordAudit(supabase, "readiness.assist_requested", {
    orgId: product.org_id as string,
    entityType: "product",
    entityId: productId,
    metadata: { item: itemKey, reason, credits: cost },
  });

  // Tell the team. Best-effort by design: a notification failure must never
  // undo a paid, recorded request — the row in the queue is the source of truth.
  await notifyPlatformTeam({
    title: "Nova sessão guiada pedida",
    body: `${product.name}: ${itemKey} (${reason})`,
    href: "/admin/assists",
  });

  return { ok: true, id: created.id, alreadyOpen: false };
}

export type HowToResult =
  | { ok: true; howTo: HowToOutput; sources: { title: string; trust_level: number }[]; cached: boolean }
  | { ok: false; error: string; code?: "insufficient_credits" };

/**
 * Write the step-by-step for ONE finding, on demand.
 *
 * On demand and not inline: the user's complaint about the verdict was too much
 * text, so generating steps for every finding up front would make it worse.
 * Cached per (diagnosis, finding) — asking twice never charges twice.
 *
 * Honesty rule with teeth: when the knowledge base cannot support a how-to, the
 * engine returns no steps, we do NOT persist and we do NOT charge. A retry
 * after the corpus grows should be able to succeed, and nobody pays for an
 * empty answer.
 */
export async function generateFindingHowTo(diagnosisId: string, findingIndex: number): Promise<HowToResult> {
  const supabase = await createClient();

  const { data: verdict } = await supabase
    .from("diagnoses")
    .select("id, org_id, product_id, output, scope")
    .eq("id", diagnosisId)
    .maybeSingle();
  if (!verdict) return { ok: false, error: "Veredito não encontrado." };
  if (verdict.scope !== "readiness") return { ok: false, error: "Este registro não é um veredito de prontidão." };

  const output = verdict.output;
  if (!isReadinessOutput(output)) return { ok: false, error: "O veredito está fora do formato esperado." };
  const finding = output.findings[findingIndex];
  if (!finding) return { ok: false, error: "Achado não encontrado no veredito." };

  // Cache first — this is what keeps it a one-time cost per finding.
  const { data: cached } = await supabase
    .from("readiness_howtos")
    .select("steps, sources")
    .eq("diagnosis_id", diagnosisId)
    .eq("finding_index", findingIndex)
    .maybeSingle();
  if (cached) {
    const stored = cached.steps as { steps?: string[]; needs_specialist?: boolean; note?: string };
    return {
      ok: true,
      cached: true,
      howTo: {
        steps: Array.isArray(stored?.steps) ? stored.steps : [],
        needs_specialist: stored?.needs_specialist === true,
        note: typeof stored?.note === "string" ? stored.note : "",
      },
      sources: (cached.sources as { title: string; trust_level: number }[]) ?? [],
    };
  }

  const { data: entitlements } = await supabase.rpc("org_entitlements", { target_org: verdict.org_id });
  const ent = entitlements as { active?: boolean; credit_balance?: number } | null;
  if (!ent?.active) return { ok: false, error: "Nenhuma assinatura ativa para esta organização." };

  const { data: assistant } = await supabase
    .from("assistants")
    .select("slug, provider, model, system_prompt, temperature, max_tokens, credits_per_message, config")
    .eq("slug", HOWTO_ASSISTANT_SLUG)
    .eq("is_active", true)
    .maybeSingle();
  if (!assistant) return { ok: false, error: `Assistente "${HOWTO_ASSISTANT_SLUG}" não encontrado ou inativo.` };
  if (assistant.credits_per_message > 0 && (ent.credit_balance ?? 0) < assistant.credits_per_message) {
    return { ok: false, code: "insufficient_credits", error: "Créditos insuficientes para gerar o passo a passo." };
  }

  // Retrieve for THIS action specifically, not the whole verdict.
  const knowledgeConfig = (assistant.config as { knowledge?: { collections?: string[]; matchCount?: number } })
    ?.knowledge;
  const collectionSlugs = knowledgeConfig?.collections ?? ["meta-ads-docs", "growth-playbook"];
  const matchCount = knowledgeConfig?.matchCount ?? 8;
  const perCollection = Math.max(2, Math.ceil(matchCount / Math.max(collectionSlugs.length, 1)));
  const excerpts: Awaited<ReturnType<typeof searchKnowledge>> = [];
  try {
    const query = `como fazer, passo a passo: ${finding.recommended_action} (${finding.dimension}). ${finding.finding}`;
    for (const slug of collectionSlugs) {
      const collectionIds = await resolveCollectionIds(supabase, [slug]);
      if (collectionIds.length === 0) continue;
      excerpts.push(...(await searchKnowledge(supabase, query, { collectionIds, matchCount: perCollection })));
    }
  } catch (error) {
    return { ok: false, error: `Falha ao consultar a base de conhecimento: ${(error as Error).message}` };
  }

  const brief = [
    "## Recomendação que o usuário precisa executar",
    finding.recommended_action,
    "",
    "## Contexto do achado",
    `Dimensão: ${finding.dimension}. Esforço estimado: ${finding.effort}.`,
    finding.finding,
    "",
    "## Como ele vai saber que resolveu",
    finding.success_criterion,
    buildKnowledgeContext(excerpts),
    "",
    "## Tarefa",
    "Escreva o passo a passo dessa recomendação para um iniciante.",
    "Se os trechos acima não sustentarem os passos, devolva steps vazio e explique em note. Não invente tutorial.",
  ].join("\n");

  const config: AssistantConfig = {
    provider: assistant.provider as AiProviderName,
    model: assistant.model,
    systemPrompt: assistant.system_prompt,
    temperature: Number(assistant.temperature),
    maxTokens: assistant.max_tokens,
  };

  let raw: unknown;
  try {
    raw = await getChatProvider(config.provider).generateStructured(config, [{ role: "user", content: brief }], {
      name: HOWTO_SCHEMA_NAME,
      description: "Passo a passo aterrado para uma recomendação de prontidão.",
      schema: HOWTO_JSON_SCHEMA,
    });
  } catch (error) {
    return { ok: false, error: `Falha ao gerar o passo a passo: ${(error as Error).message}` };
  }
  if (!isHowToOutput(raw)) return { ok: false, error: "O motor devolveu um passo a passo fora do formato exigido." };

  const sources = excerpts.map((excerpt) => ({ title: excerpt.title, trust_level: excerpt.trust_level }));

  // No steps = the knowledge base did not cover it. Say so, charge nothing, and
  // leave no cache row so a later retry (after new ingestion) can succeed.
  if (raw.steps.length === 0) {
    return { ok: true, cached: false, howTo: raw, sources: [] };
  }

  if (assistant.credits_per_message > 0) {
    const { error: creditError } = await supabase.rpc("consume_credits", {
      target_org: verdict.org_id,
      amount: assistant.credits_per_message,
      reason: `Passo a passo — ${finding.dimension}`,
    });
    if (creditError) {
      return { ok: false, code: "insufficient_credits", error: "Créditos insuficientes para gerar o passo a passo." };
    }
  }

  const { data: user } = await supabase.auth.getUser();
  await supabase.from("readiness_howtos").insert({
    diagnosis_id: diagnosisId,
    org_id: verdict.org_id,
    finding_index: findingIndex,
    steps: raw,
    sources,
    created_by: user.user?.id ?? null,
  });

  await recordAudit(supabase, "readiness.howto_generated", {
    orgId: verdict.org_id as string,
    entityType: "diagnosis",
    entityId: diagnosisId,
    metadata: { finding_index: findingIndex, steps: raw.steps.length },
  });

  return { ok: true, cached: false, howTo: raw, sources };
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

  const [
    { data: row },
    { data: objections },
    { data: proofs },
    { data: planRows },
    { data: readinessRow },
    { data: scanRow },
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
    supabase.from("product_readiness").select("*").eq("product_id", productId).maybeSingle(),
    // Latest scan only — the engine reasons about the CURRENT state of the page.
    supabase
      .from("product_scans")
      .select("requested_url, final_url, ok, status_code, error, result, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Organic presence: docs/PRODUCT.md treats it as a PRE-CONDITION of paid
    // acquisition, so the readiness engine must see whether it actually exists.
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

  const profile = toReadinessProfile(readinessRow as Record<string, unknown> | null);
  const scanRecord: ScanRecord | null = scanRow
    ? {
        requestedUrl: scanRow.requested_url as string,
        finalUrl: (scanRow.final_url as string | null) ?? null,
        ok: scanRow.ok === true,
        statusCode: (scanRow.status_code as number | null) ?? null,
        error: (scanRow.error as string | null) ?? null,
        createdAt: scanRow.created_at as string,
        signals: scanRow.ok === true ? (scanRow.result as ScanRecord["signals"]) : null,
      }
    : null;
  // Presence, deliberately NOT performance: cross-network metrics are never
  // ranked as equivalents, and presence is context — never attribution.
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
  const organic: OrganicPresence = {
    contentCount: organicRows.length,
    latestPublishedAt: publishedDates.at(-1) ?? null,
    platforms: [...new Set(organicItems.map((item) => item.platform).filter((p): p is string => Boolean(p)))],
    hasReview: Boolean(organicReview),
    reviewPeriodEnd: (organicReview?.period_end as string | null) ?? null,
    reviewInsufficientData: (organicReview?.insufficient_data as boolean | null) ?? null,
  };

  const evaluation = evaluateReadiness(profile, {
    hasLandingPage: Boolean(product.landingPageUrl),
    hasPrice: product.price != null || (product.plans?.some((plan) => plan.price != null) ?? false),
    // Same evidence the client used, so screen and verdict never disagree about
    // what was actually proved.
    signals: scanRecord?.ok ? scanRecord.signals : null,
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
      error: "Créditos insuficientes para verificar a prontidão.",
    };
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
    readinessChecklistBlock(profile, evaluation),
    "",
    "## Sinais locais (verificação determinística já exibida ao usuário)",
    readinessSignalsBlock(evaluation),
    "",
    "## Scan técnico da página (observado, não declarado)",
    readinessScanBlock(scanRecord),
    "",
    "## Presença orgânica deste produto",
    readinessOrganicBlock(organic),
    buildKnowledgeContext(excerpts),
    "",
    "## Tarefa",
    "Audite a prontidão desta estrutura para receber tráfego pago e devolva o veredito.",
    "Ordene as findings por alavancagem real: o que devolve mais dinheiro se for consertado primeiro.",
    "Item não marcado significa NÃO CONFIRMADO, nunca inexistente — quando confirmar for barato, a ação é confirmar.",
    "Quando o scan contradisser o checklist, trate a divergência como achado de primeira classe e prefira o observado.",
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
    if (creditError) {
      return {
        ok: false,
        code: "insufficient_credits",
        balance: ent.credit_balance ?? 0,
        cost: assistant.credits_per_message,
        error: "Créditos insuficientes para verificar a prontidão.",
      };
    }
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
