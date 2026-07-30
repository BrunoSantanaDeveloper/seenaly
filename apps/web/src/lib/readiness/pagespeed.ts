/**
 * Server-only PageSpeed Insights fetch wrapper.
 *
 * SECURITY NOTE: unlike lib/readiness/scan.ts, there is no SSRF surface here —
 * GOOGLE fetches the page, not us; we only ever talk to googleapis.com. The
 * URL handed in is always a product's landing page that already passed the
 * scanner's validation.
 *
 * Optional by construction (maturity-spectrum invariant): without
 * GOOGLE_PAGESPEED_API_KEY the feature is invisible and the scan flow is
 * byte-identical to before. Never throws — a failure is a recorded PsiState
 * the UI and the engine reason about, not an exception that loses the scan.
 */

import { extractPsiSnapshot, type PsiState } from "./pagespeed-analyze";

/** PSI regularly takes 10–25s; the abort budget covers the worst of it. */
const PSI_TIMEOUT_MS = 25_000;

export function isPageSpeedConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PAGESPEED_API_KEY);
}

export async function runPageSpeed(url: string): Promise<PsiState> {
  const key = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!key) return { status: "failed", error: "not-configured" };

  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", "mobile");
  endpoint.searchParams.set("category", "performance");
  endpoint.searchParams.set("key", key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint.toString(), { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return { status: "failed", error: `http-${response.status}` };
    const json = (await response.json()) as unknown;
    const snapshot = extractPsiSnapshot(json, new Date().toISOString());
    return snapshot ?? { status: "failed", error: "invalid-response" };
  } catch (error) {
    return { status: "failed", error: (error as Error)?.name === "AbortError" ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
