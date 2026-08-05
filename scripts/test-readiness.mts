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
  groupForItem,
  isFindingPending,
  itemsForDimension,
  mapRegisteredExperiments,
  notApplicableReason,
  READINESS_GROUPS,
  READINESS_ITEM_BY_KEY,
  READINESS_ITEM_KEYS,
  type ReadinessItemKey,
  type ReadinessProfile,
  resolvableItems,
  sanitizeRelatedItems,
  scanProvedCount,
  toReadinessProfile,
  toReadinessRow,
  groupsForModel,
  READINESS_STAGES,
  stagesForModel,
  type FunnelModel,
  unprovableItems,
  verifyAgainstScan,
  verifyItem,
} from "../apps/web/src/lib/readiness/checklist";
import {
  readinessChecklistBlock,
  readinessCreativesBlock,
  readinessFunnelModelBlock,
  readinessRetrievalPlan,
  weightRetrievalPlan,
  readinessScanBlock,
} from "../apps/web/src/lib/readiness/brief";
import { compareVerdicts, worstStatusByDimension } from "../apps/web/src/lib/readiness/compare";
import {
  citedExcerptIndexes,
  isReadinessOutput,
  readinessJsonSchema,
  readinessNextReviewDays,
} from "../apps/web/src/lib/readiness/schema";
import { selectDueReviewTargets } from "../apps/web/src/lib/diagnosis/review-select";
import { experimentsBlock } from "../apps/web/src/lib/experiments/brief";
import { type AssistSignals, assistReason, sanitizeJourneySignals } from "../apps/web/src/lib/readiness/assist";
import { READINESS_ERROR_CODES } from "../apps/web/src/lib/readiness/errors";
import { normalizeStoredHowTo } from "../apps/web/src/lib/readiness/howto";
import { classifyPageFast, extractPsiSnapshot } from "../apps/web/src/lib/readiness/pagespeed-analyze";
import { analyzeScan } from "../apps/web/src/lib/readiness/scan-analyze";
import { isBlockedAddress, scanCooldownRemainingSeconds } from "../apps/web/src/lib/readiness/scan";

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

// 20 structural items + the 4 trial-first activation items (migration 0034).
// 24, not 25: `remarketingAudience` saiu na 0041 — um público de remarketing
// só existe depois de tráfego acumulado, então pedi-lo numa auditoria feita
// ANTES do primeiro gasto era pedir o impossível.
check("24 checklist items", READINESS_ITEM_KEYS.length, 24);
check(
  "remarketing audience is not a readiness item (0041)",
  (READINESS_ITEM_KEYS as readonly string[]).includes("remarketingAudience"),
  false,
);

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
  "group totals equal 24",
  ev.byGroup.reduce((s, g) => s + g.total, 0),
  24,
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
section('Finding → checklist mapping ("I already fixed this")');
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
for (const dimension of ["mensuracao", "pagina", "checkout", "ativacao", "descoberta", "funil"]) {
  const items = itemsForDimension(dimension);
  check(
    `${dimension} maps to real checklist keys`,
    items.length > 0 && items.every((key) => (READINESS_ITEM_KEYS as string[]).includes(key)),
    true,
  );
}

// S1: the trial-first activation dimension resolves via the group fallback —
// trial→paid findings no longer depend on the model emitting related_items.
check("ativacao maps to the four activation items", itemsForDimension("ativacao"), [
  "signupFrictionLow",
  "activationDefined",
  "trialToPaidTracked",
  "upgradePathClear",
]);
check("ativacao explicit related_items still win", resolvableItems("ativacao", ["trialToPaidTracked"]), [
  "trialToPaidTracked",
]);
// The brief only ever invites the dimension where it exists.
check(
  "trial-first brief names the ativacao dimension",
  readinessFunnelModelBlock(p({ funnelModel: "trial_first" })).includes("dimensão `ativacao`"),
  true,
);
check(
  "direct brief never mentions ativacao",
  readinessFunnelModelBlock(p({ funnelModel: "direct" })).includes("ativacao"),
  false,
);
check(
  "lead-first brief never mentions ativacao",
  readinessFunnelModelBlock(p({ funnelModel: "lead_first" })).includes("ativacao"),
  false,
);

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
check(
  "unclaimed + absent => unverifiable",
  verifyItem("pixelInstalled", false, signalsWith({ tracking: { metaPixel: false } })),
  "unverifiable",
);

// Tier discipline: things we cannot see are never refused.
for (const key of ["capiInstalled", "conversionEventTested", "paymentPix", "checkoutShort"] as const) {
  check(
    `declared item never refused: ${key}`,
    verifyItem(key, true, signalsWith({ tracking: { metaPixel: false } })),
    "unverifiable",
  );
}
// Weak hints must not refuse either — rejecting on a guess is worse than trusting.
// (pageFast left this list in V3: it is proved-tier now, via the official
// PageSpeed channel — tested in its own section below.)
for (const key of ["pageMobileTested", "hasGuarantee", "socialProfiles", "emailCapture"] as const) {
  check(
    `weak item never refused: ${key}`,
    verifyItem(key, true, signalsWith({ seo: { hasViewport: false } })),
    "unverifiable",
  );
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
  verifyAgainstScan(
    p({ pixelInstalled: true, capiInstalled: true }),
    signalsWith({ tracking: { metaPixel: false, ga4: false } }),
  ),
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
section("Item keys have ONE source of truth (0042)");

// The engine used to learn the valid key names from a list hardcoded in the
// prompt. Migration 0034 added four keys and never touched it, so the briefing
// demanded keys the prompt forbade. Now the names travel with the data and the
// schema enforces them — these two assertions are what keep it that way.
for (const model of [null, "trial_first"] as const) {
  const keys = groupsForModel(model).flatMap((g) => g.items.map((i) => i.key));
  const block = readinessChecklistBlock(p({ funnelModel: model }), undefined);
  for (const key of keys) {
    // Tagged with the field it feeds, not glued to the label — see 0043: in
    // backticks it read as prose and leaked into user-facing evidence.
    check(
      `checklist block names ${key} as related_items input (model: ${model ?? "undeclared"})`,
      block.includes(`[related_items: ${key}]`),
      true,
    );
  }
  const schemaKeys = (
    (
      (readinessJsonSchema(model).properties as Record<string, { items?: Record<string, unknown> }>).findings
        ?.items as Record<string, Record<string, Record<string, { items?: { enum?: string[] } }>>>
    ).properties.related_items.items as { enum?: string[] }
  ).enum;
  check(`schema enum equals the applicable keys (model: ${model ?? "undeclared"})`, schemaKeys, keys);
}
// The scoping is the part a global list could not give: a direct sale is never
// even offered a key about a trial it does not run.
check(
  "a direct sale is not offered activation keys",
  groupsForModel(null)
    .flatMap((g) => g.items.map((i) => i.key))
    .includes("trialToPaidTracked"),
  false,
);

/* ========================================================================== */
section("Locating the fix — stage + where (0043)");

// A verdict that cannot say WHERE is not actionable. The real failure: a
// trial-first SaaS was told to "add a guarantee and show it on the landing
// page" while the landing page already said "14 dias grátis, sem cartão" — the
// gap was on the PRICING page. Schema-required fields are what force a commit.
const findingProps = (model: FunnelModel | null) =>
  (
    (readinessJsonSchema(model).properties as Record<string, { items?: Record<string, unknown> }>).findings
      ?.items as Record<string, unknown>
  );
for (const model of [null, "direct", "trial_first", "lead_first"] as const) {
  const props = findingProps(model);
  const required = props.required as string[];
  check(`stage and where are required (model: ${model ?? "undeclared"})`, ["stage", "where"].every((k) => required.includes(k)), true);
  const stageEnum = ((props.properties as Record<string, { enum?: readonly string[] }>).stage.enum ?? []) as readonly string[];
  check(`stage enum equals the model's journey (model: ${model ?? "undeclared"})`, stageEnum, stagesForModel(model));
}
// The stage vocabulary must follow the funnel model, or it cannot catch the
// "loss aversion at the free signup" error that motivated it.
check("only trial-first has an upgrade stage", stagesForModel("trial_first").includes("upgrade"), true);
check("a direct sale has no upgrade stage", stagesForModel("direct").includes("upgrade"), false);
check("a direct sale has no signup stage", stagesForModel("direct").includes("cadastro"), false);
check("lead-first closes with a human, not a checkout", stagesForModel("lead_first").includes("checkout"), false);
check("lead-first has the sales conversation", stagesForModel("lead_first").includes("atendimento"), true);
// Every stage any model can emit must have copy in every locale, or the chip
// renders a raw key at the user.
for (const stage of READINESS_STAGES) {
  for (const locale of LOCALES) {
    check(
      `stage-${stage} has real copy in ${locale}`,
      typeof readinessMessages[locale][`stage-${stage}`] === "string" &&
        readinessMessages[locale][`stage-${stage}`].trim().length > 0,
      true,
    );
  }
}
// The two fields must ask DIFFERENT questions, and the descriptions are what
// carry that. The first cut of `stage` opened with "em que etapa a correção
// ACONTECE" and only then said "escolha pela etapa onde custa dinheiro" — two
// requests in one field. The model obeyed the first and tagged a finding about
// subscription risk as `pagina`, because a page is where the text goes. This
// guards the phrasing, not the model.
const stageDesc = (
  (findingProps("trial_first").properties as Record<string, { description?: string }>).stage.description ?? ""
).toLowerCase();
const whereDesc = (
  (findingProps("trial_first").properties as Record<string, { description?: string }>).where.description ?? ""
).toLowerCase();
check("stage is defined by WHEN money moves, not where the fix is written", stageDesc.includes("quando"), true);
check("stage never says the fix 'acontece' somewhere", stageDesc.includes("a correção acontece"), false);
check("stage points at where for the screen question", stageDesc.includes("`where`"), true);
check("where forbids hedging between two screens", whereDesc.includes("hesitar"), true);
check("where routes the unknown screen to missing_data", whereDesc.includes("missing_data"), true);

// Stored verdicts predate both fields: they must keep validating and rendering.
check(
  "a verdict without stage/where still validates",
  isReadinessOutput({
    verdict: "quase",
    summary: "s",
    findings: [
      {
        dimension: "oferta",
        status: "atencao",
        finding: "f",
        evidence: [],
        technical_basis: [],
        recommended_action: "a",
        effort: "baixo",
        impact: "medio",
        success_criterion: "c",
      },
    ],
    blocking: [],
    confidence: "media",
    insufficient_data: false,
    missing_data: "",
  }),
  true,
);

// The checklist key is INPUT for related_items — it leaked into user-facing
// evidence once ("Garantia declarada na oferta `hasGuarantee`") because the
// briefing put it in backticks right after the label, where it read as part of
// the sentence. Tagged with its field, it reads as machine input.
const keyedBlock = readinessChecklistBlock(p({ funnelModel: "direct" }), undefined);
check("the key is tagged with the field it feeds", keyedBlock.includes("[related_items: pixelInstalled]"), true);
check("the key is no longer glued to the label in backticks", /Pixel da Meta[^\n]*`pixelInstalled`/.test(keyedBlock), false);

/* ========================================================================== */
section("Scope boundary — readiness audits structure, never media setup (0041)");

// The engine has the Meta docs in retrieval, so it reaches for platform
// mechanics on its own. These assertions pin the three places where the old
// spec invited it: the checklist item, the funnel group and the query that
// decides which knowledge gets retrieved in the first place.
check(
  "the funil group carries only what the business owns",
  READINESS_GROUPS.find((g) => g.key === "funil")!.items.map((i) => i.key),
  ["emailCapture", "emailFollowup"],
);
// Every question in the plan, not just one: decomposition multiplied the places
// where in-platform setup could sneak back into readiness retrieval.
for (const model of [null, "direct", "trial_first", "lead_first"] as const) {
  const plan = readinessRetrievalPlan(true, model);
  for (const forbidden of [
    "remarketing",
    "público personalizado",
    "lookalike",
    "semelhante",
    "estrutura de campanha",
    "lance",
  ]) {
    check(
      `retrieval plan (model: ${model ?? "undeclared"}) never reaches for "${forbidden}"`,
      plan.some((query) => new RegExp(forbidden, "i").test(query.text)),
      false,
    );
  }
}

section("Retrieval weighting — budget follows the gap, and shrinks only on proof");

{
  const basePlan = readinessRetrievalPlan(true, null);
  const budget = (plan: ReturnType<typeof readinessRetrievalPlan>, key: string) => {
    const query = plan.find((q) => q.key === key)!;
    return query.meta + query.playbook;
  };
  const evaluation = (over: Partial<Record<string, unknown>> = {}) =>
    ({
      confirmed: 0,
      total: 0,
      byGroup: [
        { key: "checkout", confirmed: 5, total: 5, applicable: 5, verified: 0, achieved: 5 },
        { key: "pagina", confirmed: 4, total: 4, applicable: 4, verified: 0, achieved: 1 },
        { key: "mensuracao", confirmed: 4, total: 4, applicable: 4, verified: 4, achieved: 4 },
      ],
      blockers: [],
      untouched: false,
      verified: [],
      contradicted: [],
      unprovable: [],
      notApplicable: [],
      ...over,
    }) as never;

  const weighted = weightRetrievalPlan(basePlan, evaluation());

  check("a settled dimension shrinks to a single citable rule", budget(weighted, "checkout"), 1);
  check("an unsettled dimension keeps its full budget", budget(weighted, "pagina"), budget(basePlan, "pagina"));
  // The most expensive thing to be wrong about is a pixel nobody proved.
  check(
    "measurement is never de-prioritised, even fully achieved",
    budget(weighted, "mensuracao_instalacao"),
    budget(basePlan, "mensuracao_instalacao"),
  );
  check(
    "measurement optimisation is never de-prioritised either",
    budget(weighted, "mensuracao_otimizacao"),
    budget(basePlan, "mensuracao_otimizacao"),
  );
  // No checklist group at all — nothing to weight against.
  check("oferta is untouched (no checklist group)", budget(weighted, "oferta"), budget(basePlan, "oferta"));
  check("midia is untouched (no checklist group)", budget(weighted, "midia"), budget(basePlan, "midia"));

  // THE ANTI-FRAUD RULE: ticking every box must not buy a smaller budget. Only
  // what the scan proved (achieved) may shrink it.
  const declaredOnly = weightRetrievalPlan(
    basePlan,
    evaluation({
      byGroup: [{ key: "checkout", confirmed: 5, total: 5, applicable: 5, verified: 0, achieved: 2 }],
    }),
  );
  check(
    "ticking boxes without proof does NOT shrink the budget",
    budget(declaredOnly, "checkout"),
    budget(basePlan, "checkout"),
  );

  // A contradiction needs MORE rule to cite, not less — the engine has to
  // sustain "your page says otherwise" in front of the user.
  const contradicted = weightRetrievalPlan(
    basePlan,
    evaluation({
      contradicted: ["paymentPix"],
      byGroup: [{ key: "checkout", confirmed: 5, total: 5, applicable: 5, verified: 0, achieved: 5 }],
    }),
  );
  check(
    "a contradicted dimension is promoted, not shrunk",
    budget(contradicted, "checkout") > budget(basePlan, "checkout"),
    true,
  );

  // Never zero: a settled dimension still needs one rule to say "keep it".
  check(
    "no dimension is ever left with zero evidence",
    weighted.every((query) => query.meta + query.playbook > 0),
    true,
  );
}

section("Citations — the chips must credit what was USED, not what was fetched");

{
  const verdictWith = (citations: string[]) =>
    ({
      verdict: "quase",
      summary: "",
      blocking: [],
      confidence: "media",
      insufficient_data: false,
      missing_data: "",
      findings: citations.map((citation) => ({
        dimension: "checkout",
        status: "atencao",
        finding: "",
        evidence: [],
        technical_basis: [{ rule: "", citation }],
        recommended_action: "",
        effort: "baixo",
        impact: "baixo",
        success_criterion: "",
      })),
    }) as never;

  check("plain [3]", [...citedExcerptIndexes(verdictWith(["[3]"]), 8)], [3]);
  check("several in one string", [...citedExcerptIndexes(verdictWith(["[1, 2]"]), 8)].sort(), [1, 2]);
  check("adjacent brackets", [...citedExcerptIndexes(verdictWith(["[1][4]"]), 8)].sort(), [1, 4]);
  check("prose around the number", [...citedExcerptIndexes(verdictWith(["conforme o trecho [5]"]), 8)], [5]);
  // A hallucinated index would credit a document that was never retrieved —
  // the exact failure this whole change exists to remove.
  check("index beyond what was retrieved is dropped", [...citedExcerptIndexes(verdictWith(["[9]"]), 8)], []);
  check("zero is not an index", [...citedExcerptIndexes(verdictWith(["[0]"]), 8)], []);
  check("no citation at all", [...citedExcerptIndexes(verdictWith([""]), 8)], []);
  check("empty findings", [...citedExcerptIndexes({ findings: [] } as never, 8)], []);
}

section("Retrieval plan — one focused question per audited dimension");

// The whole point of decomposing: a verdict dimension with no question of its
// own gets argued from whatever the other questions happened to retrieve.
{
  const plan = readinessRetrievalPlan(true, "trial_first");
  const keys = plan.map((query) => query.key).sort();
  check("plan covers every audited dimension (trial-first)", keys, [
    "ativacao",
    "checkout",
    "descoberta",
    "funil",
    "mensuracao_instalacao",
    "mensuracao_otimizacao",
    "midia",
    "oferta",
    "pagina",
  ]);
}

// Mirrors `groupsForModel`: knowledge about trial→paid must not ground the
// verdict of someone who sells directly.
for (const model of [null, "direct", "lead_first"] as const) {
  check(
    `activation question is absent outside trial-first (model: ${model ?? "undeclared"})`,
    readinessRetrievalPlan(true, model).some((query) => query.key === "ativacao"),
    false,
  );
}

// A question that claims no budget from either corpus retrieves nothing and is
// dead weight in the plan.
check(
  "every question claims evidence from at least one corpus",
  readinessRetrievalPlan(true, "trial_first").every((query) => query.meta + query.playbook > 0),
  true,
);

// Measurement is the only subject the Meta corpus owns outright; conversion
// structure belongs to the playbook. Pinning the routing keeps a future edit
// from silently handing checkout back to the 108-document trust-1 corpus.
{
  const byKey = new Map(readinessRetrievalPlan(true, "trial_first").map((query) => [query.key, query]));
  check("pixel installation is answered by Meta, not the playbook", byKey.get("mensuracao_instalacao")!.playbook, 0);
  check("checkout is answered by the playbook, not Meta", byKey.get("checkout")!.meta, 0);
  check("offer is answered by the playbook, not Meta", byKey.get("oferta")!.meta, 0);
}

// Without a page the page question has to ask what must EXIST, not how the
// existing one performs — the zero-data user is the one who needs it most.
check(
  "the page question changes when there is no page yet",
  readinessRetrievalPlan(false, null).find((query) => query.key === "pagina")!.text ===
    readinessRetrievalPlan(true, null).find((query) => query.key === "pagina")!.text,
  false,
);
// Copy for a removed item would resurrect it silently the day someone reads
// the catalog instead of the code.
for (const locale of LOCALES) {
  for (const prefix of ["item", "item-what", "item-hire"]) {
    check(
      `${prefix}-remarketingAudience is gone from ${locale}`,
      `${prefix}-remarketingAudience` in readinessMessages[locale],
      false,
    );
  }
}

/* ========================================================================== */
section("GTM laundering — a tag inside the container is invisible, not absent");
/* ========================================================================== */

// The most common legitimate setup: the Meta Pixel loaded through Google Tag
// Manager. A raw HTML read sees GTM but no fbq — refusing that tick would be
// the confident lie the verification layer exists to prevent.
check(
  "GTM-only page + claimed pixel => unverifiable, never contradicted",
  verifyItem("pixelInstalled", true, signalsWith({ tracking: { metaPixel: false, gtm: true } })),
  "unverifiable",
);
check(
  "fbq present => verified regardless of GTM",
  verifyItem("pixelInstalled", true, signalsWith({ tracking: { metaPixel: true, gtm: true } })),
  "verified",
);
check(
  "no GTM + no fbq + claimed => still contradicted",
  verifyItem("pixelInstalled", true, signalsWith({ tracking: { metaPixel: false, gtm: false } })),
  "contradicted",
);
check(
  "GTM-only page never lands in the refusal list",
  verifyAgainstScan(p({ pixelInstalled: true }), signalsWith({ tracking: { metaPixel: false, gtm: true } })),
  [],
);
check(
  "GTM-only never auto-confirms the pixel",
  autoConfirmProven(p(), signalsWith({ tracking: { metaPixel: false, gtm: true } })).pixelInstalled,
  false,
);
// Same rule for JSON-LD, which GTM can inject (a real, Google-processed practice).
check(
  "structuredData: none + GTM => unverifiable",
  verifyItem(
    "structuredData",
    true,
    signalsWith({ seo: { structuredDataTypes: [] }, tracking: { metaPixel: false, gtm: true } }),
  ),
  "unverifiable",
);
check(
  "structuredData: none + no GTM + claimed => contradicted",
  verifyItem("structuredData", true, signalsWith({ seo: { structuredDataTypes: [] } })),
  "contradicted",
);
// Immunity guard: GTM itself counts as analytics — presence, not laundering.
check(
  "analyticsInstalled: GTM-only page => verified",
  verifyItem("analyticsInstalled", true, signalsWith({ tracking: { metaPixel: false, ga4: false, gtm: true } })),
  "verified",
);
// The engine brief must carry the caveat exactly when it applies.
const gtmScan = {
  requestedUrl: "https://x.com",
  finalUrl: "https://x.com",
  ok: true,
  statusCode: 200,
  error: null,
  createdAt: "2026-07-29T12:00:00Z",
  signals: signalsWith({ tracking: { metaPixel: false, gtm: true } }),
};
check("brief carries the GTM caveat when gtm && !pixel", readinessScanBlock(gtmScan).includes("contêiner"), true);
check(
  "brief omits the GTM caveat when the pixel is seen",
  readinessScanBlock({ ...gtmScan, signals: signalsWith({ tracking: { metaPixel: true, gtm: true } }) }).includes(
    "contêiner",
  ),
  false,
);

/* ========================================================================== */
section("PageSpeed — official speed evidence for pageFast");
/* ========================================================================== */

// PSI v5 fixture with both field (CrUX) and lab (Lighthouse) data.
const psiFixture = {
  lighthouseResult: {
    categories: { performance: { score: 0.87 } },
    audits: {
      "largest-contentful-paint": { numericValue: 3100 },
      "cumulative-layout-shift": { numericValue: 0.02 },
      "total-blocking-time": { numericValue: 150 },
    },
  },
  loadingExperience: {
    overall_category: "FAST",
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2000 },
      CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 5 },
      INTERACTION_TO_NEXT_PAINT: { percentile: 180 },
    },
  },
};
{
  const snap = extractPsiSnapshot(psiFixture, "2026-07-29T12:00:00Z");
  check("extractor: score 0..100", snap?.performanceScore, 87);
  check("extractor: field LCP", snap?.field?.lcpMs, 2000);
  check("extractor: field CLS /100", snap?.field?.cls, 0.05);
  check("extractor: lab LCP fallback present", snap?.lab.lcpMs, 3100);
  check("extractor: overall", snap?.field?.overall, "FAST");
}
check("extractor: malformed json => null", extractPsiSnapshot({ nope: true }, "t"), null);
check("extractor: non-object => null", extractPsiSnapshot("x", "t"), null);

const psiOk = (lcpMs: number | null, useField = true) =>
  ({
    status: "ok",
    fetchedAt: "t",
    strategy: "mobile",
    performanceScore: 80,
    lab: { lcpMs: useField ? 9999 : lcpMs, cls: null, tbtMs: null },
    field: useField ? { lcpMs, cls: null, inpMs: null, overall: null } : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
check("classifier: field 2000 => fast", classifyPageFast(psiOk(2000)), true);
check("classifier: field 3200 => gray zone (null)", classifyPageFast(psiOk(3200)), null);
check("classifier: field 4500 => slow", classifyPageFast(psiOk(4500)), false);
check("classifier: lab fallback when no field", classifyPageFast(psiOk(2100, false)), true);
check("classifier: pending => null", classifyPageFast({ status: "pending" }), null);
check("classifier: failed => null", classifyPageFast({ status: "failed", error: "x" }), null);
check("classifier: absent => null", classifyPageFast(undefined), null);

// Tier flip: pageFast is proved via the PSI channel — official cut points only.
check(
  "claimed fast + officially slow => contradicted",
  verifyItem("pageFast", true, signalsWith({ psi: psiOk(4500) })),
  "contradicted",
);
check(
  "claimed fast + officially fast => verified",
  verifyItem("pageFast", true, signalsWith({ psi: psiOk(2000) })),
  "verified",
);
check(
  "claimed fast + gray zone => unverifiable",
  verifyItem("pageFast", true, signalsWith({ psi: psiOk(3200) })),
  "unverifiable",
);
check("claimed fast + no measurement => unverifiable", verifyItem("pageFast", true, signalsWith()), "unverifiable");
check("fast page auto-confirms pageFast", autoConfirmProven(p(), signalsWith({ psi: psiOk(2000) })).pageFast, true);
check(
  "unprovable excludes pageFast when a measurement exists",
  unprovableItems(signalsWith({ psi: psiOk(3200) })).includes("pageFast"),
  false, // gray zone stays awaiting-proof: improving + re-scanning is a real path
);
check("unprovable includes pageFast without a measurement", unprovableItems(signalsWith()).includes("pageFast"), true);
check(
  "unprovable includes pageFast on a failed measurement",
  unprovableItems(signalsWith({ psi: { status: "failed", error: "x" } })).includes("pageFast"),
  true,
);

// The brief: official line when measured; the "not CWV" caveat stays verbatim.
{
  const okScan = { ...gtmScan, signals: signalsWith({ psi: psiOk(2000) }) };
  const block = readinessScanBlock(okScan);
  check("brief carries the official PSI line", block.includes("Velocidade OFICIAL (PageSpeed"), true);
  check("brief keeps the fetch-time caveat", block.includes("NÃO é Core Web Vitals"), true);
  const noPsi = readinessScanBlock({ ...gtmScan, signals: signalsWith() });
  check("brief omits the PSI line without a measurement", noPsi.includes("Velocidade OFICIAL"), false);
  const failedPsi = readinessScanBlock({ ...gtmScan, signals: signalsWith({ psi: { status: "failed", error: "x" } }) });
  check("brief flags a failed measurement honestly", failedPsi.includes("FALHOU"), true);
}

// Locale coverage for the speed section keys.
for (const locale of LOCALES) {
  for (const key of [
    "scan-group-speed",
    "scan-fact-psi-score",
    "scan-fact-psi-lcp",
    "scan-fact-psi-cls",
    "scan-psi-pending",
    "scan-psi-refresh",
    "scan-psi-failed",
  ]) {
    check(`${key} has real copy in ${locale}`, (readinessMessages[locale][key] ?? "").trim().length > 0, true);
  }
}

/* ========================================================================== */
section("Scan cooldown — throttle, never a wall");
/* ========================================================================== */

const COOLDOWN_NOW = Date.parse("2026-07-29T12:00:00Z");
check("no previous scan => 0", scanCooldownRemainingSeconds(null, COOLDOWN_NOW), 0);
check(
  "30s ago with the 60s window => 30",
  scanCooldownRemainingSeconds(new Date(COOLDOWN_NOW - 30_000).toISOString(), COOLDOWN_NOW),
  30,
);
check("61s ago => 0", scanCooldownRemainingSeconds(new Date(COOLDOWN_NOW - 61_000).toISOString(), COOLDOWN_NOW), 0);
check(
  "exactly 60s ago => 0",
  scanCooldownRemainingSeconds(new Date(COOLDOWN_NOW - 60_000).toISOString(), COOLDOWN_NOW),
  0,
);
check("unparseable timestamp fails open => 0", scanCooldownRemainingSeconds("not-a-date", COOLDOWN_NOW), 0);
check(
  "future timestamp (clock skew) is bounded by the interval itself",
  scanCooldownRemainingSeconds(new Date(COOLDOWN_NOW + 3_600_000).toISOString(), COOLDOWN_NOW),
  60,
);

/* ========================================================================== */
section("HowTo cache normalization — one shape for every read path");
/* ========================================================================== */

check("null => empty, honest shape", normalizeStoredHowTo(null), {
  steps: [],
  references: [],
  needs_specialist: false,
  note: "",
});
check(
  "well-formed stored object round-trips",
  normalizeStoredHowTo({ steps: ["a", "b"], needs_specialist: true, note: "n" }),
  {
    steps: ["a", "b"],
    references: [],
    needs_specialist: true,
    note: "n",
  },
);
check(
  "non-string steps are filtered",
  normalizeStoredHowTo({ steps: ["a", 2, null, "b"], needs_specialist: false, note: "" }).steps,
  ["a", "b"],
);
check(
  "truthy-but-not-true needs_specialist => false",
  normalizeStoredHowTo({ steps: [], needs_specialist: 1, note: "" }).needs_specialist,
  false,
);

/* ========================================================================== */
section("Error-code contract — every code translated in every locale");
/* ========================================================================== */

check("codes are unique", new Set(READINESS_ERROR_CODES).size, READINESS_ERROR_CODES.length);
check(
  "codes are snake_case slugs",
  READINESS_ERROR_CODES.every((code) => /^[a-z][a-z_]+$/.test(code)),
  true,
);
for (const locale of LOCALES) {
  for (const code of READINESS_ERROR_CODES) {
    check(
      `error-${code} has real copy in ${locale}`,
      typeof readinessMessages[locale][`error-${code}`] === "string" &&
        readinessMessages[locale][`error-${code}`].trim().length > 0,
      true,
    );
  }
  check(
    `error-unknown has real copy in ${locale}`,
    typeof readinessMessages[locale]["error-unknown"] === "string" &&
      readinessMessages[locale]["error-unknown"].trim().length > 0,
    true,
  );
  check(
    `error-detail interpolates in ${locale}`,
    (readinessMessages[locale]["error-detail"] ?? "").includes("{detail}"),
    true,
  );
  check(
    `scan-gtm-pixel-note has real copy in ${locale}`,
    (readinessMessages[locale]["scan-gtm-pixel-note"] ?? "").trim().length > 0,
    true,
  );
  check(
    `scan-cooldown interpolates in ${locale}`,
    (readinessMessages[locale]["scan-cooldown"] ?? "").includes("{seconds}"),
    true,
  );
  check(
    `verify-in-progress has real copy in ${locale}`,
    (readinessMessages[locale]["verify-in-progress"] ?? "").trim().length > 0,
    true,
  );
  for (const key of ["product-not-found-title", "product-not-found-body", "product-not-found-cta"]) {
    check(`${key} has real copy in ${locale}`, (readinessMessages[locale][key] ?? "").trim().length > 0, true);
  }
}

/* ========================================================================== */
section("Re-audit cadence — the model proposes, the server guarantees");
/* ========================================================================== */

const baseVerdict = {
  verdict: "quase",
  summary: "s",
  findings: [
    {
      dimension: "mensuracao",
      status: "atencao",
      finding: "f",
      evidence: [{ statement: "e", source: "product_context" }],
      technical_basis: [],
      recommended_action: "a",
      effort: "baixo",
      impact: "alto",
      success_criterion: "c",
    },
  ],
  blocking: [],
  confidence: "media",
  insufficient_data: false,
  missing_data: "",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

check("nao_pronto fallback = 7", readinessNextReviewDays({ ...baseVerdict, verdict: "nao_pronto" }), 7);
check("quase fallback = 14", readinessNextReviewDays(baseVerdict), 14);
check("pronto fallback = 30", readinessNextReviewDays({ ...baseVerdict, verdict: "pronto" }), 30);
check("clamps 999 to 60", readinessNextReviewDays({ ...baseVerdict, next_review_days: 999 }), 60);
check("rounds 6.4 to 6", readinessNextReviewDays({ ...baseVerdict, next_review_days: 6.4 }), 6);
check("rejects 0 to fallback", readinessNextReviewDays({ ...baseVerdict, next_review_days: 0 }), 14);
check("rejects negative to fallback", readinessNextReviewDays({ ...baseVerdict, next_review_days: -3 }), 14);
check("rejects NaN to fallback", readinessNextReviewDays({ ...baseVerdict, next_review_days: Number.NaN }), 14);

// Backward compat: stored verdicts predate the review fields (and ativacao).
check("old verdict without review fields still validates", isReadinessOutput(baseVerdict), true);
check("string next_review_days fails validation", isReadinessOutput({ ...baseVerdict, next_review_days: "7" }), false);
check("numeric next_review fails validation", isReadinessOutput({ ...baseVerdict, next_review: 7 }), false);
check(
  "ativacao finding validates (S1)",
  isReadinessOutput({
    ...baseVerdict,
    findings: [{ ...baseVerdict.findings[0], dimension: "ativacao" }],
  }),
  true,
);
check(
  "invented dimension fails validation",
  isReadinessOutput({
    ...baseVerdict,
    findings: [{ ...baseVerdict.findings[0], dimension: "inventada" }],
  }),
  false,
);

// The cron selector: supersession only within the SAME product+scope.
{
  const readinessDue = {
    id: "r1",
    product_id: "p1",
    scope: "readiness",
    org_id: "o1",
    created_by: "u1",
    created_at: "2026-07-01",
  };
  const newerCampaign = { id: "c1", product_id: "p1", scope: "product", created_at: "2026-07-20" };
  check(
    "a newer campaign diagnosis does NOT suppress a due readiness reminder",
    selectDueReviewTargets([readinessDue], [newerCampaign, { ...readinessDue }]).map((r) => r.id),
    ["r1"],
  );
  check(
    "a newer same-scope verdict DOES supersede",
    selectDueReviewTargets(
      [readinessDue],
      [{ id: "r2", product_id: "p1", scope: "readiness", created_at: "2026-07-20" }, { ...readinessDue }],
    ),
    [],
  );
  const olderDue = { ...readinessDue, id: "r0", created_at: "2026-06-01" };
  check(
    "only the newest due row per product+scope is considered",
    selectDueReviewTargets([readinessDue, olderDue], [{ ...readinessDue }]).map((r) => r.id),
    ["r1"],
  );
}

/* ========================================================================== */
section("Experiment memory block — shared by both engines");
/* ========================================================================== */

check(
  "empty memory teaches instead of staying silent",
  experimentsBlock([]).startsWith("Nenhum experimento registrado"),
  true,
);
{
  const rows = [
    { title: "T-planned", status: "planned", hypothesis: null, result: null, conclusion: null, next_step: null },
    { title: "T-abandoned", status: "abandoned", hypothesis: null, result: null, conclusion: null, next_step: null },
    {
      title: "T-concluded",
      status: "concluded",
      hypothesis: "h",
      result: "r",
      conclusion: "aprendido",
      next_step: null,
    },
    { title: "T-running", status: "running", hypothesis: null, result: null, conclusion: null, next_step: null },
    { title: "T-weird", status: "weird", hypothesis: null, result: null, conclusion: null, next_step: null },
  ];
  const block = experimentsBlock(rows);
  const order = ["T-concluded", "T-running", "T-planned", "T-abandoned", "T-weird"].map((title) =>
    block.indexOf(title),
  );
  check(
    "concluded first, unknown status last",
    [...order].every((pos, i) => i === 0 || pos > order[i - 1]),
    true,
  );
  check("a concluded row carries its conclusion", block.includes("conclusão: aprendido"), true);
}

/* ========================================================================== */
section("Creative evidence block — presence, never performance");
/* ========================================================================== */

check(
  "empty library is missing data, never proof of absence",
  readinessCreativesBlock([]).includes("DADO AUSENTE") &&
    readinessCreativesBlock([]).includes("Plano de Teste Criativo"),
  true,
);
{
  const creative = (over: Record<string, unknown>) =>
    ({
      name: "c",
      status: "draft",
      source: "manual",
      format: null,
      angle: null,
      hook: null,
      promise: null,
      proof_type: null,
      emotion: null,
      funnel_stage: null,
      result_summary: null,
      organic_count: 0,
      ...over,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  const block = readinessCreativesBlock([
    creative({ angle: "dor", promise: "emagreça em 30 dias" }),
    creative({ angle: "prova", organic_count: 2 }),
    creative({ angle: "dor" }),
  ]);
  check("counts totals", block.includes("Criativos registrados: 3"), true);
  check("counts distinct angles", block.includes("2 ângulos distintos"), true);
  check("counts organic-linked creatives", block.includes("Com publicação orgânica vinculada: 1"), true);
  check("never claims attribution", block.includes("NUNCA afirme que um criativo causou venda"), true);
  check("message match lists the registered promise", block.includes("emagreça em 30 dias"), true);
  check("message match names the pagina dimension", block.includes("dimensão pagina"), true);

  const noPromise = readinessCreativesBlock([creative({}), creative({})]);
  check(
    "no registered promise => explicit data-absent framing, no invented promise",
    noPromise.includes("ainda não existe registrada"),
    true,
  );
  check("no promise => no MESSAGE MATCH list", noPromise.includes("promessas/ganchos já registrados"), false);
}

// Locale coverage for the phase-3 keys.
for (const locale of LOCALES) {
  for (const key of ["dimension-ativacao", "next-review-label"]) {
    check(`${key} has real copy in ${locale}`, (readinessMessages[locale][key] ?? "").trim().length > 0, true);
  }
}

// S2 regression pins: oferta stays context-driven and hasGuarantee must NEVER
// move out of the checkout group — old checkout findings resolve through the
// group fallback, and a move would silently detach their guarantee tick.
check("oferta still has no resolvable items (context-driven by design)", resolvableItems("oferta", undefined), []);
check(
  "hasGuarantee stays in the checkout group (old-verdict fallback)",
  itemsForDimension("checkout").includes("hasGuarantee"),
  true,
);

/* ========================================================================== */
section("Verdict diff — honest deltas, never string-diffed prose");
/* ========================================================================== */

{
  const mk = (verdict: string, blocking: string[], findings: { dimension: string; status: string }[]) =>
    ({
      ...baseVerdict,
      verdict,
      blocking,
      findings: findings.map((f) => ({ ...baseVerdict.findings[0], ...f })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  const improved = compareVerdicts(
    mk("nao_pronto", ["a", "b", "c"], [{ dimension: "mensuracao", status: "critico" }]),
    mk("quase", ["x"], [{ dimension: "mensuracao", status: "atencao" }]),
  );
  check("verdict transition improved", improved.verdict.direction, "improved");
  check("blocker counts, never string-diffed", improved.blockers, { before: 3, after: 1, direction: "improved" });
  check("dimension transition captured", improved.transitions, [
    { dimension: "mensuracao", from: "critico", to: "atencao", direction: "improved" },
  ]);
  check("improved delta is changed", improved.changed, true);

  const regressed = compareVerdicts(
    mk("pronto", [], [{ dimension: "pagina", status: "ok" }]),
    mk("nao_pronto", ["x"], [{ dimension: "pagina", status: "critico" }]),
  );
  check("verdict regression detected", regressed.verdict.direction, "regressed");
  check("blocker growth is a regression", regressed.blockers.direction, "regressed");

  // Two findings on one dimension: the WORST one is its status.
  const worst = worstStatusByDimension(
    mk(
      "quase",
      [],
      [
        { dimension: "pagina", status: "atencao" },
        { dimension: "pagina", status: "critico" },
      ],
    ),
  );
  check("worst status wins within a dimension", worst.get("pagina"), "critico");

  const clearedAndNew = compareVerdicts(
    mk("quase", [], [{ dimension: "checkout", status: "atencao" }]),
    mk("quase", [], [{ dimension: "descoberta", status: "atencao" }]),
  );
  check("dimension absent now is CLEARED (neutral), not resolved", clearedAndNew.clearedDimensions, ["checkout"]);
  check("dimension only in next is NEW", clearedAndNew.newDimensions, [{ dimension: "descoberta", status: "atencao" }]);

  const identical = compareVerdicts(
    mk("quase", ["a"], [{ dimension: "pagina", status: "atencao" }]),
    mk("quase", ["a reworded"], [{ dimension: "pagina", status: "atencao" }]),
  );
  check("reworded blocker prose is NOT a change (counts only)", identical.changed, false);
}

// The honest scan series: proved-count, never the tick-inflatable confirmed.
check("scanProvedCount: no signals => null (unreadable, not zero)", scanProvedCount(null), null);
check("scanProvedCount: SPA => null", scanProvedCount(signalsWith({ jsRenderedLikely: true })), null);
check(
  "scanProvedCount: full fixture proves the six tag/probe items",
  scanProvedCount(signalsWith()),
  6, // pixel, analytics, seoBasics, indexable, sitemapRobots, structuredData — pageFast needs PSI
);
check("scanProvedCount: PSI-fast adds pageFast", scanProvedCount(signalsWith({ psi: psiOk(2000) })), 7);
check(
  "scanProvedCount: partial fixture counts only observed-true",
  scanProvedCount(
    signalsWith({
      // NOTE: signalsWith replaces sub-objects wholesale — this seo has no
      // title/description, so seoBasics is NOT observed-true here.
      tracking: { metaPixel: true, ga4: false, gtm: false },
      seo: { structuredDataTypes: [] },
      discovery: { sitemapXml: "error" },
    }),
  ),
  2, // pixel + indexable (analytics/seoBasics/structuredData false, sitemapRobots + pageFast null)
);

// Locale coverage for the R3/U1 keys.
for (const locale of LOCALES) {
  for (const key of [
    "delta-since-last",
    "delta-none",
    "delta-verdict",
    "delta-blockers",
    "delta-dimension",
    "delta-dimension-cleared",
    "delta-dimension-new",
    "history-first-verdict",
    "history-blocking-title",
    "scan-trend-title",
    "scan-trend-proved",
    "scan-trend-unreadable",
    "scan-trend-failed",
    "deep-link-verdict-missing",
  ]) {
    check(`${key} has real copy in ${locale}`, (readinessMessages[locale][key] ?? "").trim().length > 0, true);
  }
}

// Locale coverage for the phase-4A door/wizard keys.
for (const locale of LOCALES) {
  for (const key of [
    "wizard-jump-to",
    "blocker-fix-page-cta",
    "blocker-fix-price-cta",
    "scan-no-url-cta",
    "offer-context-cta",
    "offer-context-hint",
  ]) {
    check(`${key} has real copy in ${locale}`, (readinessMessages[locale][key] ?? "").trim().length > 0, true);
  }
}

/* ========================================================================== */
section("Journey plumbing — durable signals, registered map, item→group");
/* ========================================================================== */

// groupForItem is total: every item maps to the group that contains it (U7).
for (const key of READINESS_ITEM_KEYS) {
  const group = groupForItem(key);
  check(
    `groupForItem(${key}) contains the item`,
    READINESS_GROUPS.find((entry) => entry.key === group)!.items.some((item) => item.key === key),
    true,
  );
}

// sanitizeJourneySignals: never trust the client (or a stale row) shape (U5).
check("journey: null => empty", sanitizeJourneySignals(null), { skippedItems: [], helpOpenedItems: [] });
check("journey: garbage string => empty", sanitizeJourneySignals("x"), { skippedItems: [], helpOpenedItems: [] });
check(
  "journey: unknown keys dropped, duplicates collapsed",
  sanitizeJourneySignals({ skippedItems: ["bogus", "pixelInstalled", "pixelInstalled", 42] }),
  { skippedItems: ["pixelInstalled"], helpOpenedItems: [] },
);
check(
  "journey: valid payload round-trips",
  sanitizeJourneySignals({ skippedItems: ["capiInstalled"], helpOpenedItems: ["pixelInstalled", "seoBasics"] }),
  { skippedItems: ["capiInstalled"], helpOpenedItems: ["pixelInstalled", "seoBasics"] },
);

// Persistence changed the DURABILITY of the concierge inputs, never the
// earning rules: a persisted helpOpened on a DIY item still earns nothing.
const journeyBase: AssistSignals = {
  contradicted: false,
  skipped: false,
  openedHelp: false,
  scanAttempts: 1,
  resolved: false,
  notApplicable: false,
};
check(
  "persisted helpOpened alone on a DIY item still earns no offer",
  assistReason("pageHasProof", { ...journeyBase, openedHelp: true }),
  null,
);
check(
  "persisted skipped on a specialist item still earns the offer",
  assistReason("capiInstalled", { ...journeyBase, skipped: true }),
  "skipped-specialist",
);

// mapRegisteredExperiments (U6): the (diagnosis_id, change_made) anchor,
// reversed — reload-proof without a schema change.
{
  const findings = [{ recommended_action: "instalar o pixel" }, { recommended_action: "adicionar PIX" }];
  check(
    "exact action maps to its finding index",
    mapRegisteredExperiments(findings, [{ id: "e1", change_made: "adicionar PIX" }]),
    { 1: "e1" },
  );
  check(
    "duplicate actions collapse to the FIRST index (mirrors the insert)",
    mapRegisteredExperiments(
      [{ recommended_action: "a" }, { recommended_action: "a" }],
      [{ id: "e1", change_made: "a" }],
    ),
    { 0: "e1" },
  );
  check(
    "null change_made produces no entry",
    mapRegisteredExperiments(findings, [{ id: "e1", change_made: null }]),
    {},
  );
  check("unmatched rows produce no entry", mapRegisteredExperiments(findings, [{ id: "e1", change_made: "x" }]), {});
  check("empty inputs produce {}", mapRegisteredExperiments([], []), {});
}

// Locale coverage for the phase-4C keys.
for (const locale of LOCALES) {
  for (const key of [
    "no-subscription-title",
    "no-subscription-body",
    "no-subscription-cta",
    "howto-specialist-cta",
    "copy-failed",
    "credit-load-error-title",
    "credit-load-error-body",
    "assist-load-error-title",
    "assist-load-error-body",
    "dont-know-item",
    "hide-explanation-item",
    "finding-summary-aria",
    "pending-chip-aria",
  ]) {
    check(`${key} has real copy in ${locale}`, (readinessMessages[locale][key] ?? "").trim().length > 0, true);
  }
}

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
// The trial states still have to be DISTINGUISHABLE — that is data structure
// the business owns. What turning them into ad audiences looks like is the
// launch plan's job, so the brief must ask for the former and refuse the
// latter (0041). Without the negative half this assertion would pass on the
// old text too.
check("trial-first brief demands the trial states be distinguishable", trialBrief.includes("ESTADOS DO TRIAL"), true);
check(
  "trial-first brief does not prescribe audience setup",
  /exclu(ir|a)|público de remarketing|campanhas de aquisição/i.test(trialBrief),
  false,
);
check("trial-first brief exposes the new item keys for related_items", trialBrief.includes("trialToPaidTracked"), true);
check("undeclared model refuses to assume direct sale", readinessFunnelModelBlock(p()).includes("NÃO INFORMOU"), true);
// Silence about the checkout must be framed as expected, even with no scan.
check(
  "no scan + trial-first still states the auth-wall limit",
  readinessScanBlock(null, "trial_first").includes("INALCANÇÁVEL"),
  true,
);
check(
  "no scan + direct funnel adds no auth-wall note",
  readinessScanBlock(null, "direct").includes("INALCANÇÁVEL"),
  false,
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
check("total stays 24 regardless of applicability", evalPlatform.total, 24);
check(
  "applicableTotal excludes what does not apply",
  evalPlatform.applicableTotal,
  24 - evalPlatform.notApplicable.length,
);
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

// A JS-rendered page: PRESENCE in the initial HTML is real proof (head tags
// are commonly server-rendered even on SPAs) — only ABSENCE is undecidable.
check(
  "presence on an SPA confirms (tags in the initial HTML are real)",
  autoConfirmProven(p(), signalsWith({ jsRenderedLikely: true })).pixelInstalled,
  true,
);
check(
  "absence on an SPA never confirms",
  autoConfirmProven(
    p(),
    signalsWith({ jsRenderedLikely: true, tracking: { metaPixel: false, ga4: false, gtm: false } }),
  ).pixelInstalled,
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
  findingResolution(["pixelInstalled"], p({ pixelInstalled: true }), {
    verified: ["pixelInstalled"],
    contradicted: [],
  }),
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

/* ========================================================================== */
section("Structural unprovability — no more 'awaiting proof' life sentences");
/* ========================================================================== */

// unprovableItems: the proved-tier claims the CURRENT scan can never prove.
check("no scan yet is NOT unprovable (scanning is still a path)", unprovableItems(null), []);
{
  const spaNothing = signalsWith({
    jsRenderedLikely: true,
    tracking: { metaPixel: false, ga4: false, gtm: false },
    seo: { title: null, metaDescription: null, structuredDataTypes: [] },
  });
  const list = unprovableItems(spaNothing);
  for (const key of ["pixelInstalled", "analyticsInstalled", "seoBasics", "indexable", "structuredData"] as const) {
    check(`SPA with nothing visible: ${key} is unprovable`, list.includes(key), true);
  }
  check("sitemapRobots is NEVER unprovable (probe channel)", list.includes("sitemapRobots"), false);
}
check(
  "GTM-only on a server-rendered page: pixel unprovable, analytics not",
  unprovableItems(signalsWith({ tracking: { metaPixel: false, ga4: false, gtm: true } })),
  // pageFast rides along on every scan without a PSI measurement (V3).
  ["pixelInstalled", "pageFast"],
);
check(
  "what is already proven is not unprovable",
  unprovableItems(signalsWith({ jsRenderedLikely: true })).includes("pixelInstalled"),
  false, // fixture has metaPixel: true — presence hoists above the SPA guard
);

// Probe channels survive the SPA guard in observeItem.
check(
  "sitemap missing still contradicts on an SPA",
  verifyItem("sitemapRobots", true, signalsWith({ jsRenderedLikely: true, discovery: { sitemapXml: "missing" } })),
  "contradicted",
);
check(
  "probes found still verify on an SPA",
  verifyItem("sitemapRobots", true, signalsWith({ jsRenderedLikely: true })),
  "verified",
);
check(
  "noindex is definitive even on an SPA",
  verifyItem("indexable", true, signalsWith({ jsRenderedLikely: true, seo: { noindex: true } })),
  "contradicted",
);
check(
  "pixel present on an SPA verifies",
  verifyItem("pixelInstalled", true, signalsWith({ jsRenderedLikely: true })),
  "verified",
);

// findingResolution: structurally unprovable settles as trusted, with the WHY.
check(
  "ticked pixel + unprovable => declared-unverifiable",
  findingResolution(["pixelInstalled"], p({ pixelInstalled: true }), {
    ...noEvidence,
    unprovable: ["pixelInstalled"],
  }),
  "declared-unverifiable",
);
check("declared-unverifiable is not pending", isFindingPending("declared-unverifiable"), false);
check(
  "a still-provable sibling keeps the finding awaiting-proof",
  findingResolution(["pixelInstalled", "sitemapRobots"], p({ pixelInstalled: true, sitemapRobots: true }), {
    ...noEvidence,
    unprovable: ["pixelInstalled"],
  }),
  "awaiting-proof",
);
check(
  "once the provable sibling is proved, the unprovable rest settles",
  findingResolution(["pixelInstalled", "sitemapRobots"], p({ pixelInstalled: true, sitemapRobots: true }), {
    verified: ["sitemapRobots"],
    contradicted: [],
    unprovable: ["pixelInstalled"],
  }),
  "declared-unverifiable",
);
check(
  "contradiction still wins over unprovable",
  findingResolution(["pixelInstalled"], p({ pixelInstalled: true }), {
    verified: [],
    contradicted: ["pixelInstalled"],
    unprovable: ["pixelInstalled"],
  }),
  "contradicted",
);
check(
  "canVerify:false still degrades to declared (coarser label, same outcome)",
  findingResolution(["pixelInstalled"], p({ pixelInstalled: true }), {
    ...noEvidence,
    canVerify: false,
    unprovable: ["pixelInstalled"],
  }),
  "declared",
);
// Backward-compat guard: evidence WITHOUT the new field reproduces the old table.
check(
  "omitting `unprovable` keeps the pre-existing behavior",
  findingResolution(["pixelInstalled"], p({ pixelInstalled: true }), noEvidence),
  "awaiting-proof",
);

// The brief marks a claimed-but-unprovable item honestly.
{
  const spaEval = evaluateReadiness(p({ pixelInstalled: true }), {
    hasLandingPage: true,
    hasPrice: true,
    signals: signalsWith({ jsRenderedLikely: true, tracking: { metaPixel: false, ga4: false, gtm: false } }),
  });
  check("evaluateReadiness exposes unprovable", spaEval.unprovable.includes("pixelInstalled"), true);
  const block = readinessChecklistBlock(p({ pixelInstalled: true }), spaEval);
  check("brief says IMPOSSÍVEL de verificar for unprovable claims", block.includes("IMPOSSÍVEL de verificar"), true);
}

// Locale coverage for the three new keys.
for (const locale of LOCALES) {
  for (const key of [
    "resolution-declared-unverifiable",
    "resolution-declared-unverifiable-body",
    "item-unprovable-note",
  ]) {
    check(`${key} has real copy in ${locale}`, (readinessMessages[locale][key] ?? "").trim().length > 0, true);
  }
}

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
check(
  "opening the explanation alone is not resistance",
  assistReason("pixelInstalled", sig({ openedHelp: true })),
  null,
);
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
