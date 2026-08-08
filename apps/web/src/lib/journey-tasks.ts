/**
 * The unified work queue — one ordered TODO list assembled from data ALREADY
 * PERSISTED across the three pre-paid engine modes (readiness, creative_plan,
 * launch_plan). Zero LLM calls, zero cost: this is navigation over what the
 * product already knows, never a new diagnosis.
 *
 * The gap this closes (2026-08-05 product review): every screen in the
 * journey answers "what is MY next step", but nothing ever answered "what's
 * next, period" — a returning user with a readiness verdict, a creative plan
 * and a launch plan open in three different tabs had no single place that
 * said which of the ~15 possible actions across all three actually matters
 * today. `home/components/task-queue-card.tsx` is the only consumer.
 *
 * Pure — no I/O — so it is trivially testable and so the Home page (the sole
 * caller) stays responsible for all fetching.
 */

import type { CreativePlanOutput } from "./creative-plan/schema";
import type { LaunchPlanOutput } from "./launch-plan/schema";
import type { ReadinessItemKey } from "./readiness/checklist";
import type { ReadinessFinding, ReadinessOutput } from "./readiness/schema";

import { MINIMUM_ORGANIC_COHORT_SIZE } from "@flyee/organic-growth";

export type JourneyTaskSource = "readiness" | "creative_plan" | "launch_plan";
export type JourneyTaskEffort = "baixo" | "medio" | "alto";

export interface JourneyTask {
  /** Stable across refetches so the queue never visibly reshuffles — derived
   *  from the source data's own keys, never a render-time index. */
  id: string;
  source: JourneyTaskSource;
  title: string;
  detail?: string;
  effort?: JourneyTaskEffort;
  /** The readiness engine's own "critico" severity — the loudest available
   *  marker, free of any new scoring system. */
  urgent?: boolean;
  href: string;
}

export interface JourneyTasksInput {
  productId: string;
  /** True inside /products/[id]/* — decides which URL shape every href uses. */
  workspace: boolean;
  readiness: {
    /** The verdict row id — carried into the deep link so the anchor keeps
     *  pointing at the reading these findings came from. */
    verdictId?: string | null;
    output: ReadinessOutput;
    /** The declared checklist — a finding whose related_items are ALL
     *  ticked is treated as resolved, same rule the readiness screen itself
     *  uses to grey out a fixed item. */
    profile: Partial<Record<ReadinessItemKey, boolean>>;
    /** `change_made` of every experiment already tied to this verdict's
     *  diagnosis id — a finding already turned into a tracked experiment is
     *  being worked, not queued twice. */
    registeredChangeMade: Set<string>;
  } | null;
  creativePlan: {
    output: CreativePlanOutput;
    /** hypothesis key → organic publications already linked to it. */
    publishedCount: Record<string, number>;
  } | null;
  launchPlan: {
    output: LaunchPlanOutput;
    /** step key → already turned into a tracked experiment. */
    registeredStepKeys: Set<string>;
  } | null;
}

/**
 * Every task href DEEP LINKS to the item itself, never to the screen that
 * contains it.
 *
 * The 2026-08-07 review caught the failure this fixes: clicking "instalar o
 * Pixel" landed the user at the top of the readiness screen, where they had to
 * find again the thing they had just clicked. The anchors below already
 * existed on the destination screens (`#finding-N` is read on mount by
 * readiness/experience.tsx) — the queue simply never used them.
 *
 * `?product=` and the path form must both survive the anchor: the non-workspace
 * routes redirect to `/products/[id]/...`, and that redirect preserves query +
 * hash (readiness' `redirectSuffix`), so the anchor arrives either way.
 */
const withAnchor = (base: string, query: string | null, anchor: string) =>
  `${base}${query ? (base.includes("?") ? "&" : "?") + query : ""}#${anchor}`;

const readinessHref = (productId: string, workspace: boolean, verdictId: string | null, index: number) =>
  withAnchor(
    workspace ? `/products/${productId}/readiness` : `/readiness?product=${productId}`,
    // Naming the verdict keeps the link correct even after a NEWER verdict is
    // generated in another tab — without it the anchor would silently point at
    // finding N of a different reading.
    verdictId ? `verdict=${verdictId}` : null,
    `finding-${index}`,
  );
const creativesHref = (productId: string, workspace: boolean, key: string) =>
  withAnchor(workspace ? `/products/${productId}/creatives` : `/creatives?product=${productId}`, null, `hip-${key}`);
const launchHref = (productId: string, workspace: boolean, key: string) =>
  withAnchor(workspace ? `/products/${productId}/launch` : `/launch?product=${productId}`, null, `etapa-${key}`);

function isFindingResolved(
  finding: ReadinessFinding,
  profile: Partial<Record<ReadinessItemKey, boolean>>,
  registeredChangeMade: Set<string>,
): boolean {
  if (registeredChangeMade.has(finding.recommended_action)) return true;
  if (finding.related_items && finding.related_items.length > 0) {
    return finding.related_items.every((key) => profile[key as ReadinessItemKey] === true);
  }
  return false;
}

/**
 * Build the ordered queue: readiness findings first (they already arrive
 * ordered "por alavancagem real" from the engine — trust that order rather
 * than re-deriving one), then creative hypotheses still short of a cohort
 * read, then launch-plan steps not yet tracked. Unbounded on purpose — the
 * card decides how many rows to show and how to group the rest behind "ver
 * todas".
 */
export function buildJourneyTasks(input: JourneyTasksInput): JourneyTask[] {
  const tasks: JourneyTask[] = [];

  if (input.readiness) {
    const { output, profile, registeredChangeMade, verdictId } = input.readiness;
    output.findings.forEach((finding, index) => {
      if (finding.status === "ok" || finding.status === "sem_dados") return;
      if (isFindingResolved(finding, profile, registeredChangeMade)) return;
      tasks.push({
        id: `readiness-${index}`,
        source: "readiness",
        title: finding.recommended_action,
        detail: finding.finding,
        effort: finding.effort,
        urgent: finding.status === "critico",
        href: readinessHref(input.productId, input.workspace, verdictId ?? null, index),
      });
    });
  }

  if (input.creativePlan) {
    const { output, publishedCount } = input.creativePlan;
    output.hypotheses.forEach((hypothesis) => {
      const published = publishedCount[hypothesis.key] ?? 0;
      // Already has enough volume for a cohort read — this hypothesis is
      // DONE, not queued (mirrors creative-plan-card's own coverage strip).
      if (published >= MINIMUM_ORGANIC_COHORT_SIZE) return;
      tasks.push({
        id: `creative-${hypothesis.key}`,
        source: "creative_plan",
        title: hypothesis.angle,
        detail:
          published > 0
            ? `${published}/${hypothesis.content_count} publicado(s) — faltam para leitura`
            : hypothesis.hook,
        href: creativesHref(input.productId, input.workspace, hypothesis.key),
      });
    });
  }

  if (input.launchPlan) {
    const { output, registeredStepKeys } = input.launchPlan;
    output.steps.forEach((step) => {
      if (registeredStepKeys.has(step.key)) return;
      tasks.push({
        id: `launch-${step.key}`,
        source: "launch_plan",
        title: step.title,
        detail: step.precondition || step.action,
        href: launchHref(input.productId, input.workspace, step.key),
      });
    });
  }

  return tasks;
}
