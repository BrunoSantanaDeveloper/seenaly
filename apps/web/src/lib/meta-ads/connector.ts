import {
  type MetaActionEntry,
  type MetaAdAccountNode,
  type MetaAdNode,
  type MetaAdSetNode,
  MetaApiError,
  type MetaCampaignNode,
  type MetaCreativeNode,
  metaGet,
  metaGetAll,
  type MetaInsightNode,
} from "./api";

import type { ConnectionSecret, Connector, SyncContext, SyncResult, TestResult } from "@flyee/connectors";
import type { SupabaseClient } from "@supabase/supabase-js";

/** How far back the first sync backfills; later syncs only refresh the window below. */
const BACKFILL_DAYS = 365;
/** Attribution keeps rewriting recent conversions, so always re-fetch this trailing window. */
const REFRESH_WINDOW_DAYS = 28;
const UPSERT_BATCH = 500;

const ACCOUNT_FIELDS = "account_id,name,currency,timezone_name,account_status";
const CAMPAIGN_FIELDS =
  "id,name,objective,status,effective_status,buying_type,daily_budget,lifetime_budget,start_time,stop_time,updated_time";
const AD_SET_FIELDS =
  "id,campaign_id,name,status,effective_status,optimization_goal,billing_event,bid_strategy,daily_budget,lifetime_budget,learning_stage_info,targeting,start_time,end_time,updated_time";
const AD_FIELDS = "id,adset_id,campaign_id,name,status,effective_status,creative{id},updated_time";
const CREATIVE_FIELDS = "id,name,title,body,call_to_action_type,object_type,thumbnail_url,image_url";
const INSIGHT_FIELDS =
  "ad_id,adset_id,campaign_id,account_id,spend,impressions,reach,frequency,cpm,ctr,cpc,clicks,inline_link_clicks,actions,action_values,purchase_roas,quality_ranking,engagement_rate_ranking,conversion_rate_ranking";

// ---------- small parsers ----------

const num = (value: string | undefined): number | null => {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const int = (value: string | undefined): number | null => {
  const parsed = num(value);
  return parsed === null ? null : Math.round(parsed);
};

const todayUtc = (): string => new Date().toISOString().slice(0, 10);
function shiftDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const maxDate = (a: string, b: string): string => (a >= b ? a : b);

/** Pick the most relevant purchase entry from an actions-style array. */
function pickPurchase(entries: MetaActionEntry[] | undefined): number | null {
  if (!entries?.length) return null;
  const order = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];
  for (const type of order) {
    const hit = entries.find((entry) => entry.action_type === type);
    if (hit) return num(hit.value);
  }
  return null;
}

// ---------- persistence ----------

async function upsertChunked(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  for (let start = 0; start < rows.length; start += UPSERT_BATCH) {
    const batch = rows.slice(start, start + UPSERT_BATCH);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`Upsert into ${table} failed: ${error.message}`);
  }
}

// ---------- one account's structure + insights ----------

async function syncAccount(
  supabase: SupabaseClient,
  connectionId: string,
  account: MetaAdAccountNode,
  token: string,
  since: string,
  until: string,
  stats: Record<string, number>,
): Promise<void> {
  const accountId = account.account_id;
  const act = `act_${accountId}`;

  // Account row.
  await upsertChunked(
    supabase,
    "meta_ad_accounts",
    [
      {
        connection_id: connectionId,
        account_id: accountId,
        name: account.name ?? null,
        currency: account.currency ?? null,
        timezone_name: account.timezone_name ?? null,
        account_status: account.account_status ?? null,
        raw: account,
      },
    ],
    "connection_id,account_id",
  );

  // Structure: campaigns, ad sets, creatives, ads (full refresh — bounded volume).
  const campaigns = await metaGetAll<MetaCampaignNode>(`${act}/campaigns`, { fields: CAMPAIGN_FIELDS }, token);
  await upsertChunked(
    supabase,
    "meta_campaigns",
    campaigns.map((c) => ({
      connection_id: connectionId,
      account_id: accountId,
      campaign_id: c.id,
      name: c.name ?? null,
      objective: c.objective ?? null,
      status: c.status ?? null,
      effective_status: c.effective_status ?? null,
      buying_type: c.buying_type ?? null,
      daily_budget: int(c.daily_budget),
      lifetime_budget: int(c.lifetime_budget),
      start_time: c.start_time ?? null,
      stop_time: c.stop_time ?? null,
      updated_time: c.updated_time ?? null,
      raw: c,
    })),
    "connection_id,campaign_id",
  );
  stats.campaigns = (stats.campaigns ?? 0) + campaigns.length;

  const adSets = await metaGetAll<MetaAdSetNode>(`${act}/adsets`, { fields: AD_SET_FIELDS }, token);
  await upsertChunked(
    supabase,
    "meta_ad_sets",
    adSets.map((s) => ({
      connection_id: connectionId,
      account_id: accountId,
      ad_set_id: s.id,
      campaign_id: s.campaign_id ?? null,
      name: s.name ?? null,
      status: s.status ?? null,
      effective_status: s.effective_status ?? null,
      optimization_goal: s.optimization_goal ?? null,
      billing_event: s.billing_event ?? null,
      bid_strategy: s.bid_strategy ?? null,
      daily_budget: int(s.daily_budget),
      lifetime_budget: int(s.lifetime_budget),
      learning_stage_info: s.learning_stage_info ?? null,
      targeting: s.targeting ?? null,
      start_time: s.start_time ?? null,
      end_time: s.end_time ?? null,
      updated_time: s.updated_time ?? null,
      raw: s,
    })),
    "connection_id,ad_set_id",
  );
  stats.adSets = (stats.adSets ?? 0) + adSets.length;

  const creatives = await metaGetAll<MetaCreativeNode>(`${act}/adcreatives`, { fields: CREATIVE_FIELDS }, token);
  await upsertChunked(
    supabase,
    "meta_creatives",
    creatives.map((cr) => ({
      connection_id: connectionId,
      account_id: accountId,
      creative_id: cr.id,
      name: cr.name ?? null,
      title: cr.title ?? null,
      body: cr.body ?? null,
      call_to_action_type: cr.call_to_action_type ?? null,
      object_type: cr.object_type ?? null,
      thumbnail_url: cr.thumbnail_url ?? null,
      image_url: cr.image_url ?? null,
      raw: cr,
    })),
    "connection_id,creative_id",
  );
  stats.creatives = (stats.creatives ?? 0) + creatives.length;

  const ads = await metaGetAll<MetaAdNode>(`${act}/ads`, { fields: AD_FIELDS }, token);
  await upsertChunked(
    supabase,
    "meta_ads",
    ads.map((a) => ({
      connection_id: connectionId,
      account_id: accountId,
      ad_id: a.id,
      ad_set_id: a.adset_id ?? null,
      campaign_id: a.campaign_id ?? null,
      creative_id: a.creative?.id ?? null,
      name: a.name ?? null,
      status: a.status ?? null,
      effective_status: a.effective_status ?? null,
      updated_time: a.updated_time ?? null,
      raw: a,
    })),
    "connection_id,ad_id",
  );
  stats.ads = (stats.ads ?? 0) + ads.length;

  // Daily insights at ad level for the window. Upsert dedupes retroactive edits.
  const insights = await metaGetAll<MetaInsightNode>(
    `${act}/insights`,
    {
      level: "ad",
      time_increment: 1,
      time_range: JSON.stringify({ since, until }),
      fields: INSIGHT_FIELDS,
    },
    token,
  );
  await upsertChunked(
    supabase,
    "meta_insights_daily",
    insights
      .filter((row) => row.ad_id && row.date_start)
      .map((row) => ({
        connection_id: connectionId,
        account_id: accountId,
        ad_id: row.ad_id,
        ad_set_id: row.adset_id ?? null,
        campaign_id: row.campaign_id ?? null,
        date: row.date_start,
        spend: num(row.spend),
        impressions: int(row.impressions),
        reach: int(row.reach),
        frequency: num(row.frequency),
        cpm: num(row.cpm),
        ctr: num(row.ctr),
        cpc: num(row.cpc),
        clicks: int(row.clicks),
        inline_link_clicks: int(row.inline_link_clicks),
        purchases: pickPurchase(row.actions),
        purchase_value: pickPurchase(row.action_values),
        purchase_roas: pickPurchase(row.purchase_roas),
        actions: row.actions ?? null,
        action_values: row.action_values ?? null,
        quality_ranking: row.quality_ranking ?? null,
        engagement_rate_ranking: row.engagement_rate_ranking ?? null,
        conversion_rate_ranking: row.conversion_rate_ranking ?? null,
        raw: row,
      })),
    "connection_id,ad_id,date",
  );
  stats.insights = (stats.insights ?? 0) + insights.length;
}

// ---------- connector ----------

export const metaAdsConnector: Connector = {
  provider: "meta-ads",
  name: "Meta Ads",
  // Trilha A (launch): a Business Manager system-user token, pasted directly.
  // Trilha B (OAuth/Facebook Login) will populate the same field from a callback.
  secretFields: [{ key: "access_token", label: "System user access token" }],

  async test(secret: ConnectionSecret): Promise<TestResult> {
    const token = typeof secret.access_token === "string" ? secret.access_token : "";
    if (!token) return { ok: false, error: "Missing access_token." };
    try {
      const me = await metaGet<{ id: string; name?: string }>("me", { fields: "id,name" }, token);
      const accounts = await metaGetAll<MetaAdAccountNode>("me/adaccounts", { fields: ACCOUNT_FIELDS }, token);
      if (accounts.length === 0) {
        return { ok: false, error: "Token is valid but has no accessible ad accounts." };
      }
      return {
        ok: true,
        metadata: {
          user: me,
          accounts: accounts.map((a) => ({ account_id: a.account_id, name: a.name, currency: a.currency })),
        },
      };
    } catch (error) {
      const message =
        error instanceof MetaApiError ? error.message : error instanceof Error ? error.message : String(error);
      return { ok: false, error: `Meta API rejected the token: ${message}` };
    }
  },

  async sync({ connection, secret, supabase }: SyncContext): Promise<SyncResult> {
    const token = typeof secret.access_token === "string" ? secret.access_token : "";
    if (!token) throw new Error("Connection has no access_token.");

    const cursor = (connection.sync_cursor ?? {}) as Record<string, string>;
    const until = todayUtc();
    const backfillStart = shiftDays(until, -BACKFILL_DAYS);

    // Re-fetch accounts each run so newly granted accounts appear automatically.
    const accounts = await metaGetAll<MetaAdAccountNode>("me/adaccounts", { fields: ACCOUNT_FIELDS }, token);

    const stats: Record<string, number> = { accounts: accounts.length };
    const nextCursor: Record<string, string> = { ...cursor };

    for (const account of accounts) {
      const lastSynced = cursor[account.account_id];
      // First sync: full backfill. Later: only the trailing attribution window.
      const since = lastSynced ? maxDate(shiftDays(lastSynced, -REFRESH_WINDOW_DAYS), backfillStart) : backfillStart;
      await syncAccount(supabase, connection.id, account, token, since, until, stats);
      nextCursor[account.account_id] = until;
    }

    return { cursor: nextCursor, stats };
  },
};
