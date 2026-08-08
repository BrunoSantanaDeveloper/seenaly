/**
 * Tests for the unified work queue (`lib/journey-tasks`) and the journey
 * ladder (`lib/journey`).
 *
 * Usage:  npm run test:journey
 *
 * What must never regress silently:
 *   1. DEEP LINKS — the 2026-08-07 review found every task pointing at the
 *      SCREEN instead of the item, so clicking "install the Pixel" dumped the
 *      user at the top of a long page to hunt for the row they just clicked.
 *      Anchors are the whole fix; a plain href is the bug coming back.
 *   2. RESOLVED WORK LEAVES THE QUEUE — a finding whose checklist items are all
 *      ticked, or that is already a tracked experiment, must not be queued
 *      again. Re-nagging about finished work destroys trust in the list.
 *   3. THE LADDER NEVER SENDS A ZERO-DATA USER TO THE CAMPAIGN DIAGNOSIS —
 *      the maturity-spectrum invariant, and the original complaint.
 *
 * The repo has no test runner; this follows the `tsx scripts/*.mts` convention.
 * No network, no database, no keys.
 */
import process from "node:process";

import { nextJourneyStage } from "../apps/web/src/lib/journey";
import { buildJourneyTasks, type JourneyTasksInput } from "../apps/web/src/lib/journey-tasks";
import type { CreativePlanOutput } from "../apps/web/src/lib/creative-plan/schema";
import type { LaunchPlanOutput } from "../apps/web/src/lib/launch-plan/schema";
import type { ReadinessOutput } from "../apps/web/src/lib/readiness/schema";

let passes = 0;
let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const got = JSON.stringify(actual);
  const want = JSON.stringify(expected);
  if (got === want) {
    passes += 1;
  } else {
    failures += 1;
    console.error(`FAIL  ${name}\n      expected ${want}\n      actual   ${got}`);
  }
}

function checkTrue(name: string, actual: boolean) {
  check(name, actual, true);
}

const PRODUCT = "prod-1";

/* -------------------------------- fixtures -------------------------------- */

const finding = (over: Partial<ReadinessOutput["findings"][number]> = {}) =>
  ({
    dimension: "mensuracao",
    status: "critico",
    finding: "O Pixel não foi encontrado na página.",
    evidence: [],
    technical_basis: [],
    recommended_action: "Instalar o Pixel da Meta na página",
    effort: "baixo",
    impact: "alto",
    success_criterion: "O Pixel aparece no scan.",
    related_items: [],
    ...over,
  }) as ReadinessOutput["findings"][number];

const readinessOutput = (findings: ReadinessOutput["findings"]): ReadinessOutput =>
  ({
    verdict: "nao_pronto",
    summary: "",
    blocking: [],
    findings,
    confidence: "media",
    insufficient_data: false,
    missing_data: "",
    next_review: "",
  }) as ReadinessOutput;

const creativeOutput = (): CreativePlanOutput =>
  ({
    diagnosis: "",
    evidence: [],
    hypotheses: [
      {
        key: "prova-antes-depois",
        angle: "Antes e depois do prontuário",
        hook: "O erro que todo terapeuta comete",
        format: "reels",
        proof_type: "demonstracao",
        emotion: "alivio",
        funnel_stage: "descoberta",
        rationale: "",
        prompt_brief: "",
        content_count: 5,
        success_criterion: "",
        technical_basis: [],
      },
    ],
    volume_note: "",
    transfer_caveat: "",
    confidence: "media",
    insufficient_data: false,
    missing_data: "",
  }) as CreativePlanOutput;

const launchOutput = (): LaunchPlanOutput =>
  ({
    diagnosis: "",
    evidence: [],
    optimization_event: { event: "Purchase", basis: "declared", rationale: "" },
    budget: { daily_floor_per_adset: 100, adset_count: 2, arithmetic: [] },
    structure: {
      campaigns: 1,
      adsets: 2,
      targeting_posture: "amplo",
      creatives_per_adset: 3,
      hypothesis_keys: [],
    },
    steps: [
      {
        key: "aquecer-publico-frio",
        title: "Subir a campanha de aquisição",
        action: "Criar uma campanha de vendas",
        precondition: "",
        signal_to_advance: "",
        technical_basis: [],
      },
    ],
    judgement: { window_days: 7, do_not_touch: [] },
    viable: true,
    what_would_change: "",
    risk: "",
    confidence: "media",
    success_criterion: "",
    next_review: "",
    insufficient_data: false,
    missing_data: "",
  }) as LaunchPlanOutput;

const input = (over: Partial<JourneyTasksInput> = {}): JourneyTasksInput => ({
  productId: PRODUCT,
  workspace: true,
  readiness: null,
  creativePlan: null,
  launchPlan: null,
  ...over,
});

/* ------------------------------- deep links ------------------------------- */

console.log("--- Deep links: a task lands ON its item, never on the screen ---");

{
  const tasks = buildJourneyTasks(
    input({
      readiness: {
        verdictId: "verdict-9",
        output: readinessOutput([finding(), finding({ recommended_action: "Instalar a CAPI" })]),
        profile: {},
        registeredChangeMade: new Set(),
      },
    }),
  );
  check("readiness: one task per open finding", tasks.length, 2);
  check(
    "readiness: deep link carries the verdict AND the finding index",
    tasks[0].href,
    `/products/${PRODUCT}/readiness?verdict=verdict-9#finding-0`,
  );
  check("readiness: the second finding anchors to its own index", tasks[1].href, `/products/${PRODUCT}/readiness?verdict=verdict-9#finding-1`);
  checkTrue("readiness: critico surfaces as urgent", tasks[0].urgent === true);
}

{
  // Without a verdict id the anchor must still work — the `?` must not appear
  // empty and the hash must survive.
  const tasks = buildJourneyTasks(
    input({ readiness: { output: readinessOutput([finding()]), profile: {}, registeredChangeMade: new Set() } }),
  );
  check("readiness: no verdict id still anchors", tasks[0].href, `/products/${PRODUCT}/readiness#finding-0`);
}

{
  // Outside the workspace the base already carries a query string, so the
  // verdict has to join with `&` — a second `?` would break the redirect.
  const tasks = buildJourneyTasks(
    input({
      workspace: false,
      readiness: {
        verdictId: "v1",
        output: readinessOutput([finding()]),
        profile: {},
        registeredChangeMade: new Set(),
      },
    }),
  );
  check("readiness: non-workspace href joins the query correctly", tasks[0].href, `/readiness?product=${PRODUCT}&verdict=v1#finding-0`);
  checkTrue("readiness: exactly one '?' in the href", tasks[0].href.split("?").length === 2);
}

{
  const tasks = buildJourneyTasks(input({ creativePlan: { output: creativeOutput(), publishedCount: {} } }));
  check("creative: deep link uses the hypothesis key", tasks[0].href, `/products/${PRODUCT}/creatives#hip-prova-antes-depois`);
}

{
  const tasks = buildJourneyTasks(
    input({ launchPlan: { output: launchOutput(), registeredStepKeys: new Set() } }),
  );
  check("launch: deep link uses the step key", tasks[0].href, `/products/${PRODUCT}/launch#etapa-aquecer-publico-frio`);
}

/* -------------------------- finished work leaves --------------------------- */

console.log("--- Resolved work must leave the queue ---");

{
  const tasks = buildJourneyTasks(
    input({
      readiness: {
        output: readinessOutput([finding({ related_items: ["pixelInstalled"] })]),
        profile: { pixelInstalled: true },
        registeredChangeMade: new Set(),
      },
    }),
  );
  check("finding with all related items ticked is gone", tasks.length, 0);
}

{
  const tasks = buildJourneyTasks(
    input({
      readiness: {
        output: readinessOutput([finding({ related_items: ["pixelInstalled", "capiInstalled"] })]),
        profile: { pixelInstalled: true },
        registeredChangeMade: new Set(),
      },
    }),
  );
  check("finding only PARTLY ticked stays queued", tasks.length, 1);
}

{
  const tasks = buildJourneyTasks(
    input({
      readiness: {
        output: readinessOutput([finding()]),
        profile: {},
        registeredChangeMade: new Set(["Instalar o Pixel da Meta na página"]),
      },
    }),
  );
  check("finding already tracked as an experiment is gone", tasks.length, 0);
}

{
  const ok = buildJourneyTasks(
    input({ readiness: { output: readinessOutput([finding({ status: "ok" })]), profile: {}, registeredChangeMade: new Set() } }),
  );
  check("status 'ok' is not work", ok.length, 0);
  const noData = buildJourneyTasks(
    input({
      readiness: { output: readinessOutput([finding({ status: "sem_dados" })]), profile: {}, registeredChangeMade: new Set() },
    }),
  );
  check("status 'sem_dados' is not work", noData.length, 0);
}

{
  // Cohort floor reached — the hypothesis is DONE, not pending.
  const tasks = buildJourneyTasks(
    input({ creativePlan: { output: creativeOutput(), publishedCount: { "prova-antes-depois": 99 } } }),
  );
  check("hypothesis past the cohort floor leaves the queue", tasks.length, 0);
}

{
  const tasks = buildJourneyTasks(
    input({ launchPlan: { output: launchOutput(), registeredStepKeys: new Set(["aquecer-publico-frio"]) } }),
  );
  check("registered launch step leaves the queue", tasks.length, 0);
}

/* --------------------------------- order ---------------------------------- */

console.log("--- Order: structure, then creative evidence, then spend ---");

{
  const tasks = buildJourneyTasks(
    input({
      readiness: { output: readinessOutput([finding()]), profile: {}, registeredChangeMade: new Set() },
      creativePlan: { output: creativeOutput(), publishedCount: {} },
      launchPlan: { output: launchOutput(), registeredStepKeys: new Set() },
    }),
  );
  check(
    "sources come in journey order",
    tasks.map((task) => task.source),
    ["readiness", "creative_plan", "launch_plan"],
  );
  checkTrue("task ids are unique", new Set(tasks.map((task) => task.id)).size === tasks.length);
  checkTrue("every task deep links", tasks.every((task) => task.href.includes("#")));
}

check("no engine output => empty queue", buildJourneyTasks(input()).length, 0);

/* --------------------------------- ladder --------------------------------- */

console.log("--- Ladder: never send a zero-data user to the campaign diagnosis ---");

const ladder = {
  hasContext: true,
  hasReadiness: true,
  hasCreativeEvidence: true,
  hasLaunchPlan: true,
  hasDiagnosis: false,
  hasExperiment: false,
  hasCampaignData: false,
};

check("no campaign data => skips diagnosis", nextJourneyStage(ladder), "experiments");
check("with campaign data => diagnosis", nextJourneyStage({ ...ladder, hasCampaignData: true }), "diagnosis");
check("no context => context first", nextJourneyStage({ ...ladder, hasContext: false }), "context");
check("no readiness => readiness before creatives", nextJourneyStage({ ...ladder, hasReadiness: false }), "readiness");
check(
  "structure + creative done, no launch plan => launch",
  nextJourneyStage({ ...ladder, hasLaunchPlan: false }),
  "launch",
);

/* --------------------------------- result --------------------------------- */

if (failures === 0) {
  console.log(`\nALL PASS — ${passes} assertions.`);
  process.exit(0);
}
console.error(`\n${failures} FAILURE(S), ${passes} passed.`);
process.exit(1);
