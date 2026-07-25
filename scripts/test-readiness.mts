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
  evaluateReadiness,
  itemsForDimension,
  notApplicableReason,
  READINESS_ITEM_BY_KEY,
  READINESS_ITEM_KEYS,
  type ReadinessProfile,
  resolvableItems,
  sanitizeRelatedItems,
  toReadinessProfile,
  toReadinessRow,
  verifyAgainstScan,
  verifyItem,
} from "../apps/web/src/lib/readiness/checklist";
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

check("21 checklist items", READINESS_ITEM_KEYS.length, 21);

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
  "group totals equal 21",
  ev.byGroup.reduce((s, g) => s + g.total, 0),
  21,
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
  "all 21 items declare verification + difficulty",
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
check(
  "own checkout: nothing is inapplicable",
  READINESS_ITEM_KEYS.every((key) => notApplicableReason(key, p({ checkoutType: "own" }), ctx) === null),
  true,
);
check(
  "undeclared checkout: nothing is inapplicable",
  READINESS_ITEM_KEYS.every((key) => notApplicableReason(key, p(), ctx) === null),
  true,
);
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
check("total stays 21 regardless of applicability", evalPlatform.total, 21);
check("applicableTotal excludes what does not apply", evalPlatform.applicableTotal, 21 - evalPlatform.notApplicable.length);
check("applicableTotal never exceeds total", evalPlatform.applicableTotal <= evalPlatform.total, true);

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
