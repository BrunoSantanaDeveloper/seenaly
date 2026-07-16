import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { connections } from "./connectors";
import { creatives } from "./creatives";
import { experiments } from "./experiments";
import { knowledgeChunks } from "./knowledge";
import { metaAds } from "./meta-ads";
import { organizations } from "./organizations";
import { products } from "./product-context";
import { profiles } from "./profiles";

/**
 * Organic Growth is native to the shared product/creative/experiment model.
 * These tables model social publications and their evidence; a publication is
 * not itself a reusable creative asset, but may bridge to one via creativeId.
 * Mirrors migration 0024_organic_growth.sql.
 */

export const organicGrowthSettings = pgTable(
  "organic_growth_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    reviewCadence: text("review_cadence").notNull().default("weekly"),
    analysisWindowDays: integer("analysis_window_days").notNull().default(30),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    retentionDays: integer("retention_days").notNull().default(365),
    storeComments: boolean("store_comments").notNull().default(false),
    allowImprovementUsage: boolean("allow_improvement_usage").notNull().default(false),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    activatedBy: uuid("activated_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("organic_growth_settings_org_id_key").on(table.orgId),
    check(
      "organic_growth_settings_review_cadence_check",
      sql`${table.reviewCadence} in ('on_demand', 'weekly', 'biweekly', 'monthly')`,
    ),
    check("organic_growth_settings_analysis_window_days_check", sql`${table.analysisWindowDays} between 1 and 3650`),
    check("organic_growth_settings_retention_days_check", sql`${table.retentionDays} >= 0`),
  ],
);

export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => connections.id, { onDelete: "set null" }),
    platform: text("platform").notNull(),
    externalAccountId: text("external_account_id").notNull(),
    name: text("name"),
    handle: text("handle"),
    status: text("status").notNull().default("pending"),
    followersCount: bigint("followers_count", { mode: "number" }),
    metadata: jsonb("metadata").notNull().default({}),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    syncError: text("sync_error"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("social_accounts_org_id_platform_external_account_id_key").on(
      table.orgId,
      table.platform,
      table.externalAccountId,
    ),
    index("social_accounts_org_status_idx").on(table.orgId, table.status),
    index("social_accounts_connection_idx").on(table.connectionId),
    check("social_accounts_platform_check", sql`${table.platform} in ('instagram', 'tiktok', 'youtube', 'linkedin')`),
    check(
      "social_accounts_status_check",
      sql`${table.status} in ('pending', 'active', 'error', 'disabled', 'disconnected')`,
    ),
    check(
      "social_accounts_followers_count_check",
      sql`${table.followersCount} is null or ${table.followersCount} >= 0`,
    ),
  ],
);

export const socialAccountProducts = pgTable(
  "social_account_products",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    socialAccountId: uuid("social_account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    objective: text("objective"),
    desiredAction: text("desired_action"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.socialAccountId, table.productId] }),
    index("social_account_products_org_idx").on(table.orgId),
    index("social_account_products_product_idx").on(table.productId, table.socialAccountId),
    uniqueIndex("social_account_products_one_primary_idx")
      .on(table.socialAccountId)
      .where(sql`${table.isPrimary}`),
  ],
);

export const organicImportBatches = pgTable(
  "organic_import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    status: text("status").notNull().default("queued"),
    fileName: text("file_name"),
    storagePath: text("storage_path"),
    idempotencyKey: text("idempotency_key"),
    totalRows: integer("total_rows").notNull().default(0),
    importedRows: integer("imported_rows").notNull().default(0),
    rejectedRows: integer("rejected_rows").notNull().default(0),
    errorSummary: jsonb("error_summary").notNull().default([]),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("organic_import_batches_org_id_idempotency_key_key").on(table.orgId, table.idempotencyKey),
    index("organic_import_batches_org_created_idx").on(table.orgId, table.createdAt),
    index("organic_import_batches_status_idx").on(table.orgId, table.status, table.createdAt),
    check("organic_import_batches_source_check", sql`${table.source} in ('csv', 'manual', 'upload')`),
    check(
      "organic_import_batches_status_check",
      sql`${table.status} in ('queued', 'processing', 'completed', 'partial', 'failed')`,
    ),
    check(
      "organic_import_batches_counts_check",
      sql`${table.totalRows} >= 0 and ${table.importedRows} >= 0 and ${table.rejectedRows} >= 0`,
    ),
    check(
      "organic_import_batches_processed_count_check",
      sql`${table.importedRows} + ${table.rejectedRows} <= ${table.totalRows} or ${table.totalRows} = 0`,
    ),
  ],
);

export const organicContentItems = pgTable(
  "organic_content_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    socialAccountId: uuid("social_account_id").references(() => socialAccounts.id, { onDelete: "set null" }),
    creativeId: uuid("creative_id").references(() => creatives.id, { onDelete: "set null" }),
    importBatchId: uuid("import_batch_id").references(() => organicImportBatches.id, { onDelete: "set null" }),
    platform: text("platform").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull().default("published"),
    externalContentId: text("external_content_id"),
    sourceKey: text("source_key"),
    format: text("format"),
    permalinkUrl: text("permalink_url"),
    mediaStoragePath: text("media_storage_path"),
    title: text("title"),
    caption: text("caption"),
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    durationSeconds: integer("duration_seconds"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    providerCreatedAt: timestamp("provider_created_at", { withTimezone: true }),
    providerUpdatedAt: timestamp("provider_updated_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    raw: jsonb("raw").notNull().default({}),
    metadata: jsonb("metadata").notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organic_content_external_unique")
      .on(table.socialAccountId, table.externalContentId)
      .where(sql`${table.socialAccountId} is not null and ${table.externalContentId} is not null`),
    uniqueIndex("organic_content_source_key_unique")
      .on(table.orgId, table.source, table.sourceKey)
      .where(sql`${table.sourceKey} is not null`),
    index("organic_content_org_published_idx").on(table.orgId, table.publishedAt),
    index("organic_content_account_published_idx").on(table.socialAccountId, table.publishedAt),
    index("organic_content_cohort_idx").on(table.orgId, table.platform, table.format, table.publishedAt),
    index("organic_content_creative_idx").on(table.creativeId),
    index("organic_content_import_batch_idx").on(table.importBatchId),
    check(
      "organic_content_items_platform_check",
      sql`${table.platform} in ('instagram', 'tiktok', 'youtube', 'linkedin')`,
    ),
    check("organic_content_items_source_check", sql`${table.source} in ('api', 'csv', 'manual', 'upload')`),
    check(
      "organic_content_items_status_check",
      sql`${table.status} in ('draft', 'published', 'unavailable', 'deleted')`,
    ),
    check(
      "organic_content_items_duration_seconds_check",
      sql`${table.durationSeconds} is null or ${table.durationSeconds} >= 0`,
    ),
    check(
      "organic_content_items_api_identity_check",
      sql`${table.source} <> 'api' or (${table.socialAccountId} is not null and ${table.externalContentId} is not null)`,
    ),
    check("organic_content_items_csv_creative_check", sql`${table.source} <> 'csv' or ${table.creativeId} is not null`),
  ],
);

export const organicContentProducts = pgTable(
  "organic_content_products",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contentId: uuid("content_id")
      .notNull()
      .references(() => organicContentItems.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.contentId, table.productId] }),
    index("organic_content_products_org_idx").on(table.orgId),
    index("organic_content_products_product_idx").on(table.productId, table.contentId),
    uniqueIndex("organic_content_products_one_primary_idx")
      .on(table.contentId)
      .where(sql`${table.isPrimary}`),
  ],
);

export const organicContentMetricSnapshots = pgTable(
  "organic_content_metric_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contentId: uuid("content_id")
      .notNull()
      .references(() => organicContentItems.id, { onDelete: "cascade" }),
    importBatchId: uuid("import_batch_id").references(() => organicImportBatches.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    followersAtCapture: bigint("followers_at_capture", { mode: "number" }),
    impressions: bigint("impressions", { mode: "number" }),
    reach: bigint("reach", { mode: "number" }),
    views: bigint("views", { mode: "number" }),
    plays: bigint("plays", { mode: "number" }),
    watchTimeSeconds: bigint("watch_time_seconds", { mode: "number" }),
    averageWatchTimeSeconds: numeric("average_watch_time_seconds"),
    averagePercentageViewed: numeric("average_percentage_viewed"),
    likes: bigint("likes", { mode: "number" }),
    comments: bigint("comments", { mode: "number" }),
    shares: bigint("shares", { mode: "number" }),
    saves: bigint("saves", { mode: "number" }),
    profileVisits: bigint("profile_visits", { mode: "number" }),
    linkClicks: bigint("link_clicks", { mode: "number" }),
    follows: bigint("follows", { mode: "number" }),
    leads: numeric("leads"),
    assistedConversions: numeric("assisted_conversions"),
    purchases: numeric("purchases"),
    revenue: numeric("revenue"),
    raw: jsonb("raw").notNull().default({}),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("organic_content_metric_snapshots_content_id_captured_at_source_key").on(
      table.contentId,
      table.capturedAt,
      table.source,
    ),
    index("organic_metrics_content_captured_idx").on(table.contentId, table.capturedAt),
    index("organic_metrics_org_captured_idx").on(table.orgId, table.capturedAt),
    check("organic_content_metric_snapshots_source_check", sql`${table.source} in ('api', 'csv', 'manual')`),
    check(
      "organic_content_metric_snapshots_nonnegative_check",
      sql`
        (${table.followersAtCapture} is null or ${table.followersAtCapture} >= 0) and
        (${table.impressions} is null or ${table.impressions} >= 0) and
        (${table.reach} is null or ${table.reach} >= 0) and
        (${table.views} is null or ${table.views} >= 0) and
        (${table.plays} is null or ${table.plays} >= 0) and
        (${table.watchTimeSeconds} is null or ${table.watchTimeSeconds} >= 0) and
        (${table.averageWatchTimeSeconds} is null or ${table.averageWatchTimeSeconds} >= 0) and
        (${table.averagePercentageViewed} is null or ${table.averagePercentageViewed} >= 0) and
        (${table.likes} is null or ${table.likes} >= 0) and
        (${table.comments} is null or ${table.comments} >= 0) and
        (${table.shares} is null or ${table.shares} >= 0) and
        (${table.saves} is null or ${table.saves} >= 0) and
        (${table.profileVisits} is null or ${table.profileVisits} >= 0) and
        (${table.linkClicks} is null or ${table.linkClicks} >= 0) and
        (${table.follows} is null or ${table.follows} >= 0) and
        (${table.leads} is null or ${table.leads} >= 0) and
        (${table.assistedConversions} is null or ${table.assistedConversions} >= 0) and
        (${table.purchases} is null or ${table.purchases} >= 0)
      `,
    ),
  ],
);

export const organicContentClassifications = pgTable(
  "organic_content_classifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contentId: uuid("content_id")
      .notNull()
      .references(() => organicContentItems.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    correctedFromId: uuid("corrected_from_id"),
    source: text("source").notNull(),
    funnelStage: text("funnel_stage"),
    strategicIntent: text("strategic_intent"),
    narrativeType: text("narrative_type"),
    theme: text("theme"),
    hook: text("hook"),
    angle: text("angle"),
    promise: text("promise"),
    pain: text("pain"),
    desire: text("desire"),
    objection: text("objection"),
    proof: text("proof"),
    cta: text("cta"),
    audience: text("audience"),
    visualStyle: text("visual_style"),
    toneOfVoice: text("tone_of_voice"),
    personPresent: text("person_present"),
    tags: jsonb("tags").notNull().default([]),
    confidence: text("confidence"),
    evidence: jsonb("evidence").notNull().default([]),
    taxonomyVersion: text("taxonomy_version").notNull().default("organic-v1"),
    promptVersion: text("prompt_version"),
    model: text("model"),
    inputHash: text("input_hash"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "organic_content_classifications_corrected_from_id_fkey",
      columns: [table.correctedFromId],
      foreignColumns: [table.id],
    }).onDelete("set null"),
    unique("organic_content_classifications_org_id_idempotency_key_key").on(table.orgId, table.idempotencyKey),
    index("organic_classifications_latest_idx").on(table.contentId, table.productId, table.createdAt),
    index("organic_classifications_funnel_idx").on(table.orgId, table.funnelStage, table.createdAt),
    index("organic_classifications_intent_idx").on(table.orgId, table.strategicIntent, table.createdAt),
    check("organic_content_classifications_source_check", sql`${table.source} in ('ai', 'user', 'import')`),
    check(
      "organic_content_classifications_confidence_check",
      sql`${table.confidence} is null or ${table.confidence} in ('baixa', 'media', 'alta')`,
    ),
  ],
);

export const organicReviews = pgTable(
  "organic_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    socialAccountId: uuid("social_account_id").references(() => socialAccounts.id, { onDelete: "set null" }),
    platform: text("platform").notNull(),
    cadence: text("cadence").notNull().default("on_demand"),
    status: text("status").notNull().default("queued"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    insufficientData: boolean("insufficient_data").notNull().default(false),
    confidence: text("confidence"),
    missingData: jsonb("missing_data").notNull().default([]),
    dataQuality: jsonb("data_quality").notNull().default({}),
    scores: jsonb("scores").notNull().default({}),
    summary: jsonb("summary").notNull().default({}),
    knowledgeRefs: jsonb("knowledge_refs").notNull().default([]),
    assistantSlug: text("assistant_slug"),
    model: text("model"),
    promptVersion: text("prompt_version"),
    taxonomyVersion: text("taxonomy_version").notNull().default("organic-v1"),
    scoreVersion: text("score_version"),
    providerApiVersion: text("provider_api_version"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("organic_reviews_org_id_idempotency_key_key").on(table.orgId, table.idempotencyKey),
    index("organic_reviews_org_period_idx").on(table.orgId, table.periodEnd),
    index("organic_reviews_product_period_idx").on(table.productId, table.periodEnd),
    index("organic_reviews_account_period_idx").on(table.socialAccountId, table.periodEnd),
    index("organic_reviews_status_idx").on(table.orgId, table.status, table.createdAt),
    check("organic_reviews_platform_check", sql`${table.platform} in ('instagram', 'tiktok', 'youtube', 'linkedin')`),
    check("organic_reviews_cadence_check", sql`${table.cadence} in ('on_demand', 'weekly', 'biweekly', 'monthly')`),
    check(
      "organic_reviews_status_check",
      sql`${table.status} in ('queued', 'processing', 'completed', 'rejected', 'failed')`,
    ),
    check(
      "organic_reviews_confidence_check",
      sql`${table.confidence} is null or ${table.confidence} in ('baixa', 'media', 'alta')`,
    ),
    check("organic_reviews_period_check", sql`${table.periodEnd} >= ${table.periodStart}`),
  ],
);

export const organicRecommendations = pgTable(
  "organic_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => organicReviews.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("open"),
    rank: smallint("rank").notNull(),
    diagnosis: text("diagnosis").notNull(),
    context: jsonb("context").notNull().default({}),
    hypothesis: text("hypothesis").notNull(),
    recommendedAction: text("recommended_action").notNull(),
    risk: text("risk"),
    priority: text("priority").notNull(),
    effort: text("effort").notNull(),
    impact: text("impact").notNull(),
    confidence: text("confidence").notNull(),
    successCriterion: text("success_criterion").notNull(),
    reevaluationWindow: text("reevaluation_window").notNull(),
    sourceSummary: text("source_summary"),
    insufficientData: boolean("insufficient_data").notNull().default(false),
    output: jsonb("output").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("organic_recommendations_review_id_rank_key").on(table.reviewId, table.rank),
    index("organic_recommendations_org_status_idx").on(table.orgId, table.status, table.createdAt),
    index("organic_recommendations_product_idx").on(table.productId, table.createdAt),
    index("organic_recommendations_review_idx").on(table.reviewId, table.rank),
    check(
      "organic_recommendations_status_check",
      sql`${table.status} in ('open', 'accepted', 'dismissed', 'completed')`,
    ),
    check("organic_recommendations_rank_check", sql`${table.rank} > 0`),
    check("organic_recommendations_priority_check", sql`${table.priority} in ('critica', 'alta', 'media', 'baixa')`),
    check("organic_recommendations_effort_check", sql`${table.effort} in ('baixo', 'medio', 'alto')`),
    check("organic_recommendations_impact_check", sql`${table.impact} in ('baixo', 'medio', 'alto')`),
    check("organic_recommendations_confidence_check", sql`${table.confidence} in ('baixa', 'media', 'alta')`),
  ],
);

export const organicRecommendationEvidence = pgTable(
  "organic_recommendation_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recommendationId: uuid("recommendation_id")
      .notNull()
      .references(() => organicRecommendations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    statementType: text("statement_type").notNull().default("fact"),
    contentId: uuid("content_id").references(() => organicContentItems.id, { onDelete: "set null" }),
    metricSnapshotId: uuid("metric_snapshot_id").references(() => organicContentMetricSnapshots.id, {
      onDelete: "set null",
    }),
    experimentId: uuid("experiment_id").references(() => experiments.id, { onDelete: "set null" }),
    knowledgeChunkId: uuid("knowledge_chunk_id").references(() => knowledgeChunks.id, { onDelete: "set null" }),
    sourceRef: text("source_ref").notNull(),
    description: text("description").notNull(),
    value: jsonb("value").notNull().default({}),
    observedAt: timestamp("observed_at", { withTimezone: true }),
    sort: smallint("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("organic_recommendation_evidence_recommendation_id_sort_key").on(table.recommendationId, table.sort),
    index("organic_evidence_org_idx").on(table.orgId, table.createdAt),
    index("organic_evidence_content_idx").on(table.contentId),
    check(
      "organic_recommendation_evidence_kind_check",
      sql`${table.kind} in ('content_metric', 'comment', 'product_context', 'experiment', 'paid_data', 'knowledge')`,
    ),
    check("organic_recommendation_evidence_statement_type_check", sql`${table.statementType} in ('fact', 'inference')`),
    check("organic_recommendation_evidence_sort_check", sql`${table.sort} >= 0`),
  ],
);

export const organicRecommendationFeedback = pgTable(
  "organic_recommendation_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recommendationId: uuid("recommendation_id")
      .notNull()
      .references(() => organicRecommendations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    rating: text("rating").notNull(),
    reason: text("reason"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("organic_recommendation_feedback_recommendation_id_user_id_key").on(table.recommendationId, table.userId),
    index("organic_feedback_org_idx").on(table.orgId, table.createdAt),
    check(
      "organic_recommendation_feedback_rating_check",
      sql`${table.rating} in ('useful', 'not_useful', 'incorrect')`,
    ),
  ],
);

export const organicRecommendationExperiments = pgTable(
  "organic_recommendation_experiments",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recommendationId: uuid("recommendation_id")
      .notNull()
      .references(() => organicRecommendations.id, { onDelete: "cascade" }),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.recommendationId, table.experimentId] }),
    index("organic_rec_experiments_experiment_idx").on(table.experimentId, table.recommendationId),
  ],
);

export const experimentOrganicContents = pgTable(
  "experiment_organic_contents",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    contentId: uuid("content_id")
      .notNull()
      .references(() => organicContentItems.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    variantLabel: text("variant_label"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.experimentId, table.contentId] }),
    index("experiment_organic_contents_content_idx").on(table.contentId, table.experimentId),
    check("experiment_organic_contents_role_check", sql`${table.role} in ('control', 'test')`),
  ],
);

export const organicPaidLinks = pgTable(
  "organic_paid_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contentId: uuid("content_id")
      .notNull()
      .references(() => organicContentItems.id, { onDelete: "cascade" }),
    creativeId: uuid("creative_id").references(() => creatives.id, { onDelete: "set null" }),
    metaAdId: uuid("meta_ad_id").references(() => metaAds.id, { onDelete: "set null" }),
    experimentId: uuid("experiment_id").references(() => experiments.id, { onDelete: "set null" }),
    direction: text("direction").notNull(),
    transformations: jsonb("transformations").notNull().default([]),
    hypothesis: text("hypothesis"),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organic_paid_links_creative_unique")
      .on(table.contentId, table.creativeId, table.direction)
      .where(sql`${table.creativeId} is not null`),
    uniqueIndex("organic_paid_links_meta_ad_unique")
      .on(table.contentId, table.metaAdId, table.direction)
      .where(sql`${table.metaAdId} is not null`),
    index("organic_paid_links_org_idx").on(table.orgId, table.createdAt),
    index("organic_paid_links_experiment_idx").on(table.experimentId),
    check("organic_paid_links_direction_check", sql`${table.direction} in ('organic_to_paid', 'paid_to_organic')`),
    check("organic_paid_links_target_check", sql`${table.creativeId} is not null or ${table.metaAdId} is not null`),
  ],
);

export type OrganicGrowthSettings = typeof organicGrowthSettings.$inferSelect;
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type OrganicImportBatch = typeof organicImportBatches.$inferSelect;
export type OrganicContentItem = typeof organicContentItems.$inferSelect;
export type OrganicContentMetricSnapshot = typeof organicContentMetricSnapshots.$inferSelect;
export type OrganicContentClassification = typeof organicContentClassifications.$inferSelect;
export type OrganicReview = typeof organicReviews.$inferSelect;
export type OrganicRecommendation = typeof organicRecommendations.$inferSelect;
export type OrganicRecommendationEvidence = typeof organicRecommendationEvidence.$inferSelect;
export type OrganicRecommendationFeedback = typeof organicRecommendationFeedback.$inferSelect;
export type OrganicPaidLink = typeof organicPaidLinks.$inferSelect;
