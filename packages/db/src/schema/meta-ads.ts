import { bigint, date, index, jsonb, numeric, pgTable, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { connections } from "./connectors";

/**
 * Normalized Meta Ads data synced by the meta-ads connector
 * (apps/web/src/lib/meta-ads). Mirrors migration 0009_meta_ads.sql.
 * Everything hangs off a connection (and therefore an organization);
 * RLS lets org members read and only the service role write.
 */

export const metaAdAccounts = pgTable(
  "meta_ad_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    name: text("name"),
    currency: text("currency"),
    timezoneName: text("timezone_name"),
    accountStatus: smallint("account_status"),
    raw: jsonb("raw").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.connectionId, table.accountId),
    index("meta_ad_accounts_connection_idx").on(table.connectionId),
  ],
);

export const metaCampaigns = pgTable(
  "meta_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    campaignId: text("campaign_id").notNull(),
    name: text("name"),
    objective: text("objective"),
    status: text("status"),
    effectiveStatus: text("effective_status"),
    buyingType: text("buying_type"),
    dailyBudget: bigint("daily_budget", { mode: "number" }),
    lifetimeBudget: bigint("lifetime_budget", { mode: "number" }),
    startTime: timestamp("start_time", { withTimezone: true }),
    stopTime: timestamp("stop_time", { withTimezone: true }),
    updatedTime: timestamp("updated_time", { withTimezone: true }),
    raw: jsonb("raw").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.connectionId, table.campaignId),
    index("meta_campaigns_connection_idx").on(table.connectionId),
    index("meta_campaigns_account_idx").on(table.connectionId, table.accountId),
  ],
);

export const metaAdSets = pgTable(
  "meta_ad_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    adSetId: text("ad_set_id").notNull(),
    campaignId: text("campaign_id"),
    name: text("name"),
    status: text("status"),
    effectiveStatus: text("effective_status"),
    optimizationGoal: text("optimization_goal"),
    billingEvent: text("billing_event"),
    bidStrategy: text("bid_strategy"),
    dailyBudget: bigint("daily_budget", { mode: "number" }),
    lifetimeBudget: bigint("lifetime_budget", { mode: "number" }),
    learningStageInfo: jsonb("learning_stage_info"),
    targeting: jsonb("targeting"),
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    updatedTime: timestamp("updated_time", { withTimezone: true }),
    raw: jsonb("raw").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.connectionId, table.adSetId),
    index("meta_ad_sets_connection_idx").on(table.connectionId),
    index("meta_ad_sets_campaign_idx").on(table.connectionId, table.campaignId),
  ],
);

export const metaCreatives = pgTable(
  "meta_creatives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    creativeId: text("creative_id").notNull(),
    name: text("name"),
    title: text("title"),
    body: text("body"),
    callToActionType: text("call_to_action_type"),
    objectType: text("object_type"),
    thumbnailUrl: text("thumbnail_url"),
    imageUrl: text("image_url"),
    raw: jsonb("raw").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.connectionId, table.creativeId),
    index("meta_creatives_connection_idx").on(table.connectionId),
  ],
);

export const metaAds = pgTable(
  "meta_ads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    adId: text("ad_id").notNull(),
    adSetId: text("ad_set_id"),
    campaignId: text("campaign_id"),
    creativeId: text("creative_id"),
    name: text("name"),
    status: text("status"),
    effectiveStatus: text("effective_status"),
    updatedTime: timestamp("updated_time", { withTimezone: true }),
    raw: jsonb("raw").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.connectionId, table.adId),
    index("meta_ads_connection_idx").on(table.connectionId),
    index("meta_ads_ad_set_idx").on(table.connectionId, table.adSetId),
  ],
);

export const metaInsightsDaily = pgTable(
  "meta_insights_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    adId: text("ad_id").notNull(),
    adSetId: text("ad_set_id"),
    campaignId: text("campaign_id"),
    date: date("date").notNull(),
    spend: numeric("spend"),
    impressions: bigint("impressions", { mode: "number" }),
    reach: bigint("reach", { mode: "number" }),
    frequency: numeric("frequency"),
    cpm: numeric("cpm"),
    ctr: numeric("ctr"),
    cpc: numeric("cpc"),
    clicks: bigint("clicks", { mode: "number" }),
    inlineLinkClicks: bigint("inline_link_clicks", { mode: "number" }),
    purchases: numeric("purchases"),
    purchaseValue: numeric("purchase_value"),
    purchaseRoas: numeric("purchase_roas"),
    actions: jsonb("actions"),
    actionValues: jsonb("action_values"),
    qualityRanking: text("quality_ranking"),
    engagementRateRanking: text("engagement_rate_ranking"),
    conversionRateRanking: text("conversion_rate_ranking"),
    raw: jsonb("raw").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.connectionId, table.adId, table.date),
    index("meta_insights_daily_connection_idx").on(table.connectionId),
    index("meta_insights_daily_ad_date_idx").on(table.connectionId, table.adId, table.date),
    index("meta_insights_daily_campaign_date_idx").on(table.connectionId, table.campaignId, table.date),
  ],
);

export type MetaAdAccount = typeof metaAdAccounts.$inferSelect;
export type MetaCampaign = typeof metaCampaigns.$inferSelect;
export type MetaAdSet = typeof metaAdSets.$inferSelect;
export type MetaCreative = typeof metaCreatives.$inferSelect;
export type MetaAd = typeof metaAds.$inferSelect;
export type MetaInsightsDaily = typeof metaInsightsDaily.$inferSelect;
