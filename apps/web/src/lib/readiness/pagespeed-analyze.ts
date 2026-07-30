/**
 * PageSpeed Insights (PSI) response extraction + the pageFast classifier.
 *
 * PURE — no network, no I/O — so every rule lands in scripts/test-readiness.mts.
 * The server-only fetch wrapper lives in ./pagespeed.ts.
 *
 * Why this exists: `pageFast` was the one performance signal in the checklist
 * and it was inverifiable — our own fetch time is explicitly NOT Core Web
 * Vitals (the brief says so). PSI is Google's OWN measurement of Google's own
 * thresholds, which is what makes refusing a "my page is fast" claim honest:
 * the evidence is official, not our guess.
 */

/** One finished PSI measurement, reduced to what the product reasons about. */
export interface PsiSnapshot {
  status: "ok";
  fetchedAt: string;
  /** Mobile-only by decision: Meta Ads traffic is overwhelmingly mobile. */
  strategy: "mobile";
  /** Lighthouse performance category score, 0–100 (null when absent). */
  performanceScore: number | null;
  /** Lab (Lighthouse) metrics — always present in a successful run. */
  lab: { lcpMs: number | null; cls: number | null; tbtMs: number | null };
  /**
   * Field (CrUX) p75 metrics — real users, PREFERRED over lab when present.
   * Null when the origin has too little traffic for CrUX.
   */
  field: {
    lcpMs: number | null;
    cls: number | null;
    inpMs: number | null;
    overall: "FAST" | "AVERAGE" | "SLOW" | null;
  } | null;
}

export type PsiState = PsiSnapshot | { status: "pending" } | { status: "failed"; error: string };

/** Google's published LCP thresholds (ms): good ≤ 2500, poor > 4000. */
export const PSI_LCP_GOOD_MS = 2500;
export const PSI_LCP_POOR_MS = 4000;

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/**
 * Reduce a PSI v5 response to a snapshot. Defensive by construction: any
 * missing branch degrades to nulls, and a response without a lighthouseResult
 * is not a measurement at all (returns null → caller records a failure).
 */
export function extractPsiSnapshot(json: unknown, fetchedAt: string): PsiSnapshot | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const lighthouse = root.lighthouseResult as Record<string, unknown> | undefined;
  if (!lighthouse || typeof lighthouse !== "object") return null;

  const categories = lighthouse.categories as Record<string, { score?: unknown }> | undefined;
  const rawScore = num(categories?.performance?.score);
  const audits = (lighthouse.audits ?? {}) as Record<string, { numericValue?: unknown }>;

  const loading = root.loadingExperience as
    | { metrics?: Record<string, { percentile?: unknown; category?: unknown }>; overall_category?: unknown }
    | undefined;
  const metrics = loading?.metrics ?? {};
  const fieldLcp = num(metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile);
  const fieldClsRaw = num(metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile);
  const fieldInp = num(metrics.INTERACTION_TO_NEXT_PAINT?.percentile);
  const overallRaw = loading?.overall_category;
  const overall = overallRaw === "FAST" || overallRaw === "AVERAGE" || overallRaw === "SLOW" ? overallRaw : null;
  const hasField = fieldLcp !== null || fieldClsRaw !== null || fieldInp !== null || overall !== null;

  return {
    status: "ok",
    fetchedAt,
    strategy: "mobile",
    performanceScore: rawScore === null ? null : Math.round(rawScore * 100),
    lab: {
      lcpMs: num(audits["largest-contentful-paint"]?.numericValue),
      cls: num(audits["cumulative-layout-shift"]?.numericValue),
      tbtMs: num(audits["total-blocking-time"]?.numericValue),
    },
    field: hasField
      ? {
          lcpMs: fieldLcp,
          // CrUX reports CLS ×100 as an integer percentile.
          cls: fieldClsRaw === null ? null : fieldClsRaw / 100,
          inpMs: fieldInp,
          overall,
        }
      : null,
  };
}

/**
 * The pageFast verdict from a PSI state, on Google's own cut points so a
 * refusal is never our guess:
 *   - LCP ≤ 2500ms  → true (good)
 *   - LCP > 4000ms  → false (poor — this is what refuses a false "fast" tick)
 *   - the gray zone, or no usable measurement → null (never grounds to refuse)
 * Field p75 (real users) is preferred; lab is the fallback for low-traffic
 * origins.
 */
export function classifyPageFast(psi: PsiState | null | undefined): boolean | null {
  if (!psi || psi.status !== "ok") return null;
  const lcp = psi.field?.lcpMs ?? psi.lab.lcpMs;
  if (lcp === null) return null;
  if (lcp <= PSI_LCP_GOOD_MS) return true;
  if (lcp > PSI_LCP_POOR_MS) return false;
  return null;
}
