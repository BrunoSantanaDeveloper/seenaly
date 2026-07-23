import process from "node:process";

import { computeProgress, type OnboardingStateRow, type OnboardingStep } from "../packages/onboarding/src/index";

let failures = 0;
let passes = 0;

const check = (name: string, actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passes += 1;
    return;
  }
  failures += 1;
  console.error(`FAIL ${name}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
};

const state = (completedSteps: string[]): OnboardingStateRow => ({
  completedSteps,
  dismissed: false,
  completedAt: null,
});

const steps: OnboardingStep[] = [
  { key: "product", title: "Product" },
  { key: "context", title: "Context" },
  { key: "readiness", title: "Readiness" },
  { key: "meta", title: "Meta", required: false },
  { key: "diagnosis", title: "Diagnosis" },
];

const partial = computeProgress(steps, state(["product", "context", "readiness"]));
check("optional incomplete does not dilute progress", [partial.done, partial.total, partial.percent], [3, 4, 75]);
check("next step skips optional enrichment", partial.nextStep?.key, "diagnosis");
check("optional counters remain available", [partial.optionalDone, partial.optionalTotal], [0, 1]);

const completeWithoutMeta = computeProgress(steps, state(["product", "context", "readiness", "diagnosis"]));
check(
  "required flow completes without Meta",
  [completeWithoutMeta.done, completeWithoutMeta.total, completeWithoutMeta.percent, completeWithoutMeta.complete],
  [4, 4, 100, true],
);
check("completed required flow has no next required step", completeWithoutMeta.nextStep, null);
check("Meta remains the next optional enrichment", completeWithoutMeta.optionalNextStep?.key, "meta");

const optionalOnly = computeProgress(
  [
    { key: "meta", title: "Meta", required: false },
    { key: "organic", title: "Organic", required: false, done: true },
  ],
  state([]),
);
check(
  "optional-only flow is complete with separate counters",
  [
    optionalOnly.done,
    optionalOnly.total,
    optionalOnly.percent,
    optionalOnly.complete,
    optionalOnly.optionalDone,
    optionalOnly.optionalTotal,
  ],
  [0, 0, 0, true, 1, 2],
);

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
