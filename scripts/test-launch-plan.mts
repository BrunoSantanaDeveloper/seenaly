/**
 * Tests for the Launch Plan's pure domain (docs/PRODUCT.md phase 9).
 *
 * Usage:  npm run test:launch-plan
 *
 * What must never regress silently:
 *   1. the math (lib/launch-plan/math.ts) — the daily budget floor and the
 *      optimization event's evidentiary basis are computed here, DELIBERATELY
 *      outside the model's control ("o piso de orçamento é aritmética, não
 *      opinião"). A regression here is a wrong number shown as authoritative.
 *   2. the sanitizer (lib/launch-plan/schema.ts) — it must overwrite whatever
 *      the model wrote in viable/budget/optimization_event/structure.adsets
 *      with the computed values, no matter how confidently the model
 *      disagreed, and it must never let an invented hypothesis key through.
 *   3. the brief blocks — they carry the "NÃO recalcule" instruction and the
 *      readiness/creative-plan honesty framing into the prompt.
 *   4. every LAUNCH_PLAN_ERROR_CODES entry has real copy in all 5 locales.
 *
 * The repo has no test runner; this follows the established `tsx scripts/*.mts`
 * convention. No network, no database, no keys — safe to run anywhere.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  launchPlanAuthoritativeBlock,
  launchPlanCreativeBlock,
  launchPlanReadinessBlock,
  launchPlanRetrievalPlan,
  type LaunchPlanHypothesisRow,
} from "../apps/web/src/lib/launch-plan/brief";
import { LAUNCH_PLAN_ERROR_CODES } from "../apps/web/src/lib/launch-plan/errors";
import { learningPhaseFloor, resolveOptimizationEvent } from "../apps/web/src/lib/launch-plan/math";
import {
  citedLaunchPlanExcerptIndexes,
  isLaunchPlanOutput,
  type LaunchPlanOutput,
  sanitizeLaunchPlan,
} from "../apps/web/src/lib/launch-plan/schema";
import type { ReadinessEvaluation } from "../apps/web/src/lib/readiness/checklist";

let passes = 0;
let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const got = JSON.stringify(actual);
  const want = JSON.stringify(expected);
  if (got === want) {
    passes += 1;
  } else {
    failures += 1;
    console.error(`FAIL ${name}\n  expected ${want}\n  got      ${got}`);
  }
}

function checkTrue(name: string, condition: boolean) {
  check(name, condition, true);
}

/* --------------------------- resolveOptimizationEvent --------------------- */

check(
  "event: no readiness at all is missing",
  resolveOptimizationEvent({ declaredEvent: "Compra", conversionEventTested: false, pixelProved: false, hasReadiness: false })
    .basis,
  "missing",
);
check(
  "event: readiness exists but event never confirmed is missing",
  resolveOptimizationEvent({ declaredEvent: "Compra", conversionEventTested: false, pixelProved: true, hasReadiness: true })
    .basis,
  "missing",
);
check(
  "event: confirmed but pixel not scan-proved is declared",
  resolveOptimizationEvent({ declaredEvent: "Compra", conversionEventTested: true, pixelProved: false, hasReadiness: true })
    .basis,
  "declared",
);
check(
  "event: confirmed AND pixel scan-proved is the strongest tier",
  resolveOptimizationEvent({ declaredEvent: "Compra", conversionEventTested: true, pixelProved: true, hasReadiness: true })
    .basis,
  "proved",
);
check(
  "event: reuses the declared label when present",
  resolveOptimizationEvent({ declaredEvent: "Início de checkout", conversionEventTested: true, pixelProved: true, hasReadiness: true })
    .event,
  "Início de checkout",
);
checkTrue(
  "event: undeclared event never silently becomes empty",
  resolveOptimizationEvent({ declaredEvent: null, conversionEventTested: false, pixelProved: false, hasReadiness: false }).event
    .length > 0,
);

/* ------------------------------ learningPhaseFloor ------------------------ */

{
  const viable = learningPhaseFloor({
    targetCac: 45,
    monthlyBudget: 15000,
    currency: "BRL",
    eventBasis: "proved",
    eventLabel: "Compra",
  });
  checkTrue("floor: purchase event with CAC + enough budget is viable", viable.viable);
  check("floor: cost per event equals target CAC", viable.costPerEvent, 45);
  checkTrue("floor: daily floor is positive", (viable.dailyFloorPerAdset ?? 0) > 0);
  checkTrue("floor: at least one ad set fits", viable.adsetCount >= 1);
  checkTrue("floor: arithmetic is non-empty and readable", viable.arithmetic.length >= 3);
  check("floor: missing list is empty when everything is known", viable.missing, []);
}

{
  const noCac = learningPhaseFloor({
    targetCac: null,
    monthlyBudget: 15000,
    currency: "BRL",
    eventBasis: "proved",
    eventLabel: "Compra",
  });
  checkTrue("floor: missing target_cac is NOT viable", !noCac.viable);
  checkTrue("floor: missing target_cac is reported, never guessed", noCac.missing.some((m) => m.includes("CAC alvo")));
  check("floor: cost per event stays null without a CAC", noCac.costPerEvent, null);
}

{
  const shallow = learningPhaseFloor({
    targetCac: 45,
    monthlyBudget: 15000,
    currency: "BRL",
    eventBasis: "declared",
    eventLabel: "Início de checkout",
  });
  checkTrue("floor: a non-purchase event without a conversion rate is NOT viable", !shallow.viable);
  checkTrue(
    "floor: a non-purchase event asks for the missing rate, never invents one",
    shallow.missing.some((m) => m.includes("taxa de conversão")),
  );
}

{
  const tooSmall = learningPhaseFloor({
    targetCac: 200,
    monthlyBudget: 300, // R$10/day — far under any realistic floor
    currency: "BRL",
    eventBasis: "proved",
    eventLabel: "Compra",
  });
  checkTrue("floor: a budget under the floor is NOT viable", !tooSmall.viable);
  check("floor: adset count is zero, never a misleading partial number", tooSmall.adsetCount, 0);
  checkTrue("floor: what_would_change is filled when not viable", tooSmall.whatWouldChange.length > 0);
}

{
  const noBudget = learningPhaseFloor({
    targetCac: 45,
    monthlyBudget: null,
    currency: "BRL",
    eventBasis: "proved",
    eventLabel: "Compra",
  });
  checkTrue("floor: missing monthly_budget is NOT viable", !noBudget.viable);
  checkTrue(
    "floor: missing monthly_budget is reported by name",
    noBudget.missing.some((m) => m.includes("orçamento mensal")),
  );
}

/* --------------------------------- schema ---------------------------------- */

const step = (overrides: Partial<LaunchPlanOutput["steps"][number]> = {}) => ({
  key: "lancamento-inicial",
  title: "Lançamento inicial",
  action: "Suba 1 campanha com 2 conjuntos, R$50/dia cada, otimizando para Compra.",
  precondition: "",
  signal_to_advance: "50 compras acumuladas no conjunto em 7 dias.",
  technical_basis: [],
  ...overrides,
});

const basePlan: LaunchPlanOutput = {
  diagnosis: "Estrutura provada; a menor aposta viável usa 2 conjuntos.",
  evidence: [{ statement: "Pixel confirmado pelo scan.", source: "campaign_data" }],
  viable: true,
  what_would_change: "",
  optimization_event: { event: "Compra", basis: "proved", rationale: "Pixel provado + evento testado." },
  budget: { daily_floor_per_adset: 320, adset_count: 2, arithmetic: ["linha 1", "linha 2"] },
  structure: {
    campaigns: 1,
    adsets: 2,
    targeting_posture: "amplo",
    creatives_per_adset: 3,
    hypothesis_keys: ["prova-social-reels"],
  },
  steps: [step()],
  judgement: { window_days: 7, do_not_touch: ["orçamento", "criativo"] },
  risk: "Se o evento não disparar como esperado, o piso calculado fica errado.",
  confidence: "media",
  success_criterion: "50 eventos de otimização por conjunto em 7 dias.",
  next_review: "Em 7 dias, ou quando acumular 50 eventos por conjunto.",
  insufficient_data: false,
  missing_data: "",
};

checkTrue("guard: base plan validates", isLaunchPlanOutput(basePlan));
checkTrue("guard: rejects missing optimization_event", !isLaunchPlanOutput({ ...basePlan, optimization_event: undefined }));
checkTrue("guard: rejects non-array steps", !isLaunchPlanOutput({ ...basePlan, steps: "x" }));
checkTrue(
  "guard: rejects a step with no precondition field",
  !isLaunchPlanOutput({ ...basePlan, steps: [{ ...step(), precondition: undefined }] }),
);

{
  // The model disagrees with the computed math on every authoritative field —
  // the sanitizer must win regardless of how confident the model's numbers look.
  const modelDisagreed: LaunchPlanOutput = {
    ...basePlan,
    viable: false,
    what_would_change: "",
    optimization_event: { event: "Lead", basis: "proved", rationale: "..." },
    budget: { daily_floor_per_adset: 9999, adset_count: 99, arithmetic: ["conta inventada"] },
    structure: { ...basePlan.structure, adsets: 99, hypothesis_keys: ["prova-social-reels", "hipotese-inventada"] },
    steps: [step({ key: "" }), step({ key: "" })],
  };
  const sanitized = sanitizeLaunchPlan(modelDisagreed, {
    optimizationEvent: { event: "Compra", basis: "proved", note: "nota autoritativa" },
    floor: { viable: true, costPerEvent: 45, dailyFloorPerAdset: 320, adsetCount: 2, arithmetic: ["linha real"], missing: [], whatWouldChange: "" },
    validHypothesisKeys: ["prova-social-reels"],
  });
  check("sanitize: viable is server-authoritative, never the model's", sanitized.viable, true);
  check("sanitize: optimization event is overwritten", sanitized.optimization_event.event, "Compra");
  check("sanitize: optimization event basis is overwritten", sanitized.optimization_event.basis, "proved");
  check("sanitize: budget numbers are overwritten", sanitized.budget.adset_count, 2);
  check("sanitize: budget arithmetic is overwritten, not the model's invented one", sanitized.budget.arithmetic, ["linha real"]);
  check("sanitize: structure.adsets is forced to match budget.adset_count", sanitized.structure.adsets, 2);
  check(
    "sanitize: an invented hypothesis key is dropped",
    sanitized.structure.hypothesis_keys,
    ["prova-social-reels"],
  );
  checkTrue(
    "sanitize: empty step keys are made unique, never collapsed",
    new Set(sanitized.steps.map((s) => s.key)).size === sanitized.steps.length,
  );
}

{
  const notViable = sanitizeLaunchPlan(
    { ...basePlan, what_would_change: "" },
    {
      optimizationEvent: { event: "Compra", basis: "missing", note: "sem prontidão" },
      floor: {
        viable: false,
        costPerEvent: null,
        dailyFloorPerAdset: null,
        adsetCount: 0,
        arithmetic: ["linha 1"],
        missing: ["CAC alvo"],
        whatWouldChange: "Preencha o CAC alvo.",
      },
      validHypothesisKeys: [],
    },
  );
  check("sanitize: what_would_change falls back to the computed one when empty", notViable.what_would_change, "Preencha o CAC alvo.");
  check("sanitize: budget floor is zero, never null-turned-fabricated", notViable.budget.daily_floor_per_adset, 0);
}

checkTrue(
  "cited: a citation index inside range is counted",
  citedLaunchPlanExcerptIndexes({ ...basePlan, steps: [step({ technical_basis: [{ rule: "x", citation: "[2]" }] })] }, 4).has(2),
);
checkTrue(
  "cited: a citation index out of range is dropped",
  !citedLaunchPlanExcerptIndexes({ ...basePlan, steps: [step({ technical_basis: [{ rule: "x", citation: "[9]" }] })] }, 4).has(9),
);

/* ------------------------------ brief blocks ------------------------------ */

checkTrue(
  "brief: no readiness profile points at running it, honestly",
  launchPlanReadinessBlock(null, null).includes("Não existe um perfil de Prontidão"),
);

{
  const evaluation = {
    verified: ["pixelInstalled"],
    blockers: [],
  } as unknown as ReadinessEvaluation;
  const block = launchPlanReadinessBlock(evaluation, null);
  checkTrue("brief: a proved pixel is stated as PROVADO", block.includes("PROVADO"));
  checkTrue("brief: zero blockers is stated plainly", block.includes("Nenhum bloqueador"));
}

{
  const hyp: LaunchPlanHypothesisRow = {
    key: "prova-social-reels",
    angle: "Prova social",
    format: "reels",
    funnel_stage: "prova",
    content_count: 5,
    organic_count: 3,
  };
  checkTrue("brief: creative block lists the hypothesis key", launchPlanCreativeBlock([hyp]).includes("[prova-social-reels]"));
  checkTrue("brief: empty creative plan nudges toward generating one", launchPlanCreativeBlock([]).includes("Plano de Teste Criativo"));
}

checkTrue(
  "brief: authoritative block forbids recalculation",
  launchPlanAuthoritativeBlock(
    { event: "Compra", basis: "proved", note: "nota" },
    { viable: true, costPerEvent: 45, dailyFloorPerAdset: 320, adsetCount: 2, arithmetic: ["linha 1"], missing: [], whatWouldChange: "" },
  ).includes("NUNCA recalcule"),
);
checkTrue(
  "brief: non-viable authoritative block states the conclusion plainly",
  launchPlanAuthoritativeBlock(
    { event: "Compra", basis: "missing", note: "nota" },
    { viable: false, costPerEvent: null, dailyFloorPerAdset: null, adsetCount: 0, arithmetic: [], missing: ["CAC alvo"], whatWouldChange: "Preencha o CAC alvo." },
  ).includes("NÃO viável"),
);

{
  const plan = launchPlanRetrievalPlan();
  check("retrieval: five focused questions, one per subject", plan.length, 5);
  checkTrue("retrieval: every query carries at least one collection weight", plan.every((q) => q.meta + q.playbook > 0));
  checkTrue("retrieval: remarketing question is playbook-heavy", plan.find((q) => q.key === "remarketing")!.playbook >= 3);
}

/* --------------------------------- i18n ------------------------------------ */

const LOCALES = ["pt-BR", "en", "es", "de", "fr"] as const;
const MESSAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packages/content/messages");
const launchPlanMessages = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8")).launchPlan as Record<string, string>,
  ]),
) as Record<(typeof LOCALES)[number], Record<string, string>>;

for (const code of LAUNCH_PLAN_ERROR_CODES) {
  for (const locale of LOCALES) {
    check(
      `error-${code} has real copy in ${locale}`,
      typeof launchPlanMessages[locale][`error-${code}`] === "string" &&
        launchPlanMessages[locale][`error-${code}`].trim().length > 0,
      true,
    );
  }
}

console.log(
  failures === 0 ? `\nALL PASS — ${passes} assertions.` : `\n${failures} FAILURE(S) out of ${passes + failures}.`,
);
process.exit(failures === 0 ? 0 : 1);
