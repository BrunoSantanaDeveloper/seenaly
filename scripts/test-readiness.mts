/**
 * Tests for the readiness layer's pure domain (docs/PRODUCT.md phase 7).
 *
 * Usage:  npm run test:readiness
 *
 * Covers three things that must never regress silently:
 *   1. the deterministic blocker evaluator — it runs for free on every keystroke
 *      and is the value the user gets BEFORE spending a credit;
 *   2. the SSRF address guard — `scanSite` fetches a URL supplied by a tenant,
 *      so a hole here exposes the cloud metadata endpoint and anything else
 *      reachable from our network. This is the reason this file is committed
 *      rather than run ad hoc;
 *   3. the HTML analyzer — regex over real-world markup, where attribute order,
 *      SVG <title>, malformed JSON-LD and @graph nesting all break naive code.
 *
 * The repo has no test runner; this follows the established `tsx scripts/*.mts`
 * convention. No network, no database, no keys — it is safe to run anywhere.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  EMPTY_READINESS_PROFILE,
  autoConfirmProven,
  evaluateReadiness,
  findingResolution,
  isFindingPending,
  itemsForDimension,
  notApplicableReason,
  READINESS_ITEM_BY_KEY,
  READINESS_ITEM_KEYS,
  type ReadinessItemKey,
  type ReadinessProfile,
  resolvableItems,
  sanitizeRelatedItems,
  toReadinessProfile,
  toReadinessRow,
  verifyAgainstScan,
  verifyItem,
} from "../apps/web/src/lib/readiness/checklist";
import { readinessFunnelModelBlock, readinessScanBlock } from "../apps/web/src/lib/readiness/brief";
import { type AssistSignals, assistReason } from "../apps/web/src/lib/readiness/assist";
import { analyzeScan } from "../apps/web/src/lib/readiness/scan-analyze";
import { isBlockedAddress } from "../apps/web/src/lib/readiness/scan";

let failures = 0;
let passes = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passes++;
    return;
  }
  failures++;
  console.log(`FAIL  ${name}\n        expected ${e}\n        actual   ${a}`);
};

const section = (title: string) => console.log(`\n--- ${title} ---`);

/* ========================================================================== */
section("Deterministic blocker evaluator");
/* ========================================================================== */

const p = (over: Partial<ReadinessProfile> = {}): ReadinessProfile => ({ ...EMPTY_READINESS_PROFILE, ...over });

// 21 structural items + the 4 trial-first activation items (migration 0034).
check("25 checklist items", READINESS_ITEM_KEYS.length, 25);

const blank = evaluateReadiness(p(), { hasLandingPage: false, hasPrice: false });
check("blank: untouched", blank.untouched, true);
check("blank: 0 confirmed", blank.confirmed, 0);
check("blank: blockers", blank.blockers, ["no-page", "no-measurement", "no-payment", "no-price"]);

// Pixel present but unverified takes the event-untested branch, NOT no-measurement.
check(
  "pixel without a tested event",
  evaluateReadiness(p({ pixelInstalled: true, paymentPix: true }), { hasLandingPage: true, hasPrice: true }).blockers,
  ["event-untested"],
);
check(
  "verified event clears measurement",
  evaluateReadiness(p({ pixelInstalled: true, conversionEventTested: true, paymentCard: true }), {
    hasLandingPage: true,
    hasPrice: true,
  }).blockers,
  [],
);
// Server-side-only setups are real: CAPI alone counts as measurement.
check(
  "CAPI alone is measurement",
  evaluateReadiness(p({ capiInstalled: true, conversionEventTested: true, paymentPix: true }), {
    hasLandingPage: true,
    hasPrice: true,
  }).blockers,
  [],
);
// One cause must not emit two blockers.
check(
  "checkout 'none' is a single blocker",
  evaluateReadiness(p({ pixelInstalled: true, conversionEventTested: true, checkoutType: "none", paymentPix: true }), {
    hasLandingPage: true,
    hasPrice: true,
  }).blockers,
  ["no-checkout"],
);

const some = p({ pixelInstalled: true, capiInstalled: true, pageFast: true, seoBasics: true, emailCapture: true });
const ev = evaluateReadiness(some, { hasLandingPage: true, hasPrice: true });
check("confirmed total", ev.confirmed, 5);
check(
  "group sums equal the total",
  ev.byGroup.reduce((s, g) => s + g.confirmed, 0),
  ev.confirmed,
);
check(
  "group totals equal 25",
  ev.byGroup.reduce((s, g) => s + g.total, 0),
  25,
);

const rich = p({
  pixelInstalled: true,
  conversionEventTested: true,
  hasGuarantee: true,
  guaranteeDays: 7,
  checkoutType: "own",
  organicContent: true,
});
check("row round-trip is lossless", toReadinessProfile(toReadinessRow(rich)), rich);
check("guarantee days dropped without a guarantee", toReadinessRow(p({ guaranteeDays: 30 })).guarantee_days, null);
check("missing row is a valid empty profile", toReadinessProfile(null), EMPTY_READINESS_PROFILE);
check("garbage checkout_type ignored", toReadinessProfile({ checkout_type: "bogus" }).checkoutType, null);

/* ========================================================================== */
section("Finding → checklist mapping (\"I already fixed this\")");
/* ========================================================================== */

// Model output is never trusted: unknown keys are dropped, junk yields nothing.
check("keeps only known item keys", sanitizeRelatedItems(["pixelInstalled", "nope", 42, null]), ["pixelInstalled"]);
check("non-array input is empty", sanitizeRelatedItems("pixelInstalled"), []);
check("undefined is empty", sanitizeRelatedItems(undefined), []);

// Precise engine output wins over the coarse dimension fallback.
check("explicit related_items win", resolvableItems("mensuracao", ["pixelInstalled", "conversionEventTested"]), [
  "pixelInstalled",
  "conversionEventTested",
]);
// Verdicts stored BEFORE related_items existed must still be resolvable.
check("missing related_items falls back to the dimension group", resolvableItems("mensuracao", undefined), [
  "pixelInstalled",
  "conversionEventTested",
  "capiInstalled",
  "analyticsInstalled",
]);
check("all-invalid keys fall back too", resolvableItems("checkout", ["bogus"]), itemsForDimension("checkout"));
// Offer and media have no checklist group — no "mark resolved" for them.
check("oferta has no resolvable items", resolvableItems("oferta", undefined), []);
check("midia has no resolvable items", resolvableItems("midia", undefined), []);
check("unknown dimension is safe", resolvableItems("inventada", undefined), []);
// Every mapped dimension must resolve to real keys, or the checkbox lies.
for (const dimension of ["mensuracao", "pagina", "checkout", "descoberta", "funil"]) {
  const items = itemsForDimension(dimension);
  check(
    `${dimension} maps to real checklist keys`,
    items.length > 0 && items.every((key) => (READINESS_ITEM_KEYS as string[]).includes(key)),
    true,
  );
}

/* ========================================================================== */
section("Verification — refuse only with proof");
/* ========================================================================== */

// A minimal signals object; each test overrides just what it needs.
const signalsWith = (over: Record<string, unknown> = {}) =>
  ({
    seo: {
      title: "t",
      titleLength: 1,
      metaDescription: "d",
      metaDescriptionLength: 1,
      canonical: null,
      lang: null,
      hasViewport: true,
      h1Count: 1,
      firstH1: null,
      ogTitle: false,
      ogDescription: false,
      ogImage: false,
      structuredDataTypes: ["Product"],
      noindex: false,
      imagesTotal: 0,
      imagesMissingAlt: 0,
      ...((over.seo as object) ?? {}),
    },
    discovery: {
      robotsTxt: "found",
      robotsDisallowsAll: false,
      sitemapReferencedInRobots: true,
      sitemapXml: "found",
      ...((over.discovery as object) ?? {}),
    },
    tracking: { metaPixel: true, ga4: true, gtm: false, tiktokPixel: false, ...((over.tracking as object) ?? {}) },
    https: true,
    jsRenderedLikely: false,
    visibleTextLength: 900,
    bytes: 1000,
    fetchMs: 100,
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

// The core promise: a false claim is caught.
check(
  "claimed pixel + no pixel on the page => contradicted",
  verifyItem("pixelInstalled", true, signalsWith({ tracking: { metaPixel: false } })),
  "contradicted",
);
check("claimed pixel + pixel present => verified", verifyItem("pixelInstalled", true, signalsWith()), "verified");
// Never refuse without evidence.
check("no scan at all => never contradicted", verifyItem("pixelInstalled", true, null), "unverifiable");
// The critical false-positive guard: on a client-rendered page the tags are
// injected after our fetch, so absence proves nothing.
check(
  "JS-rendered page => never contradicted",
  verifyItem("pixelInstalled", true, signalsWith({ jsRenderedLikely: true, tracking: { metaPixel: false } })),
  "unverifiable",
);
// Unclaimed + absent is not a lie, just a gap.
check("unclaimed + absent => unverifiable", verifyItem("pixelInstalled", false, signalsWith({ tracking: { metaPixel: false } })), "unverifiable");

// Tier discipline: things we cannot see are never refused.
for (const key of ["capiInstalled", "conversionEventTested", "paymentPix", "checkoutShort"] as const) {
  check(`declared item never refused: ${key}`, verifyItem(key, true, signalsWith({ tracking: { metaPixel: false } })), "unverifiable");
}
// Weak hints must not refuse either — rejecting on a guess is worse than trusting.
for (const key of ["pageMobileTested", "pageFast", "hasGuarantee", "socialProfiles", "emailCapture"] as const) {
  check(`weak item never refused: ${key}`, verifyItem(key, true, signalsWith({ seo: { hasViewport: false } })), "unverifiable");
}

// `sitemapRobots` means BOTH published; an `error` is not evidence of absence.
check(
  "sitemap missing => contradicted",
  verifyItem("sitemapRobots", true, signalsWith({ discovery: { sitemapXml: "missing" } })),
  "contradicted",
);
check(
  "sitemap check errored => unverifiable, never refused",
  verifyItem("sitemapRobots", true, signalsWith({ discovery: { sitemapXml: "error" } })),
  "unverifiable",
);
check(
  "noindex disproves 'indexable'",
  verifyItem("indexable", true, signalsWith({ seo: { noindex: true } })),
  "contradicted",
);

check(
  "verifyAgainstScan lists only the disproved claims",
  verifyAgainstScan(p({ pixelInstalled: true, capiInstalled: true }), signalsWith({ tracking: { metaPixel: false, ga4: false } })),
  ["pixelInstalled"],
);

// Every item must declare its tier and difficulty, or the UI lies by omission.
check(
  "all 25 items declare verification + difficulty",
  READINESS_ITEM_KEYS.every(
    (key) => Boolean(READINESS_ITEM_BY_KEY[key]?.verification) && Boolean(READINESS_ITEM_BY_KEY[key]?.difficulty),
  ),
  true,
);

// officialDocUrl renders as a real clickable link out to a third-party site —
// a typo here is a dead or wrong link at the exact moment we're building
// trust, so any set value must be a well-formed https URL.
check(
  "every set officialDocUrl is https",
  READINESS_ITEM_KEYS.every((key) => {
    const url = READINESS_ITEM_BY_KEY[key]?.officialDocUrl;
    return url === undefined || url.startsWith("https://");
  }),
  true,
);

// A `recommendedEvents: true` flag with no translation would render the raw
// i18n key on screen — check every locale actually carries real, non-empty
// copy for it, not just the pt-BR source.
const LOCALES = ["pt-BR", "en", "es", "de", "fr"] as const;
const MESSAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packages/content/messages");
const readinessMessages = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8")).readiness as Record<string, string>,
  ]),
) as Record<(typeof LOCALES)[number], Record<string, string>>;

/** Every item where `flag` is true must carry real, non-empty `prefix-<key>` copy in every locale. */
function checkTipCoverage(flag: "recommendedEvents" | "recommendedParameters", prefix: string) {
  for (const key of READINESS_ITEM_KEYS.filter((k) => READINESS_ITEM_BY_KEY[k]?.[flag])) {
    for (const locale of LOCALES) {
      check(
        `${prefix}-${key} has real copy in ${locale}`,
        typeof readinessMessages[locale][`${prefix}-${key}`] === "string" &&
          readinessMessages[locale][`${prefix}-${key}`].trim().length > 0,
        true,
      );
    }
  }
}
checkTipCoverage("recommendedEvents", "item-events");
checkTipCoverage("recommendedParameters", "item-parameters");

/* ========================================================================== */
section("Per-dimension progress — celebration may only fire on proof");
/* ========================================================================== */

// Anti-fraud: a provable item the user TICKS but the scan disproves earns no
// progress, while a declared item the scanner can never see is trusted when
// ticked. The whole point of the "verified" progress is that it cannot be
// inflated by clicking.
const antifraud = evaluateReadiness(p({ pixelInstalled: true, capiInstalled: true, conversionEventTested: true }), {
  hasLandingPage: true,
  hasPrice: true,
  signals: signalsWith({ tracking: { metaPixel: false, ga4: false, gtm: false, tiktokPixel: false } }),
});
const mensuracao = antifraud.byGroup.find((g) => g.key === "mensuracao")!;
check("ticked-but-disproved pixel earns 0 verified", mensuracao.verified, 0);
check("declared items still count as achieved when ticked", mensuracao.achieved, 2); // capi + event
check("confirmed still counts every tick (unchanged meaning)", mensuracao.confirmed, 3);

// Proof counts even when the user never ticked the box — the scanner is the
// source of truth for provable items.
const provenOnly = evaluateReadiness(p(), {
  hasLandingPage: true,
  hasPrice: true,
  signals: signalsWith(), // metaPixel + ga4 present by default
});
const provenMensuracao = provenOnly.byGroup.find((g) => g.key === "mensuracao")!;
check("scanner proof alone raises verified", provenMensuracao.verified, 2); // pixel + analytics
check("proven items are achieved even unticked", provenMensuracao.achieved, 2);
check("proof does not fake a tick", provenMensuracao.confirmed, 0);

// Invariants every ring depends on: verified ⊆ achieved ⊆ applicable ⊆ total.
for (const g of provenOnly.byGroup) {
  check(`${g.key}: verified <= achieved`, g.verified <= g.achieved, true);
  check(`${g.key}: achieved <= applicable`, g.achieved <= g.applicable, true);
  check(`${g.key}: applicable <= total`, g.applicable <= g.total, true);
}
// A platform seller's inapplicable items shrink the denominator, never shame him.
const platformProgress = evaluateReadiness(p({ checkoutType: "platform" }), { hasLandingPage: false });
for (const g of platformProgress.byGroup) {
  check(`${g.key}: applicable excludes NA`, g.applicable <= g.total, true);
}

/* ========================================================================== */
section("Applicability — only what this business can actually do");
/* ========================================================================== */

const ctx = { hasLandingPage: false };
check(
  "platform seller: checkout details do not apply",
  notApplicableReason("checkoutShort", p({ checkoutType: "platform" }), ctx),
  "platform-owns-checkout",
);
check(
  "platform seller without own page: CAPI has no server",
  notApplicableReason("capiInstalled", p({ checkoutType: "platform" }), ctx),
  "no-own-server",
);
// The distinction that keeps the product honest.
check(
  "missing URL alone never makes an item inapplicable",
  notApplicableReason("sitemapRobots", p({ checkoutType: "own" }), { hasLandingPage: false }),
  null,
);
// Activation items belong to a trial that a direct-response seller does not
// have, so they are the ONLY thing inapplicable to an own-checkout profile.
const ACTIVATION = ["signupFrictionLow", "activationDefined", "trialToPaidTracked", "upgradePathClear"];
const structural = READINESS_ITEM_KEYS.filter((key) => !ACTIVATION.includes(key));
check(
  "own checkout: nothing structural is inapplicable",
  structural.every((key) => notApplicableReason(key, p({ checkoutType: "own" }), ctx) === null),
  true,
);
check(
  "undeclared checkout: nothing structural is inapplicable",
  structural.every((key) => notApplicableReason(key, p(), ctx) === null),
  true,
);

/* --- Funnel model: audit the surface this business actually has (0034) --- */

check(
  "no trial declared: activation items do not apply",
  ACTIVATION.every((key) => notApplicableReason(key as never, p({ checkoutType: "own" }), ctx) === "no-trial"),
  true,
);
check(
  "trial-first: activation items DO apply",
  ACTIVATION.every((key) => notApplicableReason(key as never, p({ funnelModel: "trial_first" }), ctx) === null),
  true,
);
// The failure that motivated 0034: a trial-first checkout sits behind the login,
// so the public-page checkout items must not be audited against it as if it
// were reachable — but they are still the user's to answer, not hidden.
check(
  "trial-first keeps checkout items applicable (they describe the post-login flow)",
  notApplicableReason("checkoutShort", p({ funnelModel: "trial_first" }), ctx),
  null,
);
check(
  "lead-first: a human closes, so there is no self-service checkout to audit",
  ["checkoutShort", "abandonedRecovery", "paymentPix", "paymentCard"].every(
    (key) => notApplicableReason(key as never, p({ funnelModel: "lead_first" }), ctx) === "sales-closes-deal",
  ),
  true,
);
check(
  "lead-first: no payment method is NOT a blocker (money is not taken online)",
  evaluateReadiness(p({ funnelModel: "lead_first" }), { hasLandingPage: true, hasPrice: true }).blockers.includes(
    "no-payment",
  ),
  false,
);
check(
  "trial-first blind to trial→paid is a blocker (the ad optimizes signups)",
  evaluateReadiness(p({ funnelModel: "trial_first" }), { hasLandingPage: true, hasPrice: true }).blockers.includes(
    "trial-conversion-unmeasured",
  ),
  true,
);
check(
  "trial-first measuring trial→paid clears that blocker",
  evaluateReadiness(p({ funnelModel: "trial_first", trialToPaidTracked: true }), {
    hasLandingPage: true,
    hasPrice: true,
  }).blockers.includes("trial-conversion-unmeasured"),
  false,
);
check(
  "direct funnel never carries the trial blocker",
  evaluateReadiness(p({ funnelModel: "direct" }), { hasLandingPage: true, hasPrice: true }).blockers.includes(
    "trial-conversion-unmeasured",
  ),
  false,
);
check(
  "declaring a model alone is not an untouched intake",
  evaluateReadiness(p({ funnelModel: "trial_first" }), { hasLandingPage: true, hasPrice: true }).untouched,
  false,
);

/* --- The brief must TELL the engine the consequences, not hope it infers --- */

const trialBrief = readinessFunnelModelBlock(p({ funnelModel: "trial_first" }));
check("trial-first brief states the checkout is behind the login", trialBrief.includes("ATRÁS DO LOGIN"), true);
check("trial-first brief states the ad optimizes the signup", trialBrief.includes("CADASTRO"), true);
// The retention dimension is where the engine most easily gives advice that is
// already done: the trial signup form IS an email capture.
check(
  "trial-first brief forbids 'add an email capture form' advice",
  trialBrief.includes("JÁ É uma captura de contato"),
  true,
);
check("trial-first brief redirects email to the trial sequence", trialBrief.includes("régua do TRIAL"), true);
check("trial-first brief segments remarketing by trial state", trialBrief.includes("ESTADO DO TRIAL"), true);
check(
  "trial-first brief exposes the new item keys for related_items",
  trialBrief.includes("trialToPaidTracked"),
  true,
);
check(
  "undeclared model refuses to assume direct sale",
  readinessFunnelModelBlock(p()).includes("NÃO INFORMOU"),
  true,
);
// Silence about the checkout must be framed as expected, even with no scan.
check(
  "no scan + trial-first still states the auth-wall limit",
  readinessScanBlock(null, "trial_first").includes("INALCANÇÁVEL"),
  true,
);
check("no scan + direct funnel adds no auth-wall note", readinessScanBlock(null, "direct").includes("INALCANÇÁVEL"), false);
check(
  "platform seller WITH own page keeps the site items",
  notApplicableReason("sitemapRobots", p({ checkoutType: "platform" }), { hasLandingPage: true }),
  null,
);

// GUARDRAIL: relevance changes what we ASK, never the economic truth.
const platformSeller = p({ checkoutType: "platform" });
check(
  "blockers are identical for a platform seller",
  evaluateReadiness(platformSeller, { hasLandingPage: false, hasPrice: false }).blockers,
  ["no-page", "no-measurement", "no-payment", "no-price"],
);
const evalPlatform = evaluateReadiness(platformSeller, { hasLandingPage: false, hasPrice: false });
check("total stays 25 regardless of applicability", evalPlatform.total, 25);
check("applicableTotal excludes what does not apply", evalPlatform.applicableTotal, 25 - evalPlatform.notApplicable.length);
check("applicableTotal never exceeds total", evalPlatform.applicableTotal <= evalPlatform.total, true);

/* ========================================================================== */
section("Auto-confirm from the page read — one way only");
/* ========================================================================== */

// What the read proves is settled without asking.
{
  const after = autoConfirmProven(p(), signalsWith());
  check("a proved pixel is confirmed without being asked", after.pixelInstalled, true);
  check("a proved analytics is confirmed", after.analyticsInstalled, true);
}

// THE guard: absence is never disproof, so it can only ever turn things ON.
{
  const claimed = p({ pixelInstalled: true, seoBasics: true });
  const after = autoConfirmProven(claimed, signalsWith({ tracking: { metaPixel: false, ga4: false, gtm: false } }));
  check("a missing pixel never un-confirms the user", after.pixelInstalled, true);
  check("nothing else is turned off either", after.seoBasics, true);
}

// Items no page read can settle are left alone, to be asked.
{
  const after = autoConfirmProven(p(), signalsWith());
  check("declared-tier items are untouched", after.capiInstalled, false);
  check("weak-tier items are untouched", after.pageMobileTested, false);
  check("checkout items are untouched", after.paymentPix, false);
}

// A JS-rendered page proves nothing — do not confirm from it.
check(
  "a client-rendered page confirms nothing",
  autoConfirmProven(p(), signalsWith({ jsRenderedLikely: true })).pixelInstalled,
  false,
);
check("no scan at all confirms nothing", autoConfirmProven(p(), null).pixelInstalled, false);

// Identity when there is nothing to add, so callers can skip a needless write.
{
  const already = p({
    pixelInstalled: true,
    analyticsInstalled: true,
    seoBasics: true,
    indexable: true,
    sitemapRobots: true,
    structuredData: true,
  });
  check("returns the same object when nothing changes", autoConfirmProven(already, signalsWith()) === already, true);
}

/* ========================================================================== */
section("Finding resolution — a tick is not proof");

const noEvidence = { verified: [] as ReadinessItemKey[], contradicted: [] as ReadinessItemKey[] };

// Nothing ticked, or nothing tickable (oferta/midia) → still open.
check("unticked finding is open", findingResolution(["pixelInstalled"], p(), noEvidence), "open");
check("finding with no checklist items is open", findingResolution([], p(), noEvidence), "open");
check(
  "partially ticked finding is open",
  findingResolution(["pixelInstalled", "analyticsInstalled"], p({ pixelInstalled: true }), noEvidence),
  "open",
);

// THE bug: ticked + provable + unproved must NOT read as done.
check(
  "ticked but unproved is awaiting-proof, never verified",
  findingResolution(["pixelInstalled"], p({ pixelInstalled: true }), noEvidence),
  "awaiting-proof",
);
check("awaiting-proof stays pending", isFindingPending("awaiting-proof"), true);

// Ticked + the scan proved it → genuinely done.
check(
  "ticked and proved is verified",
  findingResolution(["pixelInstalled"], p({ pixelInstalled: true }), { verified: ["pixelInstalled"], contradicted: [] }),
  "verified",
);
check("verified is not pending", isFindingPending("verified"), false);

// Nothing here is machine-provable (CAPI/PIX) → the user's word is final.
check(
  "declared-only items count as done",
  findingResolution(["capiInstalled", "paymentPix"], p({ capiInstalled: true, paymentPix: true }), noEvidence),
  "declared",
);
check("declared is not pending", isFindingPending("declared"), false);

// A mixed finding is only verified once its provable half is proved.
check(
  "mixed finding needs its provable half proved",
  findingResolution(["pixelInstalled", "capiInstalled"], p({ pixelInstalled: true, capiInstalled: true }), noEvidence),
  "awaiting-proof",
);
check(
  "mixed finding verified when the provable half is proved",
  findingResolution(["pixelInstalled", "capiInstalled"], p({ pixelInstalled: true, capiInstalled: true }), {
    verified: ["pixelInstalled"],
    contradicted: [],
  }),
  "verified",
);

// No page to read = no way to ever prove it. "Falta verificar" there would be a
// life sentence, so we take the user's word instead — same rule as `observeItem`
// returning null. (Found by walking a product with no landing page: the state
// showed as unconfirmed with no button and no path out.)
check(
  "unverifiable-by-circumstance falls back to declared, not a dead end",
  findingResolution(["pixelInstalled"], p({ pixelInstalled: true }), { ...noEvidence, canVerify: false }),
  "declared",
);
check(
  "with a page to read it stays awaiting-proof",
  findingResolution(["pixelInstalled"], p({ pixelInstalled: true }), { ...noEvidence, canVerify: true }),
  "awaiting-proof",
);
// A contradiction still wins even when we "cannot verify" — it is already proof.
check(
  "canVerify:false never buries an existing contradiction",
  findingResolution(["pixelInstalled"], p({ pixelInstalled: true }), {
    verified: [],
    contradicted: ["pixelInstalled"],
    canVerify: false,
  }),
  "contradicted",
);

// Contradiction outranks everything — even a fully ticked finding.
check(
  "contradicted beats ticked",
  findingResolution(["pixelInstalled"], p({ pixelInstalled: true }), {
    verified: [],
    contradicted: ["pixelInstalled"],
  }),
  "contradicted",
);
check("contradicted stays pending", isFindingPending("contradicted"), true);
check("open stays pending", isFindingPending("open"), true);

/* ========================================================================== */
section("Concierge offer — earned by resistance, never always-on");
/* ========================================================================== */

const sig = (over: Partial<AssistSignals> = {}): AssistSignals => ({
  contradicted: false,
  skipped: false,
  openedHelp: false,
  scanAttempts: 0,
  resolved: false,
  notApplicable: false,
  ...over,
});

// The default must be SILENCE. A fresh user who has done nothing yet is not
// struggling, and offering paid help there turns the tool into an upsell funnel.
check("no offer with no signals at all", assistReason("pixelInstalled", sig()), null);
check("no offer merely because an item is unconfirmed", assistReason("capiInstalled", sig()), null);
check("opening the explanation alone is not resistance", assistReason("pixelInstalled", sig({ openedHelp: true })), null);
check(
  "one scan with no other signal is not resistance",
  assistReason("pixelInstalled", sig({ scanAttempts: 1 })),
  null,
);

// Real resistance: claimed it, the page disproved it, and they scanned again.
check(
  "disproved claim after a retry earns the offer",
  assistReason("pixelInstalled", sig({ contradicted: true, scanAttempts: 2 })),
  "contradicted-after-retry",
);
check(
  "a disproved claim on the FIRST scan is not yet resistance",
  assistReason("pixelInstalled", sig({ contradicted: true, scanAttempts: 1 })),
  null,
);
// They read what it is and skipped anyway — they know they cannot do it.
check(
  "skipping a specialist item earns the offer",
  assistReason("pixelInstalled", sig({ skipped: true, openedHelp: true })),
  "skipped-specialist",
);
// Taught, scanned, still not proved: the teaching did not get them there.
check(
  "taught + scanned + still unproved earns the offer",
  assistReason("pixelInstalled", sig({ openedHelp: true, scanAttempts: 1 })),
  "stuck-on-specialist",
);

// NEVER sell what they can do themselves — that would be predatory.
for (const key of ["pageHasProof", "paymentPix", "organicContent", "emailFollowup"] as const) {
  check(`no offer for a DIY item: ${key}`, assistReason(key, sig({ skipped: true, openedHelp: true })), null);
}
// NEVER sell what is already done, or what was never theirs to do.
check(
  "no offer once the item is proved",
  assistReason("pixelInstalled", sig({ contradicted: true, scanAttempts: 5, resolved: true })),
  null,
);
check(
  "no offer for an item that does not apply",
  assistReason("capiInstalled", sig({ skipped: true, openedHelp: true, notApplicable: true })),
  null,
);

/* ========================================================================== */
section("SSRF address guard");
/* ========================================================================== */

// Every entry here is a real SSRF target. A regression makes the scanner a
// proxy into our own network.
for (const ip of [
  "127.0.0.1",
  "127.1.2.3",
  "0.0.0.0",
  "10.0.0.1",
  "10.255.255.255",
  "172.16.0.1",
  "172.31.255.255",
  "192.168.1.1",
  "169.254.169.254", // AWS/GCP instance metadata — the classic target
  "100.64.0.1", // CGNAT
  "198.18.0.1", // benchmarking
  "224.0.0.1", // multicast
  "255.255.255.255",
  "::1",
  "::",
  "fc00::1",
  "fd12:3456::1",
  "fe80::1",
  "::ffff:127.0.0.1", // IPv4-mapped loopback
  "::ffff:169.254.169.254",
  "[::1]",
  "",
  "not-an-ip",
]) {
  check(`blocks ${ip || "(empty)"}`, isBlockedAddress(ip), true);
}

// Ordinary public addresses must still work — an over-broad guard breaks the
// feature for everyone (note 172.15/172.32 straddle the private /12 boundary).
for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "192.167.1.1", "11.0.0.1", "2606:4700::1111"]) {
  check(`allows ${ip}`, isBlockedAddress(ip), false);
}

/* ========================================================================== */
section("HTML analyzer");
/* ========================================================================== */

const base = {
  finalUrl: "https://example.com/",
  bytes: 1000,
  fetchMs: 120,
  robotsTxt: { status: "found" as const, body: "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml" },
  sitemapXml: "found" as const,
};

const page = analyzeScan({
  ...base,
  html: `<!doctype html><html lang="pt-BR"><head>
    <title>  Curso de Tráfego   Pago  </title>
    <meta content="Aprenda a vender com anúncios" name="description">
    <meta name="viewport" content="width=device-width">
    <link rel="canonical" href="https://example.com/">
    <meta property="og:title" content="Curso"><meta property="og:image" content="/og.png">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Curso"}</script>
    <script>fbq('init','123');</script>
    <script src="https://www.googletagmanager.com/gtag/js?id=G-X"></script><script>gtag('config','G-X')</script>
  </head><body>
    <h1>Venda mais com tráfego pago</h1>
    <img src="a.png" alt="ok"><img src="b.png">
    <p>${"conteúdo real ".repeat(40)}</p>
    <svg><title>ícone</title></svg>
  </body></html>`,
});

check("title trimmed and collapsed", page.seo.title, "Curso de Tráfego Pago");
check("an <svg><title> never wins", page.seo.title?.includes("ícone"), false);
check("meta description with reversed attribute order", page.seo.metaDescription, "Aprenda a vender com anúncios");
check("description length", page.seo.metaDescriptionLength, "Aprenda a vender com anúncios".length);
check("canonical", page.seo.canonical, "https://example.com/");
check("lang", page.seo.lang, "pt-BR");
check("viewport", page.seo.hasViewport, true);
check("h1 count", page.seo.h1Count, 1);
check("first h1 text", page.seo.firstH1, "Venda mais com tráfego pago");
check("og flags", [page.seo.ogTitle, page.seo.ogImage, page.seo.ogDescription], [true, true, false]);
check("JSON-LD @type", page.seo.structuredDataTypes, ["Product"]);
check("not noindex", page.seo.noindex, false);
check("images and missing alt", [page.seo.imagesTotal, page.seo.imagesMissingAlt], [2, 1]);
check("Meta Pixel detected", page.tracking.metaPixel, true);
check("GA4 detected", page.tracking.ga4, true);
check("GTM not falsely detected", page.tracking.gtm, false);
check("https", page.https, true);
check("server-rendered copy is not flagged as JS-rendered", page.jsRenderedLikely, false);
check("sitemap referenced in robots.txt", page.discovery.sitemapReferencedInRobots, true);
check("robots does not disallow all", page.discovery.robotsDisallowsAll, false);

// The catastrophic-but-invisible combination: noindex + robots blocking all.
const blockedPage = analyzeScan({
  ...base,
  robotsTxt: { status: "found", body: "User-agent: *\nDisallow: /" },
  sitemapXml: "missing",
  html: `<html><head><meta name="robots" content="NOINDEX, nofollow"></head><body>${"texto ".repeat(80)}</body></html>`,
});
check("noindex detected case-insensitively", blockedPage.seo.noindex, true);
check("robots disallows all", blockedPage.discovery.robotsDisallowsAll, true);
check("sitemap missing", blockedPage.discovery.sitemapXml, "missing");
check("absent title is null", blockedPage.seo.title, null);

// A client-rendered page must be FLAGGED, never reported as confidently empty.
const spa = analyzeScan({
  ...base,
  html: `<html><head><title>App</title></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`,
});
check("JS-rendered page flagged", spa.jsRenderedLikely, true);

// A short page with NO script cannot be client-rendered. Flagging it would
// silently disable verification for every legitimately minimal landing page.
check(
  "short page WITHOUT scripts is not treated as JS-rendered",
  analyzeScan({
    ...base,
    html: `<html><head><title>Loja</title></head><body><h1>Quadros</h1><p>Fale no WhatsApp.</p></body></html>`,
  }).jsRenderedLikely,
  false,
);

check(
  "malformed JSON-LD surfaced, not crashed",
  analyzeScan({
    ...base,
    html: `<html><head><script type="application/ld+json">{ nope }</script></head><body>${"x ".repeat(200)}</body></html>`,
  }).seo.structuredDataTypes,
  ["(inválido)"],
);
check(
  "@graph nesting collected (how most CMSs emit it)",
  analyzeScan({
    ...base,
    html: `<html><head><script type="application/ld+json">{"@graph":[{"@type":"Organization"},{"@type":["WebSite","Thing"]}]}</script></head><body>${"x ".repeat(200)}</body></html>`,
  }).seo.structuredDataTypes,
  ["Organization", "WebSite", "Thing"],
);

/* ========================================================================== */

console.log(
  failures === 0 ? `\nALL PASS — ${passes} assertions.` : `\n${failures} FAILURE(S) out of ${passes + failures}.`,
);
process.exit(failures === 0 ? 0 : 1);
