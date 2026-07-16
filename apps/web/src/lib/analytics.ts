"use client";

import { LOCAL_STORAGE_KEYS } from "@/constants";

/**
 * Product analytics behind an interface (flyee provider pattern — same as
 * billing/whatsapp/AI). The TEMPLATE SHIPS NO PROVIDER: `ANALYTICS_PROVIDER`
 * is null, no analytics script ever loads, and the cookie-consent banner
 * stays hidden (essential cookies — Supabase session, locale — are exempt
 * from consent under LGPD/GDPR, so a banner with nothing to control would
 * be theater).
 *
 * Derived projects: implement the interface with your SDK (PostHog,
 * Plausible, GA4, …) and assign it below. That single assignment activates
 * the consent banner, and `init()` runs ONLY after the user grants consent
 * — the gating is real by construction, not by promise.
 */
export interface AnalyticsProvider {
  /** Load/boot the SDK. Called once, only after consent is granted. */
  init(): void | Promise<void>;
  track?(event: string, props?: Record<string, unknown>): void;
  pageView?(path: string): void;
}

export const ANALYTICS_PROVIDER: AnalyticsProvider | null = null;

/** Bump when the privacy policy changes materially — users are re-asked. */
export const CONSENT_VERSION = 1;

export interface ConsentState {
  analytics: boolean;
  version: number;
  at: string;
}

const CONSENT_EVENT = "flyee:cookie-consent";

export function getStoredConsent(): ConsentState | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEYS.cookieConsent);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    // A policy bump invalidates the stored answer — the banner asks again.
    return parsed.version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function storeConsent(analytics: boolean): ConsentState {
  const state: ConsentState = { analytics, version: CONSENT_VERSION, at: new Date().toISOString() };
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEYS.cookieConsent, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode quota etc.) — consent still applies for this page view.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
  return state;
}

let initialized = false;

/** Idempotent: boots the provider once consent allows it. */
export function initAnalyticsIfConsented(consent: ConsentState | null = getStoredConsent()): void {
  if (initialized || !ANALYTICS_PROVIDER || !consent?.analytics) return;
  initialized = true;
  void ANALYTICS_PROVIDER.init();
}

/** Safe wrapper: silently drops events until provider + consent exist. */
export function track(event: string, props?: Record<string, unknown>): void {
  if (initialized) ANALYTICS_PROVIDER?.track?.(event, props);
}
