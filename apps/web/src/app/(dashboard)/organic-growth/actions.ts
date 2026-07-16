"use server";

import type {
  OrganicClassificationInput,
  OrganicIdResult,
  OrganicImportInput,
  OrganicImportResult,
  OrganicReviewRequest,
  OrganicSetupInput,
  RecommendationFeedback,
} from "./types";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";

import { recordAudit } from "@/lib/audit";
import { type AiProviderName, type AssistantConfig, getChatProvider } from "@flyee/ai";
import { createClient } from "@flyee/auth/server";
import { createServiceClient } from "@flyee/auth/service";
import {
  buildOrganicReview,
  CLASSIFICATION_JSON_SCHEMA,
  isFunnelStage,
  isNarrativeType,
  isOrganicClassificationOutput,
  isSocialPlatform,
  isStrategicIntent,
  ORGANIC_TAXONOMY_VERSION,
  type OrganicAnalysisContext,
  type OrganicContentRecord,
  type OrganicRecommendation,
  parseOrganicCsv,
  type SocialPlatform,
} from "@flyee/organic-growth";
import type { SupabaseClient, User } from "@supabase/supabase-js";

const CLASSIFIER_SLUG = "organic-growth-classifier";
const MAX_ORGANIC_CSV_BYTES = 2_000_000;

type ErrorResult = { ok: false; code: string; details?: string };
type AccessResult =
  | {
      ok: true;
      supabase: SupabaseClient;
      user: User;
      limits: Record<string, unknown>;
    }
  | ErrorResult;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isIsoDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function nullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function errorCode(message: string | undefined, fallback = "save-failed"): ErrorResult {
  return { ok: false, code: fallback, ...(message ? { details: message } : {}) };
}

function getService(): ReturnType<typeof createServiceClient> | null {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

async function requireOrganicAccess(orgId: string, options: { requireEnabled?: boolean } = {}): Promise<AccessResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "unauthenticated" };

  const { data, error } = await supabase.rpc("org_entitlements", { target_org: orgId });
  if (error) return errorCode(error.message, "forbidden");
  const entitlement = data as {
    active?: boolean;
    suspended?: boolean;
    limits?: Record<string, unknown>;
  } | null;
  if (!entitlement?.active) {
    return { ok: false, code: entitlement?.suspended ? "subscription-suspended" : "subscription-required" };
  }
  if (entitlement.limits?.organic_growth !== true) return { ok: false, code: "addon-required" };

  if (options.requireEnabled) {
    const { data: settings } = await supabase
      .from("organic_growth_settings")
      .select("enabled")
      .eq("org_id", orgId)
      .maybeSingle();
    if (!settings?.enabled) return { ok: false, code: "module-disabled" };
  }

  return { ok: true, supabase, user, limits: entitlement.limits ?? {} };
}

async function linkedScope(supabase: SupabaseClient, orgId: string, productId: string, socialAccountId: string) {
  const [productResult, accountResult, linkResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, audience, main_promise")
      .eq("org_id", orgId)
      .eq("id", productId)
      .maybeSingle(),
    supabase
      .from("social_accounts")
      .select("id, platform, name, handle, status")
      .eq("org_id", orgId)
      .eq("id", socialAccountId)
      .maybeSingle(),
    supabase
      .from("social_account_products")
      .select("objective, desired_action")
      .eq("org_id", orgId)
      .eq("social_account_id", socialAccountId)
      .eq("product_id", productId)
      .maybeSingle(),
  ]);
  if (!productResult.data || !accountResult.data || !linkResult.data) return null;
  return { product: productResult.data, account: accountResult.data, link: linkResult.data };
}

export async function saveOrganicSetup(input: OrganicSetupInput): Promise<OrganicIdResult> {
  const access = await requireOrganicAccess(input.orgId);
  if (!access.ok) return access;
  if (
    !isSocialPlatform(input.platform) ||
    !Number.isInteger(input.analysisWindowDays) ||
    input.analysisWindowDays < 1 ||
    input.analysisWindowDays > 3650 ||
    !input.accountName.trim() ||
    !input.objective.trim() ||
    !input.desiredAction.trim()
  ) {
    return { ok: false, code: "save-failed" };
  }
  const { supabase, user, limits } = access;

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("id", input.productId)
    .maybeSingle();
  if (!product) return { ok: false, code: "product-not-found" };

  const accountLimit = Number(limits.organic_social_accounts ?? 1);
  const { count: accountCount } = await supabase
    .from("social_accounts")
    .select("id", { count: "exact", head: true })
    .eq("org_id", input.orgId)
    .neq("status", "disconnected");

  const accountKey =
    nullable(input.accountHandle)?.replace(/^@/u, "").toLocaleLowerCase("pt-BR") ||
    digest(input.accountName.trim().toLocaleLowerCase("pt-BR")).slice(0, 16);
  const externalAccountId = `declared:${accountKey}`;
  const { data: existing } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("platform", input.platform)
    .eq("external_account_id", externalAccountId)
    .maybeSingle();
  if (!existing && (accountCount ?? 0) >= accountLimit) return { ok: false, code: "account-limit" };

  const now = new Date().toISOString();
  const { error: settingsError } = await supabase.from("organic_growth_settings").upsert(
    {
      org_id: input.orgId,
      enabled: true,
      analysis_window_days: input.analysisWindowDays,
      activated_at: now,
      activated_by: user.id,
    },
    { onConflict: "org_id" },
  );
  if (settingsError) return errorCode(settingsError.message);

  const { data: account, error: accountError } = await supabase
    .from("social_accounts")
    .upsert(
      {
        org_id: input.orgId,
        platform: input.platform,
        external_account_id: externalAccountId,
        name: input.accountName.trim(),
        handle: nullable(input.accountHandle),
        status: "active",
        metadata: { mode: "declared_csv", oauth: false },
        created_by: user.id,
      },
      { onConflict: "org_id,platform,external_account_id" },
    )
    .select("id")
    .single();
  if (accountError || !account) return errorCode(accountError?.message);

  const { error: clearPrimaryError } = await supabase
    .from("social_account_products")
    .update({ is_primary: false })
    .eq("org_id", input.orgId)
    .eq("social_account_id", account.id)
    .neq("product_id", input.productId);
  if (clearPrimaryError) return errorCode(clearPrimaryError.message);
  const { error: linkError } = await supabase.from("social_account_products").upsert(
    {
      org_id: input.orgId,
      social_account_id: account.id,
      product_id: input.productId,
      objective: input.objective.trim(),
      desired_action: input.desiredAction.trim(),
      is_primary: true,
      created_by: user.id,
    },
    { onConflict: "social_account_id,product_id" },
  );
  if (linkError) return errorCode(linkError.message);

  await recordAudit(supabase, "organic.module.activated", {
    orgId: input.orgId,
    entityType: "social_account",
    entityId: account.id,
    metadata: { platform: input.platform, productId: input.productId, mode: "declared_csv" },
  });
  revalidatePath("/organic-growth");
  return { ok: true, id: account.id };
}

export async function setOrganicGrowthEnabled(orgId: string, enabled: boolean) {
  const access = await requireOrganicAccess(orgId);
  if (!access.ok) return access;
  const { error } = await access.supabase
    .from("organic_growth_settings")
    .update({ enabled, ...(enabled ? { activated_at: new Date().toISOString(), activated_by: access.user.id } : {}) })
    .eq("org_id", orgId);
  if (error) return errorCode(error.message);
  await recordAudit(access.supabase, enabled ? "organic.module.activated" : "organic.module.deactivated", { orgId });
  revalidatePath("/organic-growth");
  return { ok: true as const };
}

function hasMetrics(row: OrganicContentRecord) {
  return Object.values(row.metrics).some((value) => value !== undefined);
}

function contentName(row: OrganicContentRecord) {
  return (row.title || row.caption || `${row.platform} ${row.publishedAt.slice(0, 10)}`).slice(0, 180);
}

function normalizedAccount(value: string): string {
  return value.trim().replace(/^@/u, "").toLocaleLowerCase("pt-BR");
}

export async function importOrganicCsv(input: OrganicImportInput): Promise<OrganicImportResult> {
  const access = await requireOrganicAccess(input.orgId, { requireEnabled: true });
  if (!access.ok) return access;
  if (Buffer.byteLength(input.csv, "utf8") > MAX_ORGANIC_CSV_BYTES) {
    return { ok: false, code: "file-too-large" };
  }
  const { supabase, user } = access;
  const scope = await linkedScope(supabase, input.orgId, input.productId, input.socialAccountId);
  if (!scope) return { ok: false, code: "scope-not-found" };
  if (scope.account.status !== "active") return { ok: false, code: "account-inactive" };

  const parsed = parseOrganicCsv(input.csv, {
    defaultPlatform: scope.account.platform as SocialPlatform,
    defaultAccount: scope.account.handle || scope.account.name || scope.account.id,
  });
  if (parsed.fatal || parsed.rows.length === 0) {
    return {
      ok: false,
      code: "csv-invalid",
      errors: parsed.errors.map((issue) => `Linha ${issue.row}: ${issue.message}`),
    };
  }

  const idempotencyKey = digest(`${input.orgId}|${input.productId}|${input.socialAccountId}|${input.csv}`);
  const { data: previous } = await supabase
    .from("organic_import_batches")
    .select("id, imported_rows, rejected_rows, status, error_summary, created_at")
    .eq("org_id", input.orgId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (previous && (previous.status === "completed" || previous.status === "partial")) {
    return {
      ok: true,
      id: previous.id,
      imported: previous.imported_rows,
      updated: 0,
      rejected: previous.rejected_rows,
      errors: (previous.error_summary as string[]) ?? [],
    };
  }

  const service = getService();
  if (!service) return { ok: false, code: "service-not-configured" };
  const initialErrors = parsed.errors.map((issue) => `Linha ${issue.row}: ${issue.message}`);
  let batch: { id: string; created_at: string } | null = null;
  if (previous) {
    const { data: resetBatch, error: resetError } = await service
      .from("organic_import_batches")
      .update({
        status: "queued",
        file_name: nullable(input.fileName),
        total_rows: parsed.totalRows,
        imported_rows: 0,
        rejected_rows: parsed.rejectedRows,
        error_summary: initialErrors,
        started_at: null,
        completed_at: null,
      })
      .eq("id", previous.id)
      .eq("org_id", input.orgId)
      .in("status", ["queued", "processing", "failed"])
      .select("id, created_at")
      .maybeSingle();
    if (resetError || !resetBatch) return errorCode(resetError?.message, "import-reset-failed");
    batch = resetBatch;
  } else {
    const { data: createdBatch, error: batchError } = await supabase
      .from("organic_import_batches")
      .insert({
        org_id: input.orgId,
        source: "csv",
        status: "queued",
        file_name: nullable(input.fileName),
        idempotency_key: idempotencyKey,
        total_rows: parsed.totalRows,
        rejected_rows: parsed.rejectedRows,
        error_summary: initialErrors,
        created_by: user.id,
      })
      .select("id, created_at")
      .single();
    if (batchError || !createdBatch) return errorCode(batchError?.message, "import-create-failed");
    batch = createdBatch;
  }

  const { error: processingError } = await service
    .from("organic_import_batches")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", batch.id)
    .eq("org_id", input.orgId);
  if (processingError) return errorCode(processingError.message, "import-start-failed");

  let imported = 0;
  let updated = 0;
  const processingErrors: string[] = [];
  const expectedAccounts = new Set(
    [scope.account.handle, scope.account.name, scope.account.id]
      .filter((value): value is string => Boolean(value))
      .map(normalizedAccount),
  );

  for (const row of parsed.rows) {
    try {
      if (row.platform !== scope.account.platform || !expectedAccounts.has(normalizedAccount(row.account))) {
        throw new Error("A plataforma ou a conta da linha não corresponde ao escopo selecionado.");
      }
      const sourceKey = digest(
        `${input.socialAccountId}|${row.externalId ? `id:${row.externalId}` : `url:${row.url ?? row.id}`}`,
      );
      let { data: content } = await supabase
        .from("organic_content_items")
        .select("id, creative_id")
        .eq("org_id", input.orgId)
        .eq("source", "csv")
        .eq("source_key", sourceKey)
        .maybeSingle();

      let creativeId = content?.creative_id as string | null | undefined;
      if (!creativeId) {
        const { data: creative, error: creativeError } = await supabase
          .from("creatives")
          .insert({
            org_id: input.orgId,
            product_id: input.productId,
            name: contentName(row),
            status: "testing",
            source: "organic",
            format: row.format,
            funnel_stage: row.funnelStage ?? null,
            duration_seconds: row.durationSeconds ?? null,
            hook: row.hook ?? null,
            promise: row.promise ?? null,
            cta: row.cta ?? null,
            proof_type: row.proof ?? null,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (creativeError || !creative) throw new Error(creativeError?.message ?? "Falha ao criar ativo criativo.");
        creativeId = creative.id;
      }

      const contentPayload = {
        org_id: input.orgId,
        social_account_id: input.socialAccountId,
        creative_id: creativeId,
        import_batch_id: batch.id,
        platform: row.platform,
        source: "csv",
        status: "published",
        external_content_id: row.externalId ?? null,
        source_key: sourceKey,
        format: row.format,
        permalink_url: row.url ?? null,
        title: row.title ?? null,
        caption: row.caption ?? null,
        duration_seconds: row.durationSeconds ?? null,
        published_at: row.publishedAt,
        raw: { normalizedCsvRow: row },
        created_by: user.id,
      };

      if (content) {
        const { error } = await supabase.from("organic_content_items").update(contentPayload).eq("id", content.id);
        if (error) throw new Error(error.message);
        updated += 1;
      } else {
        const created = await supabase
          .from("organic_content_items")
          .insert(contentPayload)
          .select("id, creative_id")
          .single();
        if (created.error || !created.data) throw new Error(created.error?.message ?? "Falha ao criar publicação.");
        content = created.data;
        imported += 1;
      }

      const { error: productLinkError } = await supabase.from("organic_content_products").upsert(
        {
          org_id: input.orgId,
          content_id: content.id,
          product_id: input.productId,
          is_primary: true,
          created_by: user.id,
        },
        { onConflict: "content_id,product_id" },
      );
      if (productLinkError) throw new Error(productLinkError.message);

      if (row.funnelStage || row.strategicIntent || row.narrativeType) {
        const classificationPayload = {
          org_id: input.orgId,
          content_id: content.id,
          product_id: input.productId,
          source: "import",
          funnel_stage: row.funnelStage ?? null,
          strategic_intent: row.strategicIntent ?? null,
          narrative_type: row.narrativeType ?? null,
          theme: row.theme ?? null,
          hook: row.hook ?? null,
          promise: row.promise ?? null,
          proof: row.proof ?? null,
          cta: row.cta ?? null,
          confidence: row.classificationConfidence ?? "baixa",
          taxonomy_version: ORGANIC_TAXONOMY_VERSION,
          input_hash: digest(JSON.stringify(row)),
          idempotency_key: digest(`import|${content.id}|${input.productId}|${JSON.stringify(row)}`),
          created_by: user.id,
        };
        const { error } = await supabase.from("organic_content_classifications").upsert(classificationPayload, {
          onConflict: "org_id,idempotency_key",
          ignoreDuplicates: true,
        });
        if (error) throw new Error(error.message);
      }

      if (hasMetrics(row)) {
        const capturedAt = row.observedAt ?? batch.created_at;
        const { error } = await supabase.from("organic_content_metric_snapshots").upsert(
          {
            org_id: input.orgId,
            content_id: content.id,
            import_batch_id: batch.id,
            source: "csv",
            captured_at: capturedAt,
            impressions: row.metrics.impressions ?? null,
            reach: row.metrics.reach ?? null,
            views: row.metrics.views ?? null,
            plays: row.metrics.plays ?? null,
            average_watch_time_seconds: row.metrics.averageWatchTimeSeconds ?? null,
            average_percentage_viewed: row.metrics.averageWatchPercentage ?? null,
            likes: row.metrics.likes ?? null,
            comments: row.metrics.comments ?? null,
            shares: row.metrics.shares ?? null,
            saves: row.metrics.saves ?? null,
            profile_visits: row.metrics.profileVisits ?? null,
            link_clicks: row.metrics.linkClicks ?? null,
            leads: row.metrics.leads ?? null,
            assisted_conversions: row.metrics.assistedConversions ?? null,
            raw: { declared: true, metrics: row.metrics },
            created_by: user.id,
          },
          { onConflict: "content_id,captured_at,source", ignoreDuplicates: true },
        );
        if (error) throw new Error(error.message);
      }
    } catch (error) {
      processingErrors.push(`Linha ${row.rowNumber ?? "?"}: ${(error as Error).message}`);
    }
  }

  const rejected = parsed.rejectedRows + processingErrors.length;
  const status = processingErrors.length > 0 || parsed.rejectedRows > 0 ? "partial" : "completed";
  await service
    .from("organic_import_batches")
    .update({
      status,
      imported_rows: imported + updated,
      rejected_rows: rejected,
      error_summary: [...parsed.errors.map((issue) => `Linha ${issue.row}: ${issue.message}`), ...processingErrors],
      completed_at: new Date().toISOString(),
    })
    .eq("id", batch.id)
    .eq("org_id", input.orgId);

  await recordAudit(supabase, "organic.import.created", {
    orgId: input.orgId,
    entityType: "organic_import_batch",
    entityId: batch.id,
    metadata: { imported, updated, rejected, platform: scope.account.platform },
  });
  revalidatePath("/organic-growth");
  revalidatePath("/organic-growth/content");
  return { ok: true, id: batch.id, imported, updated, rejected, errors: processingErrors };
}

export async function saveOrganicClassification(input: OrganicClassificationInput): Promise<OrganicIdResult> {
  const access = await requireOrganicAccess(input.orgId, { requireEnabled: true });
  if (!access.ok) return access;
  if (
    !isFunnelStage(input.funnelStage) ||
    !isStrategicIntent(input.strategicIntent) ||
    !isNarrativeType(input.narrativeType)
  ) {
    return { ok: false, code: "classification-save-failed" };
  }
  const { supabase, user } = access;
  const { data: content } = await supabase
    .from("organic_content_items")
    .select("id, creative_id")
    .eq("org_id", input.orgId)
    .eq("id", input.contentId)
    .maybeSingle();
  const { data: productLink } = await supabase
    .from("organic_content_products")
    .select("product_id")
    .eq("org_id", input.orgId)
    .eq("content_id", input.contentId)
    .eq("product_id", input.productId)
    .maybeSingle();
  if (!content || !productLink) return { ok: false, code: "content-not-found" };

  let correctedFromId: string | null = null;
  if (input.correctedFromId) {
    const { data: correctedFrom } = await supabase
      .from("organic_content_classifications")
      .select("id")
      .eq("org_id", input.orgId)
      .eq("id", input.correctedFromId)
      .eq("content_id", input.contentId)
      .eq("product_id", input.productId)
      .maybeSingle();
    if (!correctedFrom) return { ok: false, code: "classification-save-failed" };
    correctedFromId = correctedFrom.id;
  }

  const payload = {
    funnel_stage: input.funnelStage,
    strategic_intent: input.strategicIntent,
    narrative_type: input.narrativeType,
    theme: nullable(input.theme),
    hook: nullable(input.hook),
    angle: nullable(input.angle),
    promise: nullable(input.promise),
    pain: nullable(input.pain),
    desire: nullable(input.desire),
    objection: nullable(input.objection),
    proof: nullable(input.proof),
    cta: nullable(input.cta),
    audience: nullable(input.audience),
    visual_style: nullable(input.visualStyle),
    tone_of_voice: nullable(input.toneOfVoice),
  };
  const idempotencyKey = digest(`user|${input.orgId}|${input.contentId}|${input.productId}|${JSON.stringify(payload)}`);
  const { data: existing } = await supabase
    .from("organic_content_classifications")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  let classificationId = existing?.id as string | undefined;
  if (!classificationId) {
    const { data: classification, error } = await supabase
      .from("organic_content_classifications")
      .insert({
        org_id: input.orgId,
        content_id: input.contentId,
        product_id: input.productId,
        corrected_from_id: correctedFromId,
        source: "user",
        ...payload,
        confidence: "alta",
        taxonomy_version: ORGANIC_TAXONOMY_VERSION,
        input_hash: digest(JSON.stringify(payload)),
        idempotency_key: idempotencyKey,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !classification) return errorCode(error?.message);
    classificationId = classification.id;
  }
  if (!classificationId) return { ok: false, code: "classification-save-failed" };

  if (content.creative_id) {
    await supabase
      .from("creatives")
      .update({
        funnel_stage: input.funnelStage,
        hook: nullable(input.hook),
        angle: nullable(input.angle),
        promise: nullable(input.promise),
        pain: nullable(input.pain),
        desire: nullable(input.desire),
        objection: nullable(input.objection),
        cta: nullable(input.cta),
        proof_type: nullable(input.proof),
        presumed_audience: nullable(input.audience),
        visual_style: nullable(input.visualStyle),
      })
      .eq("id", content.creative_id)
      .eq("org_id", input.orgId);
  }

  await recordAudit(supabase, "organic.classification.corrected", {
    orgId: input.orgId,
    entityType: "organic_content",
    entityId: input.contentId,
    metadata: { productId: input.productId, classificationId },
  });
  revalidatePath(`/organic-growth/content/${input.contentId}`);
  revalidatePath("/organic-growth/content");
  return { ok: true, id: classificationId };
}

export async function classifyOrganicContent(input: {
  orgId: string;
  productId: string;
  contentId: string;
}): Promise<OrganicIdResult> {
  const access = await requireOrganicAccess(input.orgId, { requireEnabled: true });
  if (!access.ok) return access;
  const { supabase, user } = access;

  const [contentResult, productResult, scopeResult, assistantResult] = await Promise.all([
    supabase
      .from("organic_content_items")
      .select("id, creative_id, title, caption, description, format, platform, duration_seconds")
      .eq("org_id", input.orgId)
      .eq("id", input.contentId)
      .maybeSingle(),
    supabase
      .from("products")
      .select("id, name, audience, main_promise, description")
      .eq("org_id", input.orgId)
      .eq("id", input.productId)
      .maybeSingle(),
    supabase
      .from("organic_content_products")
      .select("product_id")
      .eq("org_id", input.orgId)
      .eq("content_id", input.contentId)
      .eq("product_id", input.productId)
      .maybeSingle(),
    supabase
      .from("assistants")
      .select("slug, provider, model, system_prompt, temperature, max_tokens, credits_per_message, config")
      .eq("slug", CLASSIFIER_SLUG)
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  if (!contentResult.data || !productResult.data || !scopeResult.data) return { ok: false, code: "content-not-found" };
  if (!assistantResult.data) return { ok: false, code: "classifier-not-configured" };

  const content = contentResult.data;
  const product = productResult.data;
  const assistant = assistantResult.data;
  const inputText = [
    `Produto: ${product.name}`,
    `Público: ${product.audience || "não informado"}`,
    `Promessa: ${product.main_promise || "não informada"}`,
    `Plataforma: ${content.platform}`,
    `Formato: ${content.format || "não informado"}`,
    `Duração: ${content.duration_seconds ?? "não informada"}`,
    `Título: ${content.title || ""}`,
    `Legenda: ${content.caption || ""}`,
    `Descrição: ${content.description || ""}`,
    "Classifique somente o texto e os metadados fornecidos. Não diga que viu, ouviu ou analisou a mídia.",
  ].join("\n");
  const inputHash = digest(inputText);
  const promptVersion = String(
    (assistant.config as { promptVersion?: string } | null)?.promptVersion ?? "organic-classifier-v1",
  );
  const idempotencyKey = digest(
    `ai|${input.orgId}|${input.contentId}|${input.productId}|${inputHash}|${promptVersion}`,
  );
  const { data: previous } = await supabase
    .from("organic_content_classifications")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (previous) return { ok: true, id: previous.id };

  const service = getService();
  if (!service) return { ok: false, code: "service-not-configured" };

  const config: AssistantConfig = {
    provider: assistant.provider as AiProviderName,
    model: assistant.model,
    systemPrompt: assistant.system_prompt,
    temperature: Number(assistant.temperature),
    maxTokens: assistant.max_tokens,
  };
  let output: unknown;
  try {
    output = await getChatProvider(config.provider).generateStructured(config, [{ role: "user", content: inputText }], {
      name: "organic_growth_classification",
      description: "Classificação textual de conteúdo orgânico na taxonomia v1 do Seenaly.",
      schema: CLASSIFICATION_JSON_SCHEMA as Record<string, unknown>,
    });
  } catch (error) {
    return errorCode((error as Error).message, "classifier-failed");
  }
  if (!isOrganicClassificationOutput(output)) return { ok: false, code: "classifier-invalid-output" };

  if (assistant.credits_per_message > 0) {
    const { error } = await supabase.rpc("consume_credits", {
      target_org: input.orgId,
      amount: assistant.credits_per_message,
      reason: `Classificação Organic Growth — ${product.name}`,
    });
    if (error) return { ok: false, code: "credits-insufficient" };
  }

  const { data: classification, error } = await service
    .from("organic_content_classifications")
    .insert({
      org_id: input.orgId,
      content_id: input.contentId,
      product_id: input.productId,
      source: "ai",
      funnel_stage: output.funnel_stage,
      strategic_intent: output.strategic_intent,
      narrative_type: output.narrative_type,
      theme: output.theme,
      hook: nullable(output.hook),
      angle: nullable(output.angle),
      promise: nullable(output.promise),
      pain: nullable(output.pain),
      desire: nullable(output.desire),
      objection: nullable(output.objection),
      proof: nullable(output.proof),
      cta: nullable(output.cta),
      audience: nullable(output.audience),
      visual_style: nullable(output.visual_style),
      tone_of_voice: nullable(output.tone_of_voice),
      confidence: output.confidence,
      evidence: [{ source: "text_and_metadata", limitation: "media_not_analyzed" }],
      taxonomy_version: ORGANIC_TAXONOMY_VERSION,
      prompt_version: promptVersion,
      model: assistant.model,
      input_hash: inputHash,
      idempotency_key: idempotencyKey,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !classification) return errorCode(error?.message);

  if (content.creative_id) {
    await supabase
      .from("creatives")
      .update({
        funnel_stage: output.funnel_stage,
        hook: nullable(output.hook),
        promise: nullable(output.promise),
        cta: nullable(output.cta),
        proof_type: nullable(output.proof),
      })
      .eq("id", content.creative_id)
      .eq("org_id", input.orgId);
  }
  await recordAudit(supabase, "organic.content.classified", {
    orgId: input.orgId,
    entityType: "organic_content",
    entityId: input.contentId,
    metadata: { productId: input.productId, classifier: CLASSIFIER_SLUG, model: assistant.model },
  });
  revalidatePath(`/organic-growth/content/${input.contentId}`);
  return { ok: true, id: classification.id };
}

async function contentForAction(supabase: SupabaseClient, orgId: string, productId: string, contentId: string) {
  const [contentResult, productLinkResult, classificationResult] = await Promise.all([
    supabase
      .from("organic_content_items")
      .select("id, creative_id, platform, title, caption, format")
      .eq("org_id", orgId)
      .eq("id", contentId)
      .maybeSingle(),
    supabase
      .from("organic_content_products")
      .select("product_id")
      .eq("org_id", orgId)
      .eq("content_id", contentId)
      .eq("product_id", productId)
      .maybeSingle(),
    supabase
      .from("organic_content_classifications")
      .select("*")
      .eq("org_id", orgId)
      .eq("content_id", contentId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!contentResult.data || !productLinkResult.data) return null;
  return { content: contentResult.data, classification: classificationResult.data };
}

export async function createExperimentFromOrganicContent(input: {
  orgId: string;
  productId: string;
  contentId: string;
}): Promise<OrganicIdResult> {
  const access = await requireOrganicAccess(input.orgId, { requireEnabled: true });
  if (!access.ok) return access;
  const data = await contentForAction(access.supabase, input.orgId, input.productId, input.contentId);
  if (!data) return { ok: false, code: "content-not-found" };
  const classification = data.classification;
  const name = data.content.title || data.content.caption || "Conteúdo orgânico";
  const { data: experiment, error } = await access.supabase
    .from("experiments")
    .insert({
      org_id: input.orgId,
      product_id: input.productId,
      title: `Variação de ${name}`.slice(0, 120),
      status: "planned",
      platform: data.content.platform,
      audience: classification?.audience ?? null,
      hypothesis: classification?.hook
        ? `Manter o gancho “${classification.hook}” e variar um elemento pode preservar o sinal observado.`
        : "Uma variação controlada deste conteúdo pode revelar qual elemento sustenta o sinal observado.",
      change_made: "Definir uma única variável antes de iniciar o teste.",
      variable_tested: "a definir",
      primary_metric: "métrica de intenção relativa à coorte",
      success_criterion: "Superar a mediana da coorte comparável sem reduzir os sinais de intenção.",
      created_by: access.user.id,
    })
    .select("id")
    .single();
  if (error || !experiment) return errorCode(error?.message);
  const { error: contentLinkError } = await access.supabase.from("experiment_organic_contents").insert({
    org_id: input.orgId,
    experiment_id: experiment.id,
    content_id: input.contentId,
    role: "control",
    variant_label: "original",
    created_by: access.user.id,
  });
  if (contentLinkError) {
    await access.supabase.from("experiments").delete().eq("id", experiment.id).eq("org_id", input.orgId);
    return errorCode(contentLinkError.message, "experiment-link-failed");
  }
  if (data.content.creative_id) {
    const { error: creativeLinkError } = await access.supabase.from("experiment_creatives").insert({
      experiment_id: experiment.id,
      creative_id: data.content.creative_id,
    });
    if (creativeLinkError) {
      await access.supabase.from("experiments").delete().eq("id", experiment.id).eq("org_id", input.orgId);
      return errorCode(creativeLinkError.message, "experiment-link-failed");
    }
  }
  await recordAudit(access.supabase, "organic.content.experiment_created", {
    orgId: input.orgId,
    entityType: "experiment",
    entityId: experiment.id,
    metadata: { contentId: input.contentId },
  });
  return { ok: true, id: experiment.id };
}

export async function createOrganicVariation(input: {
  orgId: string;
  productId: string;
  contentId: string;
}): Promise<OrganicIdResult> {
  const access = await requireOrganicAccess(input.orgId, { requireEnabled: true });
  if (!access.ok) return access;
  const data = await contentForAction(access.supabase, input.orgId, input.productId, input.contentId);
  if (!data?.content.creative_id) return { ok: false, code: "creative-not-found" };
  const { data: original } = await access.supabase
    .from("creatives")
    .select("*")
    .eq("id", data.content.creative_id)
    .eq("org_id", input.orgId)
    .maybeSingle();
  if (!original) return { ok: false, code: "creative-not-found" };
  const { data: variation, error } = await access.supabase
    .from("creatives")
    .insert({
      org_id: input.orgId,
      product_id: input.productId,
      name: `Variação — ${original.name}`.slice(0, 180),
      status: "idea",
      source: "planned",
      format: original.format,
      funnel_stage: original.funnel_stage,
      duration_seconds: original.duration_seconds,
      angle: original.angle,
      promise: original.promise,
      pain: original.pain,
      desire: original.desire,
      objection: original.objection,
      hook: original.hook,
      first_scene: original.first_scene,
      cta: original.cta,
      proof_type: original.proof_type,
      visual_style: original.visual_style,
      emotion: original.emotion,
      presumed_audience: original.presumed_audience,
      notes: `Derivada do conteúdo orgânico ${input.contentId}. Defina a variável alterada antes de testar.`,
      created_by: access.user.id,
    })
    .select("id")
    .single();
  if (error || !variation) return errorCode(error?.message);
  await recordAudit(access.supabase, "organic.content.variation_created", {
    orgId: input.orgId,
    entityType: "creative",
    entityId: variation.id,
    metadata: { sourceContentId: input.contentId, sourceCreativeId: original.id },
  });
  return { ok: true, id: variation.id };
}

export async function createOrganicPaidLink(input: { orgId: string; contentId: string }): Promise<OrganicIdResult> {
  const access = await requireOrganicAccess(input.orgId, { requireEnabled: true });
  if (!access.ok) return access;
  const { data: content } = await access.supabase
    .from("organic_content_items")
    .select("id, creative_id")
    .eq("org_id", input.orgId)
    .eq("id", input.contentId)
    .maybeSingle();
  if (!content?.creative_id) return { ok: false, code: "creative-not-found" };
  const { data: existing } = await access.supabase
    .from("organic_paid_links")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("content_id", input.contentId)
    .eq("creative_id", content.creative_id)
    .eq("direction", "organic_to_paid")
    .maybeSingle();
  if (existing) return { ok: true, id: existing.id };
  const { data: link, error } = await access.supabase
    .from("organic_paid_links")
    .insert({
      org_id: input.orgId,
      content_id: input.contentId,
      creative_id: content.creative_id,
      direction: "organic_to_paid",
      transformations: [],
      hypothesis: "O sinal orgânico justifica avaliar uma adaptação paga, mantendo a origem e a hipótese rastreáveis.",
      created_by: access.user.id,
    })
    .select("id")
    .single();
  if (error || !link) return errorCode(error?.message);
  await recordAudit(access.supabase, "organic.paid_link.created", {
    orgId: input.orgId,
    entityType: "organic_paid_link",
    entityId: link.id,
    metadata: { contentId: input.contentId, direction: "organic_to_paid" },
  });
  return { ok: true, id: link.id };
}

export async function recordOrganicRecommendationFeedback(input: {
  orgId: string;
  recommendationId: string;
  rating: RecommendationFeedback;
}) {
  const access = await requireOrganicAccess(input.orgId, { requireEnabled: true });
  if (!access.ok) return access;
  if (!(["useful", "not_useful", "incorrect"] as const).includes(input.rating)) {
    return { ok: false as const, code: "save-failed" };
  }
  const { error } = await access.supabase.from("organic_recommendation_feedback").upsert(
    {
      org_id: input.orgId,
      recommendation_id: input.recommendationId,
      user_id: access.user.id,
      rating: input.rating,
    },
    { onConflict: "recommendation_id,user_id" },
  );
  if (error) return errorCode(error.message);
  await recordAudit(access.supabase, "organic.recommendation.feedback_recorded", {
    orgId: input.orgId,
    entityType: "organic_recommendation",
    entityId: input.recommendationId,
    metadata: { rating: input.rating },
  });
  revalidatePath("/organic-growth");
  return { ok: true as const };
}

export async function recordOrganicReviewExport(input: { orgId: string; reviewId: string }) {
  const access = await requireOrganicAccess(input.orgId, { requireEnabled: true });
  if (!access.ok) return access;
  const { data: review } = await access.supabase
    .from("organic_reviews")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("id", input.reviewId)
    .maybeSingle();
  if (!review) return { ok: false as const, code: "review-not-found" };
  await recordAudit(access.supabase, "organic.review.exported", {
    orgId: input.orgId,
    entityType: "organic_review",
    entityId: input.reviewId,
    metadata: { format: "browser_print" },
  });
  return { ok: true as const };
}

export async function deleteOrganicImportBatch(input: { orgId: string; batchId: string }) {
  const access = await requireOrganicAccess(input.orgId, { requireEnabled: true });
  if (!access.ok) return access;
  const { supabase } = access;
  const { data: rows } = await supabase
    .from("organic_content_items")
    .select("id, creative_id")
    .eq("org_id", input.orgId)
    .eq("import_batch_id", input.batchId)
    .neq("source", "api");
  const contentIds = (rows ?? []).map((row) => row.id);
  if (contentIds.length > 0) {
    const { error: contentError } = await supabase
      .from("organic_content_items")
      .delete()
      .eq("org_id", input.orgId)
      .in("id", contentIds)
      .neq("source", "api");
    if (contentError) return errorCode(contentError.message, "delete-failed");
  }

  const { data: deletedBatch, error: batchError } = await supabase
    .from("organic_import_batches")
    .delete()
    .eq("org_id", input.orgId)
    .eq("id", input.batchId)
    .select("id")
    .maybeSingle();
  if (batchError || !deletedBatch) return errorCode(batchError?.message, "delete-failed");

  for (const creativeId of [...new Set((rows ?? []).map((row) => row.creative_id).filter(Boolean))]) {
    const { count } = await supabase
      .from("organic_content_items")
      .select("id", { count: "exact", head: true })
      .eq("org_id", input.orgId)
      .eq("creative_id", creativeId);
    if ((count ?? 0) === 0) {
      await supabase.from("creatives").delete().eq("id", creativeId).eq("org_id", input.orgId).eq("source", "organic");
    }
  }
  await recordAudit(supabase, "organic.import.deleted", {
    orgId: input.orgId,
    entityType: "organic_import_batch",
    entityId: input.batchId,
    metadata: { contentCount: rows?.length ?? 0 },
  });
  revalidatePath("/organic-growth");
  revalidatePath("/organic-growth/content");
  return { ok: true as const };
}

export async function createExperimentFromOrganicRecommendation(input: {
  orgId: string;
  recommendationId: string;
}): Promise<OrganicIdResult> {
  const access = await requireOrganicAccess(input.orgId, { requireEnabled: true });
  if (!access.ok) return access;
  const { data: recommendation } = await access.supabase
    .from("organic_recommendations")
    .select("*")
    .eq("org_id", input.orgId)
    .eq("id", input.recommendationId)
    .maybeSingle();
  if (!recommendation) return { ok: false, code: "recommendation-not-found" };
  const context = recommendation.context as { platform?: string; audience?: string };
  const { data: experiment, error } = await access.supabase
    .from("experiments")
    .insert({
      org_id: input.orgId,
      product_id: recommendation.product_id,
      title: recommendation.recommended_action.slice(0, 120),
      status: "planned",
      platform: context.platform ?? null,
      audience: context.audience ?? null,
      hypothesis: recommendation.hypothesis,
      change_made: recommendation.recommended_action,
      reason: recommendation.diagnosis,
      variable_tested: "a definir",
      primary_metric: recommendation.success_criterion,
      success_criterion: recommendation.success_criterion,
      next_step: recommendation.reevaluation_window,
      created_by: access.user.id,
    })
    .select("id")
    .single();
  if (error || !experiment) return errorCode(error?.message);
  const { error: recommendationLinkError } = await access.supabase.from("organic_recommendation_experiments").insert({
    org_id: input.orgId,
    recommendation_id: input.recommendationId,
    experiment_id: experiment.id,
    created_by: access.user.id,
  });
  if (recommendationLinkError) {
    await access.supabase.from("experiments").delete().eq("id", experiment.id).eq("org_id", input.orgId);
    return errorCode(recommendationLinkError.message, "experiment-link-failed");
  }
  const { data: evidence } = await access.supabase
    .from("organic_recommendation_evidence")
    .select("content_id")
    .eq("org_id", input.orgId)
    .eq("recommendation_id", input.recommendationId)
    .not("content_id", "is", null);
  const contentIds = [...new Set((evidence ?? []).map((item) => item.content_id).filter(Boolean))];
  if (contentIds.length > 0) {
    const { error: contentLinksError } = await access.supabase.from("experiment_organic_contents").insert(
      contentIds.map((contentId, index) => ({
        org_id: input.orgId,
        experiment_id: experiment.id,
        content_id: contentId,
        role: index === 0 ? "control" : "test",
        created_by: access.user.id,
      })),
    );
    if (contentLinksError) {
      await access.supabase.from("experiments").delete().eq("id", experiment.id).eq("org_id", input.orgId);
      return errorCode(contentLinksError.message, "experiment-link-failed");
    }
  }
  await recordAudit(access.supabase, "organic.recommendation.experiment_created", {
    orgId: input.orgId,
    entityType: "experiment",
    entityId: experiment.id,
    metadata: { recommendationId: input.recommendationId },
  });
  return { ok: true, id: experiment.id };
}

function numberValue(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function recommendationKind(recommendation: OrganicRecommendation) {
  if (recommendation.id.startsWith("organic-funnel-")) return "funnel_gap";
  if (recommendation.id.startsWith("organic-intent-")) return "intent_opportunity";
  if (recommendation.id.startsWith("organic-paid-")) return "paid_repurpose";
  return "strategy";
}

function evidenceKind(source: OrganicRecommendation["evidence"][number]["source"]) {
  if (source === "product_context") return "product_context";
  if (source === "experiment_data") return "experiment";
  if (source === "platform_docs" || source === "growth_playbook") return "knowledge";
  return "content_metric";
}

export async function generateOrganicReview(input: OrganicReviewRequest): Promise<OrganicIdResult> {
  const access = await requireOrganicAccess(input.orgId, { requireEnabled: true });
  if (!access.ok) return access;
  const { supabase, user } = access;
  const scope = await linkedScope(supabase, input.orgId, input.productId, input.socialAccountId);
  if (!scope) return { ok: false, code: "scope-not-found" };
  if (!isIsoDateOnly(input.periodStart) || !isIsoDateOnly(input.periodEnd)) {
    return { ok: false, code: "period-invalid" };
  }
  if (input.periodEnd < input.periodStart) return { ok: false, code: "period-invalid" };

  const { data: productLinks } = await supabase
    .from("organic_content_products")
    .select("content_id")
    .eq("org_id", input.orgId)
    .eq("product_id", input.productId);
  const linkedContentIds = (productLinks ?? []).map((link) => link.content_id);
  let contentRows: Record<string, unknown>[] = [];
  if (linkedContentIds.length > 0) {
    const { data } = await supabase
      .from("organic_content_items")
      .select(
        "id, social_account_id, platform, external_content_id, permalink_url, published_at, format, title, caption, duration_seconds",
      )
      .eq("org_id", input.orgId)
      .eq("social_account_id", input.socialAccountId)
      .eq("status", "published")
      .in("id", linkedContentIds)
      .gte("published_at", `${input.periodStart}T00:00:00.000Z`)
      .lte("published_at", `${input.periodEnd}T23:59:59.999Z`)
      .order("published_at");
    contentRows = (data as Record<string, unknown>[]) ?? [];
  }
  const contentIds = contentRows.map((row) => String(row.id));

  let classificationRows: Record<string, unknown>[] = [];
  let metricRows: Record<string, unknown>[] = [];
  if (contentIds.length > 0) {
    const [classificationResult, metricResult] = await Promise.all([
      supabase
        .from("organic_content_classifications")
        .select("*")
        .eq("org_id", input.orgId)
        .eq("product_id", input.productId)
        .in("content_id", contentIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("organic_content_metric_snapshots")
        .select("*")
        .eq("org_id", input.orgId)
        .in("content_id", contentIds)
        .order("captured_at", { ascending: false }),
    ]);
    classificationRows = (classificationResult.data as Record<string, unknown>[]) ?? [];
    metricRows = (metricResult.data as Record<string, unknown>[]) ?? [];
  }

  // A human correction always wins, even if a later AI suggestion was run.
  const classifications = new Map<string, Record<string, unknown>>();
  for (const row of classificationRows) {
    const contentId = String(row.content_id);
    const current = classifications.get(contentId);
    if (!current || (current.source !== "user" && row.source === "user")) classifications.set(contentId, row);
  }
  const metrics = new Map<string, Record<string, unknown>>();
  for (const row of metricRows) {
    const contentId = String(row.content_id);
    if (!metrics.has(contentId)) metrics.set(contentId, row);
  }

  const observations: OrganicContentRecord[] = contentRows.map((row) => {
    const contentId = String(row.id);
    const classification = classifications.get(contentId);
    const metric = metrics.get(contentId);
    return {
      id: contentId,
      ...(row.external_content_id ? { externalId: String(row.external_content_id) } : {}),
      ...(row.permalink_url ? { url: String(row.permalink_url) } : {}),
      publishedAt: String(row.published_at),
      ...(metric?.captured_at ? { observedAt: String(metric.captured_at) } : {}),
      platform: row.platform as SocialPlatform,
      account: scope.account.handle || scope.account.name || scope.account.id,
      format: String(row.format || "unknown"),
      ...(row.title ? { title: String(row.title) } : {}),
      ...(row.caption ? { caption: String(row.caption) } : {}),
      ...(numberValue(row.duration_seconds) !== undefined
        ? { durationSeconds: numberValue(row.duration_seconds) }
        : {}),
      ...(classification?.funnel_stage
        ? { funnelStage: classification.funnel_stage as OrganicContentRecord["funnelStage"] }
        : {}),
      ...(classification?.strategic_intent
        ? { strategicIntent: classification.strategic_intent as OrganicContentRecord["strategicIntent"] }
        : {}),
      ...(classification?.narrative_type
        ? { narrativeType: classification.narrative_type as OrganicContentRecord["narrativeType"] }
        : {}),
      ...(classification?.theme ? { theme: String(classification.theme) } : {}),
      ...(classification?.hook ? { hook: String(classification.hook) } : {}),
      ...(classification?.promise ? { promise: String(classification.promise) } : {}),
      ...(classification?.cta ? { cta: String(classification.cta) } : {}),
      ...(classification?.proof ? { proof: String(classification.proof) } : {}),
      ...(classification?.confidence
        ? { classificationConfidence: classification.confidence as OrganicContentRecord["classificationConfidence"] }
        : {}),
      source: "manual",
      metrics: {
        ...(numberValue(metric?.impressions) !== undefined ? { impressions: numberValue(metric?.impressions) } : {}),
        ...(numberValue(metric?.reach) !== undefined ? { reach: numberValue(metric?.reach) } : {}),
        ...(numberValue(metric?.views) !== undefined ? { views: numberValue(metric?.views) } : {}),
        ...(numberValue(metric?.plays) !== undefined ? { plays: numberValue(metric?.plays) } : {}),
        ...(numberValue(metric?.likes) !== undefined ? { likes: numberValue(metric?.likes) } : {}),
        ...(numberValue(metric?.comments) !== undefined ? { comments: numberValue(metric?.comments) } : {}),
        ...(numberValue(metric?.shares) !== undefined ? { shares: numberValue(metric?.shares) } : {}),
        ...(numberValue(metric?.saves) !== undefined ? { saves: numberValue(metric?.saves) } : {}),
        ...(numberValue(metric?.profile_visits) !== undefined
          ? { profileVisits: numberValue(metric?.profile_visits) }
          : {}),
        ...(numberValue(metric?.link_clicks) !== undefined ? { linkClicks: numberValue(metric?.link_clicks) } : {}),
        ...(numberValue(metric?.leads) !== undefined ? { leads: numberValue(metric?.leads) } : {}),
        ...(numberValue(metric?.assisted_conversions) !== undefined
          ? { assistedConversions: numberValue(metric?.assisted_conversions) }
          : {}),
        ...(numberValue(metric?.average_percentage_viewed) !== undefined
          ? { averageWatchPercentage: numberValue(metric?.average_percentage_viewed) }
          : {}),
        ...(numberValue(metric?.average_watch_time_seconds) !== undefined
          ? { averageWatchTimeSeconds: numberValue(metric?.average_watch_time_seconds) }
          : {}),
      },
    };
  });

  const context: OrganicAnalysisContext = {
    productId: input.productId,
    productName: scope.product.name,
    audience: scope.product.audience || "",
    objective: scope.link.objective || "",
    offerOrDesiredAction: scope.link.desired_action || scope.product.main_promise || "",
    platform: scope.account.platform as SocialPlatform,
    account: scope.account.handle || scope.account.name || scope.account.id,
    period: { start: input.periodStart, end: input.periodEnd },
  };
  const review = buildOrganicReview({ context, contents: observations, minimumCohortSize: 5 });
  const fingerprint = digest(
    JSON.stringify({
      context,
      rows: contentRows.map((row) => String(row.id)).sort(),
      classifications: [...classifications.values()].map((row) => String(row.id)).sort(),
      metrics: [...metrics.values()].map((row) => String(row.id)).sort(),
      version: review.version,
    }),
  );
  const idempotencyKey = `review:${fingerprint}`;
  const { data: previous } = await supabase
    .from("organic_reviews")
    .select("id, status")
    .eq("org_id", input.orgId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (previous?.status === "completed") return { ok: true, id: previous.id };

  const service = getService();
  if (!service) return { ok: false, code: "service-not-configured" };
  let reviewId = previous?.id as string | undefined;
  if (!reviewId) {
    const { data: queued, error } = await supabase
      .from("organic_reviews")
      .insert({
        org_id: input.orgId,
        product_id: input.productId,
        social_account_id: input.socialAccountId,
        platform: context.platform,
        cadence: "on_demand",
        status: "queued",
        period_start: input.periodStart,
        period_end: input.periodEnd,
        idempotency_key: idempotencyKey,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !queued) return errorCode(error?.message, "review-create-failed");
    reviewId = queued.id;
  }
  if (!reviewId) return { ok: false, code: "review-create-failed" };

  const confidence =
    review.sufficiency.status === "suficiente" && review.dataQuality.score >= 75
      ? "alta"
      : review.dataQuality.score >= 45
        ? "media"
        : "baixa";
  await service
    .from("organic_reviews")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      insufficient_data: review.insufficient_data,
      confidence,
      missing_data: review.missing_data,
      data_quality: review.dataQuality,
      scores: {
        funnelCoverage: review.funnelCoverage,
        contentAnalyses: review.contentAnalyses,
        methodology: "organic-growth-review/v1",
      },
      summary: { text: review.summary, sufficiency: review.sufficiency },
      taxonomy_version: ORGANIC_TAXONOMY_VERSION,
      score_version: review.version,
    })
    .eq("id", reviewId)
    .eq("org_id", input.orgId);

  // A retry replaces only machine-generated immutable children for this same
  // fingerprint; users cannot mutate them directly under RLS.
  await service.from("organic_recommendations").delete().eq("review_id", reviewId).eq("org_id", input.orgId);
  for (const [index, recommendation] of review.recommendations.entries()) {
    const kind = recommendationKind(recommendation);
    const { data: created, error } = await service
      .from("organic_recommendations")
      .insert({
        org_id: input.orgId,
        review_id: reviewId,
        product_id: input.productId,
        kind,
        status: "open",
        rank: index + 1,
        diagnosis: recommendation.diagnosis,
        context: recommendation.context,
        hypothesis: recommendation.hypothesis,
        recommended_action: recommendation.recommended_action,
        risk: recommendation.risk,
        priority: recommendation.priority,
        effort: recommendation.estimated_effort,
        impact: recommendation.expected_impact,
        confidence: recommendation.confidence,
        success_criterion: recommendation.success_criterion,
        reevaluation_window: recommendation.next_review,
        source_summary: recommendation.sources.map((source) => source.reference).join(" · "),
        insufficient_data: false,
        output: recommendation,
      })
      .select("id")
      .single();
    if (error || !created) {
      await service
        .from("organic_reviews")
        .update({ status: "failed", error: error?.message ?? "Falha ao persistir recomendação." })
        .eq("id", reviewId);
      return errorCode(error?.message, "review-persist-failed");
    }

    if (recommendation.evidence.length > 0) {
      const { error: evidenceError } = await service.from("organic_recommendation_evidence").insert(
        recommendation.evidence.map((evidence, evidenceIndex) => ({
          org_id: input.orgId,
          recommendation_id: created.id,
          kind: evidenceKind(evidence.source),
          statement_type: evidence.kind === "fato" ? "fact" : "inference",
          content_id: evidence.contentId ?? null,
          source_ref: evidence.source,
          description: evidence.statement,
          value:
            evidence.value === undefined
              ? { metric: evidence.metric ?? null }
              : { metric: evidence.metric ?? null, value: evidence.value, period: evidence.period ?? null },
          observed_at: evidence.period?.end ? `${evidence.period.end}T23:59:59.999Z` : null,
          sort: evidenceIndex,
        })),
      );
      if (evidenceError) return errorCode(evidenceError.message, "review-persist-failed");
    }
  }

  await service
    .from("organic_reviews")
    .update({ status: "completed", completed_at: new Date().toISOString(), error: null })
    .eq("id", reviewId)
    .eq("org_id", input.orgId);
  await recordAudit(supabase, "organic.review.generated", {
    orgId: input.orgId,
    entityType: "organic_review",
    entityId: reviewId,
    metadata: {
      productId: input.productId,
      accountId: input.socialAccountId,
      contentCount: observations.length,
      recommendationCount: review.recommendations.length,
      insufficientData: review.insufficient_data,
    },
  });
  revalidatePath("/organic-growth");
  revalidatePath("/organic-growth/reviews");
  return { ok: true, id: reviewId };
}
