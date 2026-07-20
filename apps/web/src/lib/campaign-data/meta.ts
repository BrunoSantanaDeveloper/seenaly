import {
  type BriefConnection,
  type CampaignBrief,
  type CampaignBriefProvider,
  COLD_START_BRIEF,
  registerCampaignBriefProvider,
  type SupabaseServerClient,
} from "./registry";

/**
 * Meta Ads campaign brief.
 *
 * Aggregating the whole account into one 30-day total is not enough for a
 * data-rich operator (docs analysis 2026-07-19): it can't name the failing
 * campaign/ad, can't see creative fatigue, and ignores the relevance rankings
 * the sync already stores. This provider adds a 7-vs-prior trend (fatigue),
 * per-campaign and per-ad breakdowns (named), the Meta relevance diagnostics,
 * and a bridge from top ads to the tagged creative library.
 */

const WINDOW_DAYS = 30;
/** The trailing sub-window compared against the rest, to spot fatigue/decay. */
const RECENT_DAYS = 7;
const MAX_INSIGHT_ROWS = 5000;
const TOP_CAMPAIGNS = 8;
const TOP_ADS = 10;

const shiftDays = (days: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const round = (v: number | null, digits = 2) => (v === null ? "n/d" : v.toFixed(digits));

interface InsightRow {
  campaign_id: string | null;
  ad_id: string | null;
  date: string | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  inline_link_clicks: number | null;
  purchases: number | null;
  purchase_value: number | null;
  frequency: number | null;
  quality_ranking: string | null;
  engagement_rate_ranking: string | null;
  conversion_rate_ranking: string | null;
}

interface Totals {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchaseValue: number;
  frequencySum: number;
  frequencyCount: number;
}

const emptyTotals = (): Totals => ({
  spend: 0,
  impressions: 0,
  clicks: 0,
  purchases: 0,
  purchaseValue: 0,
  frequencySum: 0,
  frequencyCount: 0,
});

function accumulate(t: Totals, row: InsightRow): void {
  t.spend += num(row.spend);
  t.impressions += num(row.impressions);
  t.clicks += num(row.clicks);
  t.purchases += num(row.purchases);
  t.purchaseValue += num(row.purchase_value);
  if (row.frequency !== null && row.frequency !== undefined) {
    t.frequencySum += num(row.frequency);
    t.frequencyCount += 1;
  }
}

const ctrOf = (t: Totals) => (t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null);
const cpcOf = (t: Totals) => (t.clicks > 0 ? t.spend / t.clicks : null);
const cpaOf = (t: Totals) => (t.purchases > 0 ? t.spend / t.purchases : null);
const roasOf = (t: Totals) => (t.spend > 0 ? t.purchaseValue / t.spend : null);
const freqOf = (t: Totals) => (t.frequencyCount > 0 ? t.frequencySum / t.frequencyCount : null);

/** Meta returns "below_average_*" in several flavors; treat any as a red flag. */
const isBelowAverage = (r: string | null) => Boolean(r && r.startsWith("below_average"));
const rankingLabel = (r: string | null) => (r ? r.replace(/_/g, " ") : "n/d");

async function buildMetaBrief(supabase: SupabaseServerClient, connection: BriefConnection): Promise<CampaignBrief> {
  const windowStart = shiftDays(-WINDOW_DAYS);
  const windowEnd = shiftDays(0);
  const recentCutoff = shiftDays(-RECENT_DAYS);

  const { data } = await supabase
    .from("meta_insights_daily")
    .select(
      "campaign_id, ad_id, date, spend, impressions, clicks, inline_link_clicks, purchases, purchase_value, frequency, quality_ranking, engagement_rate_ranking, conversion_rate_ranking",
    )
    .eq("connection_id", connection.id)
    .gte("date", windowStart)
    .lte("date", windowEnd)
    .limit(MAX_INSIGHT_ROWS);

  const rows = (data as InsightRow[]) ?? [];
  if (rows.length === 0) return COLD_START_BRIEF;
  const truncated = rows.length >= MAX_INSIGHT_ROWS;

  // Names for campaigns and ads, plus the creative link for the ad→library bridge.
  const [{ data: campaignRows }, { data: adRows }] = await Promise.all([
    supabase.from("meta_campaigns").select("campaign_id, name").eq("connection_id", connection.id),
    supabase.from("meta_ads").select("ad_id, name, creative_id").eq("connection_id", connection.id),
  ]);
  const campaignName = new Map((campaignRows ?? []).map((c) => [c.campaign_id as string, c.name as string]));
  const adName = new Map((adRows ?? []).map((a) => [a.ad_id as string, a.name as string]));
  const adCreativeId = new Map(
    (adRows ?? []).filter((a) => a.creative_id).map((a) => [a.ad_id as string, a.creative_id as string]),
  );

  // Tagged creative library, keyed by the Meta creative id it is bridged to.
  const { data: creativeRows } = await supabase
    .from("creatives")
    .select("meta_creative_id, name, hook, angle, proof_type")
    .eq("connection_id", connection.id)
    .not("meta_creative_id", "is", null);
  const creativeByMetaId = new Map(
    (creativeRows ?? []).map((c) => [c.meta_creative_id as string, c as Record<string, string | null>]),
  );

  // ---- Aggregations ----
  const overall = emptyTotals();
  const recent = emptyTotals();
  const prior = emptyTotals();
  const byCampaign = new Map<string, Totals>();
  const byAd = new Map<string, Totals>();
  // Most-recent non-null relevance rankings per ad.
  const adRanking = new Map<string, { date: string; q: string | null; e: string | null; c: string | null }>();
  const adsWithSpend = new Set<string>();

  for (const row of rows) {
    accumulate(overall, row);
    if (row.date && row.date > recentCutoff) accumulate(recent, row);
    else accumulate(prior, row);
    if (num(row.spend) > 0 && row.ad_id) adsWithSpend.add(row.ad_id);

    if (row.campaign_id) {
      const t = byCampaign.get(row.campaign_id) ?? emptyTotals();
      accumulate(t, row);
      byCampaign.set(row.campaign_id, t);
    }
    if (row.ad_id) {
      const t = byAd.get(row.ad_id) ?? emptyTotals();
      accumulate(t, row);
      byAd.set(row.ad_id, t);

      const hasRanking = row.quality_ranking || row.engagement_rate_ranking || row.conversion_rate_ranking;
      if (hasRanking && row.date) {
        const current = adRanking.get(row.ad_id);
        if (!current || row.date > current.date) {
          adRanking.set(row.ad_id, {
            date: row.date,
            q: row.quality_ranking,
            e: row.engagement_rate_ranking,
            c: row.conversion_rate_ranking,
          });
        }
      }
    }
  }

  // ---- Block text ----
  const lines: string[] = [`Janela: ${windowStart} a ${windowEnd} (últimos ${WINDOW_DAYS} dias)`];
  if (truncated) {
    lines.push(
      `ATENÇÃO: o volume atingiu o limite (${MAX_INSIGHT_ROWS} linhas); os totais são um PISO — trate valores absolutos como subestimados e priorize as taxas.`,
    );
  }
  lines.push(
    "### Conta (agregado)",
    `- Anúncios com veiculação: ${adsWithSpend.size}`,
    `- Gasto: ${round(overall.spend)} | Impressões: ${overall.impressions} | Cliques: ${overall.clicks}`,
    `- CTR: ${round(ctrOf(overall))}% | CPC: ${round(cpcOf(overall))} | Frequência média: ${round(freqOf(overall))}`,
    `- Compras: ${overall.purchases} | Valor: ${round(overall.purchaseValue)} | CPA: ${round(cpaOf(overall))} | ROAS: ${round(roasOf(overall))}`,
  );

  // Trend: last 7 days vs the prior window. Fatigue = CTR falling while frequency rises.
  const recentCtr = ctrOf(recent);
  const priorCtr = ctrOf(prior);
  const recentFreq = freqOf(recent);
  const priorFreq = freqOf(prior);
  lines.push(
    "### Tendência (últimos 7 dias vs. anteriores)",
    `- CTR: ${round(recentCtr)}% (7d) vs ${round(priorCtr)}% (antes)`,
    `- CPC: ${round(cpcOf(recent))} (7d) vs ${round(cpcOf(prior))} (antes)`,
    `- CPA: ${round(cpaOf(recent))} (7d) vs ${round(cpaOf(prior))} (antes)`,
    `- Frequência: ${round(recentFreq)} (7d) vs ${round(priorFreq)} (antes)`,
  );
  if (recentCtr !== null && priorCtr !== null && recentFreq !== null && priorFreq !== null) {
    if (recentCtr < priorCtr && recentFreq > priorFreq) {
      lines.push(
        "- SINAL DE FADIGA: CTR caindo enquanto a frequência sobe — considere renovar criativo/público antes de escalar.",
      );
    }
  }

  // Per-campaign, top by spend.
  const topCampaigns = [...byCampaign.entries()].sort((a, b) => b[1].spend - a[1].spend).slice(0, TOP_CAMPAIGNS);
  if (topCampaigns.length > 0) {
    lines.push("### Campanhas (maior gasto primeiro)");
    for (const [id, t] of topCampaigns) {
      const name = campaignName.get(id) ?? `campanha ${id}`;
      lines.push(
        `- ${name}: gasto ${round(t.spend)}, CTR ${round(ctrOf(t))}%, CPC ${round(cpcOf(t))}, compras ${t.purchases}, CPA ${round(cpaOf(t))}, ROAS ${round(roasOf(t))}`,
      );
    }
  }

  // Per-ad, top by spend, with relevance rankings + creative-library tags.
  const topAds = [...byAd.entries()].sort((a, b) => b[1].spend - a[1].spend).slice(0, TOP_ADS);
  if (topAds.length > 0) {
    lines.push("### Anúncios (maior gasto primeiro; diagnóstico de relevância da Meta)");
    for (const [id, t] of topAds) {
      const name = adName.get(id) ?? `anúncio ${id}`;
      const r = adRanking.get(id);
      const rankingText = r
        ? `relevância — qualidade: ${rankingLabel(r.q)}, engajamento: ${rankingLabel(r.e)}, conversão: ${rankingLabel(r.c)}`
        : "relevância: n/d";
      const belowFlags =
        r && (isBelowAverage(r.q) || isBelowAverage(r.e) || isBelowAverage(r.c)) ? " [ABAIXO DA MÉDIA]" : "";

      // Bridge to the tagged library, when this ad's creative is linked.
      const creativeId = adCreativeId.get(id);
      const tagged = creativeId ? creativeByMetaId.get(creativeId) : undefined;
      const tagText = tagged
        ? ` | biblioteca — ${[tagged.hook && `gancho: ${tagged.hook}`, tagged.angle && `ângulo: ${tagged.angle}`, tagged.proof_type && `prova: ${tagged.proof_type}`].filter(Boolean).join("; ") || "sem tags"}`
        : "";

      lines.push(
        `- ${name}: gasto ${round(t.spend)}, CTR ${round(ctrOf(t))}%, CPA ${round(cpaOf(t))}, ${rankingText}${belowFlags}${tagText}`,
      );
    }
    lines.push(
      "Diagnóstico de relevância: qualidade abaixo da média aponta criativo/experiência; engajamento abaixo aponta gancho fraco; conversão abaixo aponta desalinhamento pós-clique (página/oferta).",
    );
  }

  return { block: lines.join("\n"), hadData: true, windowStart, windowEnd };
}

export const metaCampaignBriefProvider: CampaignBriefProvider = {
  provider: "meta-ads",
  buildBrief: buildMetaBrief,
};

registerCampaignBriefProvider(metaCampaignBriefProvider);
