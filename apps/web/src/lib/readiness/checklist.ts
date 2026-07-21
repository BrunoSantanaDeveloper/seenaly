/**
 * The readiness intake (docs/PRODUCT.md phase 7) — pure domain, no I/O.
 *
 * "Prontidão antes do tráfego pago — a estrutura é o CAC mais barato."
 * The user declares WHAT THEY ALREADY HAVE; the system reasons about what that
 * costs them. A checked box means "I confirmed this is done". Unchecked stays
 * deliberately ambiguous (not done OR not known) and is never reported as
 * "you don't have it" — not knowing whether the pixel fires IS a finding.
 *
 * This spec is the single source of truth for both the UI (which renders it)
 * and the engine brief (which serializes it), so a new item is added in exactly
 * one place.
 */

export type ReadinessGroupKey = "mensuracao" | "pagina" | "checkout" | "descoberta" | "funil";

/** The boolean facts the user confirms. Keys match `product_readiness` columns. */
export type ReadinessItemKey =
  | "pixelInstalled"
  | "capiInstalled"
  | "conversionEventTested"
  | "analyticsInstalled"
  | "pageHasProof"
  | "pageMobileTested"
  | "pageFast"
  | "hasGuarantee"
  | "paymentPix"
  | "paymentCard"
  | "checkoutShort"
  | "abandonedRecovery"
  | "seoBasics"
  | "indexable"
  | "sitemapRobots"
  | "structuredData"
  | "socialProfiles"
  | "organicContent"
  | "emailCapture"
  | "emailFollowup"
  | "remarketingAudience";

export interface ReadinessItem {
  key: ReadinessItemKey;
  /**
   * Confirming this is cheap and NOT confirming it makes paid spend
   * predictably wasteful. Drives the free, local blocker list — no LLM call.
   */
  critical?: boolean;
}

export interface ReadinessGroup {
  key: ReadinessGroupKey;
  items: ReadinessItem[];
}

/**
 * Order matters: measurement first because it is the highest-leverage,
 * zero-cost lever. Without a trustworthy conversion signal the algorithm never
 * finishes learning and every click is priced as if it were the first.
 */
export const READINESS_GROUPS: ReadinessGroup[] = [
  {
    key: "mensuracao",
    items: [
      { key: "pixelInstalled", critical: true },
      { key: "conversionEventTested", critical: true },
      { key: "capiInstalled" },
      { key: "analyticsInstalled" },
    ],
  },
  {
    key: "pagina",
    items: [{ key: "pageHasProof" }, { key: "pageMobileTested" }, { key: "pageFast" }],
  },
  {
    key: "checkout",
    items: [
      { key: "paymentPix" },
      { key: "paymentCard" },
      { key: "checkoutShort" },
      { key: "hasGuarantee" },
      { key: "abandonedRecovery" },
    ],
  },
  {
    key: "descoberta",
    items: [
      { key: "seoBasics" },
      { key: "indexable" },
      { key: "sitemapRobots" },
      { key: "structuredData" },
      { key: "socialProfiles" },
      { key: "organicContent" },
    ],
  },
  {
    key: "funil",
    items: [{ key: "emailCapture" }, { key: "emailFollowup" }, { key: "remarketingAudience" }],
  },
];

export const READINESS_ITEM_KEYS: ReadinessItemKey[] = READINESS_GROUPS.flatMap((group) =>
  group.items.map((item) => item.key),
);

/** Where the money is taken. `none` is a blocker: there is nothing to buy. */
export const CHECKOUT_TYPES = ["own", "platform", "link", "none"] as const;
export type CheckoutType = (typeof CHECKOUT_TYPES)[number];

export type ReadinessProfile = Record<ReadinessItemKey, boolean> & {
  checkoutType: CheckoutType | null;
  guaranteeDays: number | null;
};

export const EMPTY_READINESS_PROFILE: ReadinessProfile = {
  ...(Object.fromEntries(READINESS_ITEM_KEYS.map((key) => [key, false])) as Record<ReadinessItemKey, boolean>),
  checkoutType: null,
  guaranteeDays: null,
};

/* -------------------------------------------------------------------------- */
/*  Row mapping (product_readiness uses snake_case)                            */
/* -------------------------------------------------------------------------- */

const COLUMN_BY_KEY: Record<ReadinessItemKey, string> = {
  pixelInstalled: "pixel_installed",
  capiInstalled: "capi_installed",
  conversionEventTested: "conversion_event_tested",
  analyticsInstalled: "analytics_installed",
  pageHasProof: "page_has_proof",
  pageMobileTested: "page_mobile_tested",
  pageFast: "page_fast",
  hasGuarantee: "has_guarantee",
  paymentPix: "payment_pix",
  paymentCard: "payment_card",
  checkoutShort: "checkout_short",
  abandonedRecovery: "abandoned_recovery",
  seoBasics: "seo_basics",
  indexable: "indexable",
  sitemapRobots: "sitemap_robots",
  structuredData: "structured_data",
  socialProfiles: "social_profiles",
  organicContent: "organic_content",
  emailCapture: "email_capture",
  emailFollowup: "email_followup",
  remarketingAudience: "remarketing_audience",
};

/** DB row → profile. A missing row is a valid state: nothing confirmed yet. */
export function toReadinessProfile(row: Record<string, unknown> | null | undefined): ReadinessProfile {
  if (!row) return { ...EMPTY_READINESS_PROFILE };
  const profile = { ...EMPTY_READINESS_PROFILE };
  for (const key of READINESS_ITEM_KEYS) {
    profile[key] = row[COLUMN_BY_KEY[key]] === true;
  }
  const checkoutType = row.checkout_type;
  profile.checkoutType = CHECKOUT_TYPES.includes(checkoutType as CheckoutType) ? (checkoutType as CheckoutType) : null;
  const days = row.guarantee_days;
  profile.guaranteeDays = typeof days === "number" && Number.isFinite(days) ? days : null;
  return profile;
}

/** Profile → DB row payload (without product_id/org_id, added by the caller). */
export function toReadinessRow(profile: ReadinessProfile): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of READINESS_ITEM_KEYS) {
    row[COLUMN_BY_KEY[key]] = profile[key] === true;
  }
  row.checkout_type = profile.checkoutType;
  // A guarantee length without a guarantee is noise — drop it rather than
  // persist a contradiction the engine would have to reconcile.
  row.guarantee_days = profile.hasGuarantee ? profile.guaranteeDays : null;
  return row;
}

/* -------------------------------------------------------------------------- */
/*  Local evaluation — free, instant, fully explainable                        */
/* -------------------------------------------------------------------------- */

/** Facts that live on the product, not the checklist, but gate readiness. */
export interface ReadinessContext {
  hasLandingPage: boolean;
  hasPrice: boolean;
}

/**
 * Why a blocker is a blocker, as a stable slug the UI translates. Each one
 * means: spending on ads right now is predictably wasted money.
 */
export type ReadinessBlocker =
  | "no-page"
  | "no-measurement"
  | "event-untested"
  | "no-checkout"
  | "no-payment"
  | "no-price";

export interface ReadinessGroupProgress {
  key: ReadinessGroupKey;
  confirmed: number;
  total: number;
}

export interface ReadinessEvaluation {
  confirmed: number;
  total: number;
  byGroup: ReadinessGroupProgress[];
  blockers: ReadinessBlocker[];
  /** Nothing confirmed and nothing declared — the intake has not been filled. */
  untouched: boolean;
}

/**
 * Deterministic signals derived from the checklist alone.
 *
 * Deliberately NOT a proprietary 0–100 score (docs/PRODUCT.md — explainable
 * signals precede any score): it is a count of confirmed items plus a named,
 * reasoned blocker list. The user gets this for free, before spending a single
 * credit on the engine.
 */
export function evaluateReadiness(profile: ReadinessProfile, context: ReadinessContext): ReadinessEvaluation {
  const byGroup = READINESS_GROUPS.map((group) => ({
    key: group.key,
    confirmed: group.items.filter((item) => profile[item.key]).length,
    total: group.items.length,
  }));
  const confirmed = byGroup.reduce((sum, group) => sum + group.confirmed, 0);
  const total = READINESS_ITEM_KEYS.length;

  const blockers: ReadinessBlocker[] = [];
  if (!context.hasLandingPage) blockers.push("no-page");
  // Nothing can be measured at all — the algorithm optimizes blind.
  if (!profile.pixelInstalled && !profile.capiInstalled) blockers.push("no-measurement");
  // Signal exists but was never verified: optimizing for purchases on an event
  // that may not fire is a coin flip paid for with media budget.
  else if (!profile.conversionEventTested) blockers.push("event-untested");
  if (profile.checkoutType === "none") blockers.push("no-checkout");
  else if (!profile.paymentPix && !profile.paymentCard) blockers.push("no-payment");
  // Without a price there is no CAC ceiling, so no ad result can be judged.
  if (!context.hasPrice) blockers.push("no-price");

  return {
    confirmed,
    total,
    byGroup,
    blockers,
    untouched: confirmed === 0 && profile.checkoutType === null,
  };
}
