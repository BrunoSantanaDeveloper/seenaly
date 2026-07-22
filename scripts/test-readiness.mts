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
import process from "node:process";

import {
  EMPTY_READINESS_PROFILE,
  evaluateReadiness,
  itemsForDimension,
  READINESS_ITEM_KEYS,
  type ReadinessProfile,
  resolvableItems,
  sanitizeRelatedItems,
  toReadinessProfile,
  toReadinessRow,
} from "../apps/web/src/lib/readiness/checklist";
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
