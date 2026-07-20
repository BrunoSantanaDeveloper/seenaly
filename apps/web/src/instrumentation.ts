import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error tracking. No-op unless SENTRY_DSN (or the public DSN) is
 * set, so a clone without the key builds and runs unchanged. Source-map upload
 * is intentionally NOT wired here (no auth token at launch) — stack traces are
 * minified until that is configured; the goal now is simply to see production
 * errors during the beta.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({ dsn, tracesSampleRate: 0.1 });
  }
}

// Captures errors thrown in the App Router request path (safe no-op if uninit).
export const onRequestError = Sentry.captureRequestError;
