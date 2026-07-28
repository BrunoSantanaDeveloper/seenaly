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

import type { ScanSignals } from "./scan-analyze";

export type ReadinessGroupKey = "mensuracao" | "pagina" | "checkout" | "ativacao" | "descoberta" | "funil";

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
  | "signupFrictionLow"
  | "activationDefined"
  | "trialToPaidTracked"
  | "upgradePathClear"
  | "seoBasics"
  | "indexable"
  | "sitemapRobots"
  | "structuredData"
  | "socialProfiles"
  | "organicContent"
  | "emailCapture"
  | "emailFollowup"
  | "remarketingAudience";

/**
 * Which acquisition funnel this business actually runs (migration 0034).
 *
 * The whole readiness layer used to assume `direct` — ad → page → checkout →
 * purchase. That silently mis-audits anyone whose money is taken somewhere
 * else: a trial-first SaaS takes it AFTER login (so no scan can ever reach the
 * checkout, and the ad optimizes for the SIGNUP), and a lead-first business
 * takes it through a human (so there is no self-service checkout at all).
 *
 * Declared, never inferred — the same rule as the rest of the intake.
 */
export const FUNNEL_MODELS = ["direct", "trial_first", "lead_first"] as const;
export type FunnelModel = (typeof FUNNEL_MODELS)[number];

/** Null (not declared) behaves like `direct`, which is what the code assumed before. */
export const isTrialFirst = (model: FunnelModel | null): boolean => model === "trial_first";
export const isLeadFirst = (model: FunnelModel | null): boolean => model === "lead_first";

/**
 * How much of a claim we can actually PROVE.
 *
 * A self-declared checklist that feeds an AI verdict is garbage-in-garbage-out:
 * ticking "pixel installed" when it is not produces a confidently WRONG verdict,
 * which is worse than none. So claims are verified against the page scan where
 * evidence exists — and we are honest about where it does not.
 *
 * - `proved`   — the scan sees it. A contradicted claim is REFUSED, with proof.
 * - `weak`     — the scan only hints (a viewport tag is not "tested on mobile").
 *                We surface the hint and never refuse: rejecting on a guess is
 *                worse than trusting.
 * - `declared` — invisible to any scan (CAPI is server-side by definition, PIX
 *                sits behind a checkout flow). Trusted, but carried into the
 *                verdict as UNVERIFIED so confidence is discounted honestly.
 */
export type VerificationTier = "proved" | "weak" | "declared";

/** Can the user do it alone, or does it normally need a professional? */
export type ItemDifficulty = "diy" | "specialist";

export interface ReadinessItem {
  key: ReadinessItemKey;
  /**
   * Confirming this is cheap and NOT confirming it makes paid spend
   * predictably wasteful. Drives the free, local blocker list — no LLM call.
   */
  critical?: boolean;
  /** How much of this claim the scanner can prove. */
  verification: VerificationTier;
  /** Sets honest expectations BEFORE the user opens anything. */
  difficulty: ItemDifficulty;
  /** Optional Help Center article (help_articles) for the deep guide. */
  helpSlug?: string;
  /**
   * The platform's OWN official documentation for this item (trust 1 — the
   * highest tier in docs/PRODUCT.md's knowledge model). Lets a user who wants
   * to try it themselves go straight to the source instead of only being
   * offered "hire someone" or "pay for a session" — the DIY path the maturity
   * spectrum invariant promises never to gate behind a prerequisite.
   */
  officialDocUrl?: string;
  /**
   * Flags an item where the official flow (once opened via `officialDocUrl`)
   * itself asks the user to pick from a menu of platform events — e.g. Meta's
   * CAPI setup lists ~12 standard events with no indication of which apply.
   * A generic doc link does not answer that; content lives in
   * `item-events-<key>`, scoped to this product's initial recorte (digital
   * products / self-service offers), so the tip is a short recommendation, not
   * a generic listing.
   */
  recommendedEvents?: boolean;
  /**
   * Same idea, one step later in the official flow: after picking events,
   * Meta's own wizard presents a dense grid of "which fields to send"
   * checkboxes with no priority order. Content lives in
   * `item-parameters-<key>`.
   */
  recommendedParameters?: boolean;
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
      // The two that block a beginner on step 1 are both provable — the refusal
      // lands exactly where the pain is.
      {
        key: "pixelInstalled",
        critical: true,
        verification: "proved",
        difficulty: "specialist",
        officialDocUrl: "https://www.facebook.com/business/help/952192354843755?id=1205376682832142",
        recommendedEvents: true,
        recommendedParameters: true,
      },
      { key: "conversionEventTested", critical: true, verification: "declared", difficulty: "specialist" },
      { key: "capiInstalled", verification: "declared", difficulty: "specialist" },
      { key: "analyticsInstalled", verification: "proved", difficulty: "specialist" },
    ],
  },
  {
    key: "pagina",
    items: [
      { key: "pageHasProof", verification: "declared", difficulty: "diy" },
      { key: "pageMobileTested", verification: "weak", difficulty: "diy" },
      { key: "pageFast", verification: "weak", difficulty: "specialist" },
    ],
  },
  {
    key: "checkout",
    items: [
      { key: "paymentPix", verification: "declared", difficulty: "diy" },
      { key: "paymentCard", verification: "declared", difficulty: "diy" },
      { key: "checkoutShort", verification: "declared", difficulty: "specialist" },
      { key: "hasGuarantee", verification: "weak", difficulty: "diy" },
      { key: "abandonedRecovery", verification: "declared", difficulty: "specialist" },
    ],
  },
  {
    // Trial-first only (see `groupsForModel`): the structure that decides
    // whether a signup ever becomes revenue. Everything here lives behind the
    // login wall, so every item is `declared` — no scan can reach it, ever.
    key: "ativacao",
    items: [
      // The real pre-login "checkout" of this model is the signup form.
      { key: "signupFrictionLow", verification: "declared", difficulty: "diy" },
      { key: "activationDefined", verification: "declared", difficulty: "diy" },
      // Blocking for trial-first: optimizing on signups while blind to who pays
      // scales whatever brings the cheapest junk trial.
      { key: "trialToPaidTracked", critical: true, verification: "declared", difficulty: "specialist" },
      { key: "upgradePathClear", verification: "declared", difficulty: "diy" },
    ],
  },
  {
    key: "descoberta",
    items: [
      { key: "seoBasics", verification: "proved", difficulty: "diy" },
      { key: "indexable", verification: "proved", difficulty: "specialist" },
      { key: "sitemapRobots", verification: "proved", difficulty: "specialist" },
      { key: "structuredData", verification: "proved", difficulty: "specialist" },
      { key: "socialProfiles", verification: "weak", difficulty: "diy" },
      { key: "organicContent", verification: "declared", difficulty: "diy" },
    ],
  },
  {
    key: "funil",
    items: [
      { key: "emailCapture", verification: "weak", difficulty: "diy" },
      { key: "emailFollowup", verification: "declared", difficulty: "diy" },
      { key: "remarketingAudience", verification: "declared", difficulty: "specialist" },
    ],
  },
];

/** Item lookup by key — the UI needs the metadata without walking the groups. */
export const READINESS_ITEM_BY_KEY: Record<ReadinessItemKey, ReadinessItem> = Object.fromEntries(
  READINESS_GROUPS.flatMap((group) => group.items).map((item) => [item.key, item]),
) as Record<ReadinessItemKey, ReadinessItem>;

export const READINESS_ITEM_KEYS: ReadinessItemKey[] = READINESS_GROUPS.flatMap((group) =>
  group.items.map((item) => item.key),
);

/** Where the money is taken. `none` is a blocker: there is nothing to buy. */
export const CHECKOUT_TYPES = ["own", "platform", "link", "none"] as const;
export type CheckoutType = (typeof CHECKOUT_TYPES)[number];

export type ReadinessProfile = Record<ReadinessItemKey, boolean> & {
  checkoutType: CheckoutType | null;
  guaranteeDays: number | null;
  /** Which funnel this business runs. Null = not declared (treated as `direct`). */
  funnelModel: FunnelModel | null;
};

export const EMPTY_READINESS_PROFILE: ReadinessProfile = {
  ...(Object.fromEntries(READINESS_ITEM_KEYS.map((key) => [key, false])) as Record<ReadinessItemKey, boolean>),
  checkoutType: null,
  guaranteeDays: null,
  funnelModel: null,
};

/**
 * The groups worth showing for a model. Activation only exists in a trial-first
 * funnel — asking a direct-response seller about trial→paid would be noise, and
 * an item that cannot apply must never count against anyone's progress.
 */
export function groupsForModel(model: FunnelModel | null): ReadinessGroup[] {
  return READINESS_GROUPS.filter((group) => group.key !== "ativacao" || isTrialFirst(model));
}

/* -------------------------------------------------------------------------- */
/*  Verdict finding → checklist items ("I already fixed this")                 */
/* -------------------------------------------------------------------------- */

/**
 * Which checklist group a verdict dimension corresponds to.
 *
 * `oferta` lives in the product context and `midia` in the creative library —
 * neither is a checklist group, so findings on those dimensions offer no
 * "mark as resolved" (there would be nothing true to record).
 */
export const DIMENSION_GROUP: Record<string, ReadinessGroupKey | undefined> = {
  mensuracao: "mensuracao",
  pagina: "pagina",
  checkout: "checkout",
  descoberta: "descoberta",
  funil: "funil",
};

/** Every item of the group a dimension maps to. */
export function itemsForDimension(dimension: string): ReadinessItemKey[] {
  const group = DIMENSION_GROUP[dimension];
  if (!group) return [];
  return READINESS_GROUPS.find((entry) => entry.key === group)?.items.map((item) => item.key) ?? [];
}

/** Drop anything that is not a known item key — model output is never trusted. */
export function sanitizeRelatedItems(values: unknown): ReadinessItemKey[] {
  if (!Array.isArray(values)) return [];
  const known = new Set<string>(READINESS_ITEM_KEYS);
  return values.filter((value): value is ReadinessItemKey => typeof value === "string" && known.has(value));
}

/**
 * The checklist items a finding lets the user tick when they say "already
 * fixed". Prefers the engine's own `related_items` (precise: it knows the
 * finding was only about the pixel), and falls back to the whole dimension
 * group when absent — which is the case for every verdict stored before the
 * field existed.
 */
export function resolvableItems(dimension: string, relatedItems: unknown): ReadinessItemKey[] {
  const explicit = sanitizeRelatedItems(relatedItems);
  return explicit.length > 0 ? explicit : itemsForDimension(dimension);
}

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
  signupFrictionLow: "signup_friction_low",
  activationDefined: "activation_defined",
  trialToPaidTracked: "trial_to_paid_tracked",
  upgradePathClear: "upgrade_path_clear",
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
  const funnelModel = row.funnel_model;
  profile.funnelModel = FUNNEL_MODELS.includes(funnelModel as FunnelModel) ? (funnelModel as FunnelModel) : null;
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
  row.funnel_model = profile.funnelModel;
  return row;
}

/* -------------------------------------------------------------------------- */
/*  Verification — never trust a claim we can disprove                         */
/* -------------------------------------------------------------------------- */

/** The scan's answer about one claim. Only `contradicted` refuses a tick. */
export type VerificationOutcome = "verified" | "contradicted" | "unverifiable";

/**
 * What the scan OBSERVED for one item: true = present, false = absent,
 * null = cannot tell (and therefore never grounds for refusing anything).
 *
 * The `jsRenderedLikely` guard is the critical one: on a client-rendered page
 * the tags are injected after our fetch, so absence proves nothing. Refusing a
 * true "pixel installed" claim on an SPA would be a confident lie — exactly the
 * failure this whole mechanism exists to prevent.
 */
export function observeItem(key: ReadinessItemKey, signals: ScanSignals | null): boolean | null {
  if (!signals || signals.jsRenderedLikely) return null;
  switch (key) {
    case "pixelInstalled":
      return signals.tracking.metaPixel;
    case "analyticsInstalled":
      return signals.tracking.ga4 || signals.tracking.gtm;
    case "seoBasics":
      return Boolean(signals.seo.title) && Boolean(signals.seo.metaDescription);
    case "indexable":
      return !signals.seo.noindex && !signals.discovery.robotsDisallowsAll;
    case "sitemapRobots": {
      // "published" means both. A definitive `missing` disproves it; an `error`
      // means we could not check, which is not evidence of absence.
      const { sitemapXml, robotsTxt } = signals.discovery;
      if (sitemapXml === "error" || robotsTxt === "error") return null;
      return sitemapXml === "found" && robotsTxt === "found";
    }
    case "structuredData":
      // Malformed JSON-LD still counts as PRESENT (the engine flags the invalid
      // one separately) — refusing would overstate what we know.
      return signals.seo.structuredDataTypes.length > 0;

    // Weak hints: surfaced to the user, never used to refuse (see verifyItem).
    case "pageMobileTested":
      return signals.seo.hasViewport;
    case "hasGuarantee":
    case "socialProfiles":
    case "emailCapture":
    case "pageFast":
      return null;
    default:
      return null;
  }
}

/**
 * The verdict on one claim. A tick is refused ONLY when the item is in the
 * `proved` tier AND the evidence positively disproves it. Everything else is
 * trusted — we never reject on a guess.
 */
export function verifyItem(key: ReadinessItemKey, claimed: boolean, signals: ScanSignals | null): VerificationOutcome {
  if (READINESS_ITEM_BY_KEY[key]?.verification !== "proved") return "unverifiable";
  const observed = observeItem(key, signals);
  if (observed === null) return "unverifiable";
  if (observed) return "verified";
  return claimed ? "contradicted" : "unverifiable";
}

/** Items the user claims but the evidence disproves — the refusal list. */
export function verifyAgainstScan(profile: ReadinessProfile, signals: ScanSignals | null): ReadinessItemKey[] {
  return READINESS_ITEM_KEYS.filter((key) => verifyItem(key, profile[key], signals) === "contradicted");
}

/**
 * Fold everything the page read PROVED into the profile, so those items are
 * settled by evidence instead of being asked.
 *
 * Asking someone to declare a pixel we can see for ourselves is redundant work
 * and an open invitation to answer wrong. Reading first and confirming what is
 * demonstrably there removes both.
 *
 * ONE-WAY ON PURPOSE — it can only ever turn an item ON. Absence is not
 * disproof: a client-rendered page hides its tags from an HTML fetch, so
 * writing `false` from "not found" would assert exactly the confident lie this
 * whole layer exists to prevent. Items the read cannot settle are left exactly
 * as they were, to be asked.
 */
export function autoConfirmProven(profile: ReadinessProfile, signals: ScanSignals | null): ReadinessProfile {
  if (!signals) return profile;
  let next: ReadinessProfile | null = null;
  for (const key of READINESS_ITEM_KEYS) {
    if (profile[key]) continue;
    if (READINESS_ITEM_BY_KEY[key]?.verification !== "proved") continue;
    if (observeItem(key, signals) !== true) continue;
    next ??= { ...profile };
    next[key] = true;
  }
  // Same object when nothing changed, so callers can skip a pointless write.
  return next ?? profile;
}

/* -------------------------------------------------------------------------- */
/*  Is a verdict finding actually fixed? (declared vs proved)                  */
/* -------------------------------------------------------------------------- */

/**
 * How much we can vouch for a finding the user marked as fixed.
 *
 * The bug this exists to kill: the verdict card rendered a green "Item
 * corrigido" the moment the boxes were ticked, which reads as "the system
 * confirmed this" when it only ever meant "I said so". In a product whose whole
 * premise is that a claim is not proof, that badge was the single most
 * misleading pixel on the screen.
 *
 * So the same three-tier trust model the checklist uses now governs the plan:
 *  - `verified`     — ticked AND every provable item was proved by the page scan.
 *  - `contradicted` — ticked but the scan disproves at least one item. Worst
 *                     case, and the one that must never look finished.
 *  - `awaiting-proof` — ticked, provable items exist, the scan has not confirmed
 *                     them yet. Honest middle ground: we believe you, we cannot
 *                     vouch for it.
 *  - `declared`     — ticked and NOTHING here is machine-provable (CAPI is
 *                     server-side, PIX sits behind a checkout). The user's word
 *                     is the best truth obtainable, so this counts as done —
 *                     nagging forever would be dishonest in the other direction.
 *  - `open`         — not ticked (or nothing to tick).
 */
export type FindingResolution = "open" | "declared" | "awaiting-proof" | "verified" | "contradicted";

export function findingResolution(
  items: ReadinessItemKey[],
  profile: ReadinessProfile,
  evidence: {
    verified: ReadinessItemKey[];
    contradicted: ReadinessItemKey[];
    /**
     * Whether checking is even possible — i.e. there is a page we could read.
     * Without one, "awaiting proof" would be a life sentence: the user ticked
     * the box, we say it is unconfirmed, and no action they take can ever
     * change that. So when we cannot check, we do what we do everywhere else
     * and take their word (see `observeItem` returning null).
     */
    canVerify?: boolean;
  },
): FindingResolution {
  // Dimensions with no checklist items (oferta, midia) can never be "resolved"
  // from here — there is nothing true to record.
  if (items.length === 0) return "open";
  if (items.some((key) => evidence.contradicted.includes(key))) return "contradicted";
  if (!items.every((key) => profile[key])) return "open";

  const provable = items.filter((key) => READINESS_ITEM_BY_KEY[key]?.verification === "proved");
  if (provable.length === 0) return "declared";
  if (provable.every((key) => evidence.verified.includes(key))) return "verified";
  return evidence.canVerify === false ? "declared" : "awaiting-proof";
}

/**
 * Whether a finding still belongs in the "pending" map.
 *
 * `awaiting-proof` deliberately STAYS pending: the user ticked it, but the one
 * thing we could check has not been checked. Dropping it would tell them the
 * job is done on nothing but their own say-so — the exact inflation the
 * verification layer exists to prevent. The UI compensates by labelling it
 * distinctly (and offering the re-scan) instead of hiding it.
 */
export function isFindingPending(resolution: FindingResolution): boolean {
  return resolution === "open" || resolution === "awaiting-proof" || resolution === "contradicted";
}

/* -------------------------------------------------------------------------- */
/*  Applicability — do not ask for what this business cannot do                */
/* -------------------------------------------------------------------------- */

/** Why an item probably does not apply. A stable slug the UI translates. */
export type NotApplicableReason =
  | "platform-owns-checkout"
  | "platform-owns-site"
  | "no-own-server"
  /** A human closes the sale — there is no self-service checkout to audit. */
  | "sales-closes-deal"
  /** Trial-first: activation items are meaningless without a trial. */
  | "no-trial";

/**
 * Whether an item is out of this business's reach.
 *
 * Driven by DECLARED channel ownership, never by a missing URL: not having a
 * page is "I haven't done it yet", not "it doesn't apply to me". Marking page
 * items as inapplicable just because no URL is on file would make the product
 * lie to a user who simply has not built the page.
 */
const CHECKOUT_ITEMS: ReadinessItemKey[] = ["checkoutShort", "abandonedRecovery", "paymentPix", "paymentCard"];
const ACTIVATION_ITEMS: ReadinessItemKey[] = [
  "signupFrictionLow",
  "activationDefined",
  "trialToPaidTracked",
  "upgradePathClear",
];

export function notApplicableReason(
  key: ReadinessItemKey,
  profile: ReadinessProfile,
  context: { hasLandingPage: boolean },
): NotApplicableReason | null {
  // Funnel model first — it decides whether a whole surface exists at all.
  // Lead-first: a person closes the deal, so there is no self-service checkout
  // to shorten, instrument or add PIX to. Auditing it would demand work on
  // something the business does not have.
  if (isLeadFirst(profile.funnelModel) && CHECKOUT_ITEMS.includes(key)) return "sales-closes-deal";
  // Activation only means something when there IS a trial to activate.
  if (!isTrialFirst(profile.funnelModel) && ACTIVATION_ITEMS.includes(key)) return "no-trial";

  const onPlatform = profile.checkoutType === "platform";
  if (!onPlatform) return null;

  // The platform owns the checkout flow — he cannot shorten or instrument it.
  if (key === "checkoutShort" || key === "abandonedRecovery") return "platform-owns-checkout";

  // Without a page of his own he has no server and no site to work on: those
  // belong to the platform.
  if (!context.hasLandingPage) {
    if (key === "capiInstalled") return "no-own-server";
    if (key === "sitemapRobots" || key === "structuredData") return "platform-owns-site";
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Local evaluation — free, instant, fully explainable                        */
/* -------------------------------------------------------------------------- */

/** Facts that live on the product, not the checklist, but gate readiness. */
export interface ReadinessContext {
  hasLandingPage: boolean;
  hasPrice: boolean;
  /** Latest successful scan, when one exists — enables verification. */
  signals?: ScanSignals | null;
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
  | "no-price"
  /**
   * Trial-first only: the ad optimizes for SIGNUPS, so being blind to which
   * signups become paying customers means scaling whatever produces the
   * cheapest junk trial. That is money predictably wasted, which is the bar
   * for a blocker.
   */
  | "trial-conversion-unmeasured";

export interface ReadinessGroupProgress {
  key: ReadinessGroupKey;
  /** Items the user ticked (all items, applicable or not) — kept as-is so the
   *  client/server agreement and the existing tests never move. */
  confirmed: number;
  total: number;
  /** Items that actually apply to this business (total minus platform-owned). */
  applicable: number;
  /**
   * Provable items the page scan PROVED. This is the inforgeable number — it can
   * only grow by fixing the thing and letting the scanner see it, never by
   * ticking a box. It is what the celebration is allowed to fire on.
   */
  verified: number;
  /**
   * The honest "done" count over `applicable`: a provable item counts only once
   * the scan proves it (ticking is not enough — that is the anti-fraud), while a
   * declared/weak item counts when confirmed, because the scanner can never see
   * it and the user's word is the best truth available.
   */
  achieved: number;
}

export interface ReadinessEvaluation {
  confirmed: number;
  total: number;
  byGroup: ReadinessGroupProgress[];
  blockers: ReadinessBlocker[];
  /** Nothing confirmed and nothing declared — the intake has not been filled. */
  untouched: boolean;
  /**
   * Claims the scan positively PROVED. This — not `confirmed` — is what the
   * progress UI celebrates: a number you cannot inflate by ticking boxes.
   */
  verified: ReadinessItemKey[];
  /** Claims the scan disproves. The UI refuses these ticks, with evidence. */
  contradicted: ReadinessItemKey[];
  /** Out of this business's reach — de-emphasised, never hidden. */
  notApplicable: ReadinessItemKey[];
  /** Why each of those does not apply, so consumers never recompute (and never
   *  recompute with the wrong context, which would state a false reason). */
  notApplicableReasons: Partial<Record<ReadinessItemKey, NotApplicableReason>>;
  /** `total` minus what does not apply, so gaps that aren't his don't shame him. */
  applicableTotal: number;
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
  // Verification and applicability come first because the honest per-dimension
  // progress is built from them — but neither touches `confirmed`, `total` or
  // `blockers`, which keep their exact prior meaning.
  const signals = context.signals ?? null;
  const verified = READINESS_ITEM_KEYS.filter((key) => verifyItem(key, profile[key], signals) === "verified");
  const contradicted = READINESS_ITEM_KEYS.filter((key) => verifyItem(key, profile[key], signals) === "contradicted");
  const notApplicableReasons: Partial<Record<ReadinessItemKey, NotApplicableReason>> = {};
  for (const key of READINESS_ITEM_KEYS) {
    const reason = notApplicableReason(key, profile, context);
    if (reason) notApplicableReasons[key] = reason;
  }
  const notApplicable = Object.keys(notApplicableReasons) as ReadinessItemKey[];

  const verifiedSet = new Set(verified);
  const naSet = new Set(notApplicable);
  const isProvable = (key: ReadinessItemKey) => READINESS_ITEM_BY_KEY[key].verification === "proved";

  const byGroup: ReadinessGroupProgress[] = READINESS_GROUPS.map((group) => {
    const keys = group.items.map((item) => item.key);
    const applicableKeys = keys.filter((key) => !naSet.has(key));
    return {
      key: group.key,
      confirmed: keys.filter((key) => profile[key]).length,
      total: keys.length,
      applicable: applicableKeys.length,
      verified: applicableKeys.filter((key) => verifiedSet.has(key)).length,
      // Provable ⇒ must be proved by the scan; everything else ⇒ the user's tick.
      achieved: applicableKeys.filter((key) => verifiedSet.has(key) || (!isProvable(key) && profile[key])).length,
    };
  });
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
  // Lead-first takes no money online by definition — demanding a payment method
  // would be a false blocker on a business that is structurally fine.
  else if (!isLeadFirst(profile.funnelModel) && !profile.paymentPix && !profile.paymentCard) {
    blockers.push("no-payment");
  }
  // Trial-first: the signup is the optimized event, so trial→paid is the only
  // thing that tells a good cohort from a junk one.
  if (isTrialFirst(profile.funnelModel) && !profile.trialToPaidTracked) {
    blockers.push("trial-conversion-unmeasured");
  }
  // Without a price there is no CAC ceiling, so no ad result can be judged.
  if (!context.hasPrice) blockers.push("no-price");

  return {
    confirmed,
    total,
    byGroup,
    blockers,
    untouched: confirmed === 0 && profile.checkoutType === null && profile.funnelModel === null,
    verified,
    contradicted,
    notApplicable,
    notApplicableReasons,
    applicableTotal: total - notApplicable.length,
  };
}
