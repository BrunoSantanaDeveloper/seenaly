/**
 * Thin typed client for the Meta Marketing / Graph API used by the meta-ads
 * connector. Handles pagination and rate-limit backoff; knows nothing about
 * our database. All calls are read-only (the product never operates campaigns).
 */

export const META_API_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/** Meta error codes that mean "you are being throttled" — worth retrying. */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80003, 80004]);
const MAX_RETRIES = 5;

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly subcode?: number,
    readonly isTransient = false,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

interface GraphErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number; is_transient?: boolean };
}

interface Paged<T> {
  data?: T[];
  paging?: { cursors?: { after?: string }; next?: string };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildUrl(path: string, params: Record<string, string | number | undefined>, accessToken: string): string {
  const url = new URL(path.startsWith("http") ? path : `${GRAPH_BASE}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  url.searchParams.set("access_token", accessToken);
  return url.toString();
}

/** One GET with retry/backoff on rate-limit and transient errors. */
async function graphGet<T>(url: string): Promise<T> {
  let lastError: MetaApiError | undefined;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, { method: "GET" });
    if (response.ok) return (await response.json()) as T;

    let body: GraphErrorBody = {};
    try {
      body = (await response.json()) as GraphErrorBody;
    } catch {
      /* non-JSON error body */
    }
    const err = body.error ?? {};
    const code = err.code;
    const transient = Boolean(err.is_transient) || (code !== undefined && RATE_LIMIT_CODES.has(code));
    lastError = new MetaApiError(
      err.message ?? `Graph API request failed (HTTP ${response.status}).`,
      code,
      err.error_subcode,
      transient,
    );

    // Retry throttling/transient errors and 429/5xx; fail fast on the rest
    // (bad token, permissions) so the connection surfaces a real error.
    const retryable = transient || response.status === 429 || response.status >= 500;
    if (!retryable) throw lastError;
    await sleep(Math.min(60_000, 2 ** attempt * 1_000 + Math.random() * 1_000));
  }
  throw lastError ?? new MetaApiError("Graph API request failed after retries.");
}

/** Single object fetch (e.g. /me). */
export function metaGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  accessToken: string,
): Promise<T> {
  return graphGet<T>(buildUrl(path, params, accessToken));
}

/** Fetch every page of an edge, following paging.next until exhausted. */
export async function metaGetAll<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  accessToken: string,
): Promise<T[]> {
  const out: T[] = [];
  let url: string | undefined = buildUrl(path, { limit: 200, ...params }, accessToken);
  while (url) {
    const page: Paged<T> = await graphGet<Paged<T>>(url);
    if (page.data?.length) out.push(...page.data);
    url = page.paging?.next; // already an absolute URL carrying the access token
  }
  return out;
}

// ---------- Response shapes (only the fields we request) ----------

export interface MetaAdAccountNode {
  account_id: string;
  id?: string;
  name?: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
}

export interface MetaCampaignNode {
  id: string;
  name?: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  buying_type?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  updated_time?: string;
}

export interface MetaAdSetNode {
  id: string;
  campaign_id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  optimization_goal?: string;
  billing_event?: string;
  bid_strategy?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  learning_stage_info?: Record<string, unknown>;
  targeting?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
  updated_time?: string;
}

export interface MetaAdNode {
  id: string;
  adset_id?: string;
  campaign_id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  creative?: { id?: string };
  updated_time?: string;
}

export interface MetaCreativeNode {
  id: string;
  name?: string;
  title?: string;
  body?: string;
  call_to_action_type?: string;
  object_type?: string;
  thumbnail_url?: string;
  image_url?: string;
}

export interface MetaActionEntry {
  action_type: string;
  value?: string;
}

export interface MetaInsightNode {
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  account_id?: string;
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  cpm?: string;
  ctr?: string;
  cpc?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: MetaActionEntry[];
  action_values?: MetaActionEntry[];
  purchase_roas?: MetaActionEntry[];
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
}
