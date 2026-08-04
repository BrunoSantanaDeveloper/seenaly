"use server";

import { mapProductRow } from "../products/lib/map";

import { recordAudit } from "@/lib/audit";
import { loadCreativeEvidence } from "@/lib/creative-plan/evidence";
import { productContextBlock } from "@/lib/diagnosis/product-brief";
import { EXPERIMENT_BRIEF_LIMIT, experimentsBlock, type ExperimentSummaryRow } from "@/lib/experiments/brief";
import { notifyPlatformTeam } from "@/lib/notifications";
import { sanitizeJourneySignals } from "@/lib/readiness/assist";
import {
  type OrganicPresence,
  readinessChecklistBlock,
  readinessCreativesBlock,
  readinessFunnelModelBlock,
  readinessOrganicBlock,
  readinessRetrievalPlan,
  readinessScanBlock,
  readinessSignalsBlock,
  type ScanRecord,
  weightRetrievalPlan,
} from "@/lib/readiness/brief";
import {
  CHECKOUT_TYPES,
  type CheckoutType,
  EMPTY_READINESS_PROFILE,
  evaluateReadiness,
  FUNNEL_MODELS,
  type FunnelModel,
  READINESS_ITEM_KEYS,
  type ReadinessProfile,
  toReadinessProfile,
  toReadinessRow,
} from "@/lib/readiness/checklist";
import { failure, type ReadinessActionFailure } from "@/lib/readiness/errors";
import {
  HOWTO_JSON_SCHEMA,
  HOWTO_SCHEMA_NAME,
  type HowToOutput,
  isHowToOutput,
  normalizeStoredHowTo,
} from "@/lib/readiness/howto";
import { isPageSpeedConfigured, runPageSpeed } from "@/lib/readiness/pagespeed";
import { scanCooldownRemainingSeconds, scanSite } from "@/lib/readiness/scan";
import {
  citedExcerptIndexes,
  isReadinessOutput,
  READINESS_SCHEMA_NAME,
  readinessJsonSchema,
  readinessNextReviewDays,
  reconcileVerdict,
} from "@/lib/readiness/schema";
import { type AiProviderName, type AssistantConfig, getChatProvider } from "@flyee/ai";
import { createClient } from "@flyee/auth/server";
import { createServiceClient } from "@flyee/auth/service";
import { isInngestConfigured, sendEvent } from "@flyee/jobs";
import {
  buildKnowledgeContext,
  embedQueries,
  embedQuery,
  resolveCollectionIds,
  searchKnowledge,
} from "@flyee/knowledge";

const ASSISTANT_SLUG = "readiness-engine";
const HOWTO_ASSISTANT_SLUG = "readiness-howto";
/** The concierge catalog entry (migration 0032) — price lives in the DB. */
const ASSIST_OFFERING_SLUG = "readiness-item-session";

/**
 * ERROR CONTRACT (all actions in this file): failures return a stable CODE
 * from lib/readiness/errors — the client translates it via the
 * `readiness.error-*` catalog keys — plus an optional raw `detail` for the
 * technical secondary line. Never a user-facing literal here, and never
 * detect a case by matching the message string.
 */
export type SaveReadinessResult = { ok: true } | ReadinessActionFailure;
export type GenerateReadinessResult = { ok: true; id: string } | ReadinessActionFailure;

/** What a readiness check costs and what the org currently has. */
export type ReadinessCreditInfo =
  | { ok: true; balance: number; verdictCost: number; howToCost: number }
  | ReadinessActionFailure;

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
  if (error) return failure("load_failed", { detail: error.message });
  return {
    ok: true,
    balance: Number(balance ?? 0),
    verdictCost: Number(verdictAssistant?.credits_per_message ?? 0),
    howToCost: Number(howToAssistant?.credits_per_message ?? 0),
  };
}
/** A finished scan is a success even when the site was unreachable — the
 *  outcome is recorded and the UI explains it. Only "we could not even try"
 *  (no product, no URL, no session, cooldown) is a failure. */
export type ScanProductResult = { ok: true; scanned: boolean } | ReadinessActionFailure;

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
  const funnelModel = raw.funnelModel;
  profile.funnelModel = FUNNEL_MODELS.includes(funnelModel as FunnelModel) ? (funnelModel as FunnelModel) : null;
  return profile;
}

/** Persist the declared structure. Free — no credits, no LLM call.
 *
 * `journey` (optional) carries the concierge resistance signals (U5) into
 * product_readiness.extra. OMITTED from the payload when absent so an upsert
 * that only touches the profile can never wipe stored signals. */
export async function saveReadiness(
  productId: string,
  input: unknown,
  journey?: unknown,
): Promise<SaveReadinessResult> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return failure("session_expired");

  // RLS would reject the write anyway; reading the product first gives us the
  // org_id the row needs and a clear error instead of a policy violation.
  const { data: product } = await supabase
    .from("products")
    .select("id, org_id, name")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return failure("product_not_found");

  const profile = sanitizeProfile(input);
  // Whitelisted shape only, nested under extra.journey — the column is shared
  // headroom for future features, never a dumping ground.
  const journeySignals = journey === undefined ? null : sanitizeJourneySignals(journey);
  const { error } = await supabase.from("product_readiness").upsert(
    {
      product_id: productId,
      org_id: product.org_id,
      ...toReadinessRow(profile),
      ...(journeySignals ? { extra: { journey: journeySignals } } : {}),
      updated_by: user.user.id,
    },
    { onConflict: "product_id" },
  );
  if (error) return failure("save_failed", { detail: error.message });

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
 * never happened. The SSRF guarding lives in `lib/readiness/scan.ts`; the
 * per-product cooldown below is resource throttling for the outbound fetch
 * (decided: 60s fixed, not plan-tiered — anti-abuse, not billing surface).
 */
export async function scanProductSite(productId: string): Promise<ScanProductResult> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return failure("session_expired");

  const { data: product } = await supabase
    .from("products")
    .select("id, org_id, landing_page_url")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return failure("product_not_found");

  const url = (product.landing_page_url as string | null)?.trim();
  if (!url) return failure("no_landing_page");

  // Cooldown from the latest persisted attempt (failed scans count — they
  // also drove a fetch). A read error here FAILS OPEN: availability first,
  // the throttle is best-effort.
  const { data: lastScan } = await supabase
    .from("product_scans")
    .select("created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const remaining = scanCooldownRemainingSeconds((lastScan?.created_at as string | null) ?? null);
  if (remaining > 0) {
    // Nothing was mutated and nothing fetched — no insert, no audit.
    return failure("scan_cooldown", { retryAfterSeconds: remaining });
  }

  const outcome = await scanSite(url);

  // Official PageSpeed enrichment (V3) — optional and free, three paths:
  //  - key absent: invisible, the flow is byte-identical to before;
  //  - Inngest configured: insert with psi 'pending' and fire the job (PSI
  //    takes 10–25s, beyond what this action should hold open);
  //  - no Inngest: measure inline BEFORE the one user-session insert, because
  //    product_scans is append-only under RLS (no UPDATE policy for users).
  let resultPayload: Record<string, unknown> = outcome.signals ? { ...outcome.signals } : {};
  let firePageSpeed = false;
  if (outcome.ok && isPageSpeedConfigured()) {
    if (isInngestConfigured) {
      resultPayload = { ...resultPayload, psi: { status: "pending" } };
      firePageSpeed = true;
    } else {
      resultPayload = { ...resultPayload, psi: await runPageSpeed(outcome.finalUrl ?? url) };
    }
  }

  const { data: inserted, error } = await supabase
    .from("product_scans")
    .insert({
      product_id: productId,
      org_id: product.org_id,
      requested_url: outcome.requestedUrl,
      final_url: outcome.finalUrl,
      ok: outcome.ok,
      status_code: outcome.statusCode,
      error: outcome.error,
      result: resultPayload,
      created_by: user.user.id,
    })
    .select("id")
    .single();
  if (error || !inserted) return failure("save_failed", { detail: error?.message });

  if (firePageSpeed) {
    const sent = await sendEvent("readiness/pagespeed.requested", { scanId: inserted.id as string });
    if (!sent.sent) {
      // Configured-but-send-failed: measure inline and persist via the
      // service role (the only writer that can UPDATE the append-only table).
      // Without a service key the row honestly stays 'pending' — the UI copy
      // says a re-scan re-measures.
      try {
        const service = createServiceClient();
        const psi = await runPageSpeed(outcome.finalUrl ?? url);
        await service
          .from("product_scans")
          .update({ result: { ...resultPayload, psi } })
          .eq("id", inserted.id);
      } catch {
        // No service key either — leave 'pending'.
      }
    }
  }

  await recordAudit(supabase, "readiness.site_scanned", {
    orgId: product.org_id as string,
    entityType: "product",
    entityId: productId,
    metadata: {
      ok: outcome.ok,
      status: outcome.statusCode,
      error: outcome.error,
      psi: !outcome.ok || !isPageSpeedConfigured() ? "off" : firePageSpeed ? "queued" : "inline",
    },
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
  | ReadinessActionFailure;

/**
 * Read the concierge catalog plus which items already have an OPEN request.
 *
 * Both together: the UI must never offer to sell a session for something the
 * org already asked for and is waiting on — that is how you double-charge a
 * confused user. (The former orgId parameter was dead code — every query here
 * is by slug or product — and reading it from the wrong org was the multi-org
 * trap; it is gone.)
 */
export async function getAssistInfo(productId: string): Promise<AssistOfferingResult> {
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
  if (offeringError && offeringError.code !== "PGRST116") {
    return failure("load_failed", { detail: offeringError.message });
  }
  if (openError) return failure("load_failed", { detail: openError.message });
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

export type RequestAssistResult = { ok: true; id: string; alreadyOpen: boolean } | ReadinessActionFailure;

/**
 * Ask the Seenaly team to do one readiness item WITH the user, on a call.
 *
 * Charging order used to be handled here (insert first, charge second, delete
 * on failure) — but the compensating delete was a silent no-op: 0032 grants no
 * DELETE on readiness_assists, so a failed debit left a queued job nobody paid
 * for. And granting users delete rights would let a buggy client destroy a
 * PAID request with no refund. So insert + charge are now ONE transaction in
 * `record_assist_and_charge` (migration 0038): a double-click race collapses
 * into the winner's row without a second charge, and a failed debit rolls the
 * insert back — the burned-by-agencies user can never pay for nothing, and
 * never see a ghost request they did not pay for.
 */
export async function requestAssist(
  productId: string,
  itemKey: string,
  reason: string,
  contactNote: string,
): Promise<RequestAssistResult> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return failure("session_expired");

  // Never trust the client's idea of what a checklist item is.
  if (!(READINESS_ITEM_KEYS as string[]).includes(itemKey)) return failure("invalid_item");

  const { data: product } = await supabase
    .from("products")
    .select("id, org_id, name")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return failure("product_not_found");

  // Subscription gate — free check, charges nothing.
  const { data: entitlements } = await supabase.rpc("org_entitlements", { target_org: product.org_id });
  const ent = entitlements as { active?: boolean; suspended?: boolean } | null;
  if (!ent?.active) return failure(ent?.suspended ? "subscription_suspended" : "no_subscription");

  const { data: recorded, error: rpcError } = await supabase.rpc("record_assist_and_charge", {
    target_product: productId,
    p_item_key: itemKey,
    p_request_reason: reason,
    p_credit_reason: `Sessão guiada — ${itemKey}`,
    // Free text only. The UI states we never ask for passwords; the RPC caps
    // it at 2000 chars for the operator to read before the call.
    p_contact_note: contactNote,
  });
  if (rpcError) return failure("save_failed", { detail: rpcError.message });

  const payload = recorded as {
    ok?: boolean;
    code?: string;
    id?: string;
    already_open?: boolean;
    charged?: number;
  } | null;
  if (!payload?.ok) {
    if (payload?.code === "insufficient_credits") return failure("insufficient_credits");
    if (payload?.code === "assist_unavailable") return failure("assist_unavailable");
    return failure("save_failed");
  }

  // Audit + team ping only for a NEW request — a raced/already-open return is
  // the winner's already-recorded work.
  if (payload.already_open !== true) {
    await recordAudit(supabase, "readiness.assist_requested", {
      orgId: product.org_id as string,
      entityType: "product",
      entityId: productId,
      metadata: { item: itemKey, reason, credits: Number(payload.charged ?? 0) },
    });

    // Tell the team. Best-effort by design: a notification failure must never
    // undo a paid, recorded request — the row in the queue is the source of truth.
    await notifyPlatformTeam({
      title: "Nova sessão guiada pedida",
      body: `${product.name}: ${itemKey} (${reason})`,
      href: "/admin/assists",
    });
  }

  return { ok: true, id: payload.id as string, alreadyOpen: payload.already_open === true };
}

export type HowToResult =
  | { ok: true; howTo: HowToOutput; sources: { title: string; trust_level: number }[]; cached: boolean }
  | ReadinessActionFailure;

/**
 * Write the step-by-step for ONE finding, on demand.
 *
 * On demand and not inline: the user's complaint about the verdict was too much
 * text, so generating steps for every finding up front would make it worse.
 * Cached per (diagnosis, finding) — asking twice never charges twice: the
 * cache row is the idempotency key, and `record_readiness_howto_and_charge`
 * (migration 0039) makes insert + charge one transaction, so the double-click
 * race charges exactly once and both clicks get the same content.
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
  if (!verdict) return failure("verdict_not_found");
  if (verdict.scope !== "readiness") return failure("not_readiness_verdict");

  const output = verdict.output;
  if (!isReadinessOutput(output)) return failure("verdict_malformed");
  const finding = output.findings[findingIndex];
  if (!finding) return failure("finding_not_found");

  // Cache first — this is what keeps it a one-time cost per finding.
  const { data: cached } = await supabase
    .from("readiness_howtos")
    .select("steps, sources")
    .eq("diagnosis_id", diagnosisId)
    .eq("finding_index", findingIndex)
    .maybeSingle();
  if (cached) {
    return {
      ok: true,
      cached: true,
      howTo: normalizeStoredHowTo(cached.steps),
      sources: (cached.sources as { title: string; trust_level: number }[]) ?? [],
    };
  }

  const { data: entitlements } = await supabase.rpc("org_entitlements", { target_org: verdict.org_id });
  const ent = entitlements as { active?: boolean; suspended?: boolean; credit_balance?: number } | null;
  if (!ent?.active) return failure(ent?.suspended ? "subscription_suspended" : "no_subscription");

  const { data: assistant } = await supabase
    .from("assistants")
    .select("slug, provider, model, system_prompt, temperature, max_tokens, credits_per_message, config")
    .eq("slug", HOWTO_ASSISTANT_SLUG)
    .eq("is_active", true)
    .maybeSingle();
  if (!assistant) return failure("assistant_unavailable");
  // Pre-check so a clearly-short balance never pays for a doomed LLM call; the
  // RPC below remains the authoritative, race-proof gate.
  if (assistant.credits_per_message > 0 && (ent.credit_balance ?? 0) < assistant.credits_per_message) {
    return failure("insufficient_credits");
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
    // One embedding for the query, reused across collections. Searching per
    // collection keeps the 108-document Meta corpus from crowding out the
    // playbook, but the vector does not change per collection — embedding it
    // once per slug paid the API twice for the same answer.
    const embedding = await embedQuery(query);
    for (const slug of collectionSlugs) {
      const collectionIds = await resolveCollectionIds(supabase, [slug]);
      if (collectionIds.length === 0) continue;
      excerpts.push(
        ...(await searchKnowledge(supabase, embedding, {
          collectionIds,
          matchCount: perCollection,
          maxPerDocument: 2,
        })),
      );
    }
  } catch (error) {
    return failure("knowledge_failed", { detail: (error as Error).message });
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
    "Em references, copie os links OFICIAIS pertinentes que aparecerem nos trechos (url exatamente como está lá).",
    "Isso é obrigatório quando steps ficar vazio: sem passos, o link oficial é a única saída acionável do usuário.",
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
    return failure("engine_failed", { detail: (error as Error).message });
  }
  if (!isHowToOutput(raw)) return failure("engine_malformed");

  const sources = excerpts.map((excerpt) => ({ title: excerpt.title, trust_level: excerpt.trust_level }));

  // No steps = the knowledge base did not cover it. Say so, charge nothing, and
  // leave no cache row so a later retry (after new ingestion) can succeed.
  if (raw.steps.length === 0) {
    return { ok: true, cached: false, howTo: raw, sources: [] };
  }

  // Persist + charge in one transaction; on the 23505 race the RPC returns the
  // winner's row without charging this caller.
  const { data: recorded, error: rpcError } = await supabase.rpc("record_readiness_howto_and_charge", {
    p_diagnosis: diagnosisId,
    p_finding_index: findingIndex,
    p_steps: raw,
    p_sources: sources,
    p_reason: `Passo a passo — ${finding.dimension}`,
  });
  if (rpcError) return failure("save_failed", { detail: rpcError.message });
  const payload = recorded as {
    ok?: boolean;
    code?: string;
    raced?: boolean;
    steps?: unknown;
    sources?: unknown;
    charged?: number;
  } | null;
  if (!payload?.ok) {
    if (payload?.code === "insufficient_credits") return failure("insufficient_credits");
    return failure("save_failed");
  }
  if (payload.raced === true) {
    // Lost the double-click race: the winner's cached content, no charge, and
    // no audit (that is the winner's already-audited work).
    return {
      ok: true,
      cached: true,
      howTo: normalizeStoredHowTo(payload.steps),
      sources: (payload.sources as { title: string; trust_level: number }[]) ?? [],
    };
  }

  await recordAudit(supabase, "readiness.howto_generated", {
    orgId: verdict.org_id as string,
    entityType: "diagnosis",
    entityId: diagnosisId,
    metadata: { finding_index: findingIndex, steps: raw.steps.length, credits: Number(payload.charged ?? 0) },
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
    // Experiment memory (R2): "todo experimento concluído volta ao briefing" —
    // a structural fix concluded yesterday must not be re-recommended today.
    // Deliberately NOT filtered by origin: structural fixes also get concluded
    // from campaign diagnoses and manual entries, and the recency window
    // already bounds tokens. Most-recent window; experimentsBlock re-orders it
    // concluded-first (same rationale as the campaign engine's query).
    supabase
      .from("experiments")
      .select("title, status, hypothesis, result, conclusion, next_step")
      .eq("product_id", productId)
      .order("updated_at", { ascending: false })
      .limit(EXPERIMENT_BRIEF_LIMIT),
  ]);
  if (!row) return failure("product_not_found");
  const product = mapProductRow(row, {
    objections: objections ?? [],
    proofs: proofs ?? [],
    plans: planRows ?? [],
  });

  // Creative evidence for the `midia` dimension (S3) — two dependent queries,
  // so it cannot join the Promise.all above. Presence, never performance.
  const creatives = await loadCreativeEvidence(supabase, productId);

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

  // Subscription gate. Credits are only DEBITED after a valid verdict — the
  // record RPC below makes "persist + charge" one transaction, so a failed
  // RAG/LLM call or a failed insert can never cost the user anything.
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

  // Pre-check so a clearly-short balance never pays for RAG + a doomed LLM
  // call; the record RPC remains the authoritative, race-proof gate.
  if (assistant.credits_per_message > 0 && (ent.credit_balance ?? 0) < assistant.credits_per_message) {
    return failure("insufficient_credits", {
      balance: ent.credit_balance ?? 0,
      cost: assistant.credits_per_message,
    });
  }

  // In-flight lock (migration 0040): two tabs must not pay for two verdicts.
  // FAIL OPEN on RPC errors (e.g. migration not applied yet): the lock is cost
  // control, and lock infrastructure must never gate the product's value —
  // an error here degrades to exactly the pre-lock behavior.
  const { data: claimed, error: claimError } = await supabase.rpc("claim_readiness_run", {
    target_product: productId,
  });
  if (!claimError && claimed === false) return failure("generation_in_progress");

  try {
    // Ground in the knowledge base with ONE question per audited dimension
    // (see `readinessRetrievalPlan`). Each question carries its own collection
    // weights, which is what the old blind 50/50 loop was standing in for: the
    // large trust-1 Meta corpus owns measurement, the playbook owns conversion
    // structure, and neither should crowd the other out of a subject it owns.
    const excerpts: Awaited<ReturnType<typeof searchKnowledge>> = [];
    // Weighted by THIS business's gaps: budget shrinks only on what the scan
    // proved, grows where the scan contradicts the checklist. See
    // `weightRetrievalPlan` for why proof and not the tick.
    const plan = weightRetrievalPlan(
      readinessRetrievalPlan(Boolean(product.landingPageUrl), profile.funnelModel),
      evaluation,
    );
    try {
      // Collections resolved once, and every question embedded in a SINGLE
      // batch — decomposition costs one embedding call for the whole plan,
      // fewer than the two the previous single query paid (once per collection).
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
            // One chunk per document, not two. With a broad query, two chunks
            // from the best document add context; with a question this narrow,
            // they cost a document. `maxPerDocument: 2` against a budget of 4
            // caps the answer at two documents by construction — and what
            // decides the verdict is whether the document carrying the rule is
            // present at all, not how much of it. Measured on the real index:
            // recall 64% -> 79% (`npm run eval:retrieval`).
            searchKnowledge(supabase, vector, {
              collectionIds,
              matchCount,
              maxPerDocument: 1,
              // Hybrid: these questions are full of proper nouns ("API de
              // Conversões", "fase de aprendizado", "PIX") that dense
              // retrieval averages away. Safe here precisely because the
              // questions are focused — see `readinessRetrievalPlan`.
              queryText: query.text,
            }),
          );
      });
      for (const batch of await Promise.all(searches)) excerpts.push(...batch);
    } catch (error) {
      return failure("knowledge_failed", { detail: (error as Error).message });
    }

    // A single dimension coming back empty is legitimate — it means the corpus
    // does not cover it, and saying so beats inventing grounding. EVERY
    // dimension coming back empty is a fault: the collections are global and
    // always populated, so zero excerpts across the whole plan means the corpus,
    // the slugs or the similarity floor is broken. Continuing would produce a
    // confident verdict with no citable rule behind it — the generic
    // recommendation this engine exists to prevent — so fail before the charge.
    if (excerpts.length === 0) {
      return failure("knowledge_empty", { detail: `queries: ${plan.map((query) => query.key).join(", ")}` });
    }

    // The same chunk can win more than one dimension; keep the first hit so the
    // engine is not handed the same excerpt twice under different numbers.
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
      // Comes BEFORE the checklist on purpose: it decides which surface each
      // dimension is about, so the engine must read it first.
      "## Modelo de aquisição (define QUAL superfície cada dimensão audita)",
      readinessFunnelModelBlock(profile),
      "",
      "## Checklist de prontidão declarado pelo usuário",
      readinessChecklistBlock(profile, evaluation),
      "",
      "## Sinais locais (verificação determinística já exibida ao usuário)",
      readinessSignalsBlock(evaluation),
      "",
      "## Scan técnico da página (observado, não declarado)",
      readinessScanBlock(scanRecord, profile.funnelModel),
      "",
      "## Presença orgânica deste produto",
      readinessOrganicBlock(organic),
      "",
      "## Evidência criativa deste produto (presença, não desempenho)",
      readinessCreativesBlock(creatives),
      "",
      "## Memória de experimentos",
      experimentsBlock((experimentRows as ExperimentSummaryRow[]) ?? []),
      buildKnowledgeContext(uniqueExcerpts),
      "",
      "## Tarefa",
      "Audite a prontidão desta estrutura para receber tráfego pago e devolva o veredito.",
      "Ordene as findings por alavancagem real: o que devolve mais dinheiro se for consertado primeiro.",
      "Item não marcado significa NÃO CONFIRMADO, nunca inexistente — quando confirmar for barato, a ação é confirmar.",
      "Quando o scan contradisser o checklist, trate a divergência como achado de primeira classe e prefira o observado.",
      "Construa sobre a memória de experimentos: NÃO recomende de novo uma correção cujo experimento já está CONCLUÍDO — parta da conclusão registrada. Se uma conclusão contradisser o checklist declarado, aponte a divergência em vez de escolher um lado em silêncio.",
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
        // Scoped to this business: the valid related_items keys ARE the
        // checklist it was shown, so the engine cannot name one that does not
        // apply (a direct sale never sees an activation key).
        schema: readinessJsonSchema(profile.funnelModel),
      });
    } catch (error) {
      return failure("engine_failed", { detail: (error as Error).message });
    }

    if (!isReadinessOutput(output)) return failure("engine_malformed");
    const verdict = reconcileVerdict(output);
    const cited = citedExcerptIndexes(verdict, uniqueExcerpts.length);

    // Re-audit cadence (R1): unlike the campaign diagnosis, readiness ALWAYS
    // sets next_review_at — the reminder is the loop's engine, so a model
    // omission must never silently disable it. The LLM proposes, the server
    // guarantees (clamp + verdict-based fallback).
    const reviewDays = readinessNextReviewDays(verdict);
    const nextReviewAt = new Date(Date.now() + reviewDays * 24 * 60 * 60 * 1000).toISOString();

    // Persist + charge in ONE transaction (migration 0038): the user pays if
    // and only if the verdict row exists. A failed debit rolls the insert
    // back; a failed insert charges nothing.
    const { data: recorded, error: recordError } = await supabase.rpc("record_diagnosis_and_charge", {
      target_org: product.orgId,
      target_product: product.id,
      p_scope: "readiness",
      p_assistant_slug: assistant.slug,
      p_model: assistant.model,
      p_output: verdict,
      p_confidence: verdict.confidence,
      p_insufficient_data: verdict.insufficient_data,
      // Readiness never reads media data — that is the whole point.
      p_had_campaign_data: false,
      // `used` resolves the engine's `[n]` citations back to documents. Without
      // it the UI credits everything RETRIEVED as grounding, including excerpts
      // the model never cited — a claim we cannot back, in the one product
      // where "cites its source" is the promise. Everything stays persisted:
      // the retrieved-but-unused set is what makes a weak retrieval visible
      // later, so it is marked, never dropped.
      p_knowledge_refs: uniqueExcerpts.map((excerpt, index) => ({
        title: excerpt.title,
        source: excerpt.source,
        trust_level: excerpt.trust_level,
        similarity: excerpt.similarity,
        used: cited.has(index + 1),
      })),
      p_reason: `Prontidão — ${product.name}`,
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

    await recordAudit(supabase, "readiness.verdict_generated", {
      orgId: product.orgId,
      entityType: "diagnosis",
      entityId: payload.id as string,
      metadata: {
        verdict: verdict.verdict,
        blocking: verdict.blocking.length,
        credits: Number(payload.charged ?? 0),
        next_review_days: reviewDays,
      },
    });

    return { ok: true, id: payload.id as string };
  } finally {
    // Best-effort release; the TTL is the backstop for a crashed run.
    if (!claimError) {
      await supabase.rpc("release_readiness_run", { target_product: productId });
    }
  }
}
