/**
 * "What changed" between two readiness verdicts (R3) — the payoff surface of
 * the re-check loop, as pure domain so every rule is unit-testable.
 *
 * Two honesty decisions, both deliberate:
 *  - `blocking[]` lines are LLM prose and are NEVER set-diffed: two runs word
 *    the same blocker differently, and a string diff manufactures phantom
 *    added+removed pairs. Counts (plus the current list, already on screen)
 *    are the honest delta. Verdict words and dimension statuses are enums and
 *    diff exactly.
 *  - a dimension ABSENT from the newer verdict is NOT proof of resolution:
 *    the schema caps findings at 7, so truncation is a competing explanation.
 *    `clearedDimensions` is labelled neutrally in the UI ("não sinalizada
 *    nesta leitura"), never "resolvida".
 */

import type { ReadinessDimension, ReadinessOutput, ReadinessStatus, ReadinessVerdict } from "./schema";

export const VERDICT_RANK: Record<ReadinessVerdict, number> = { nao_pronto: 0, quase: 1, pronto: 2 };
/** ok < sem_dados < atencao < critico — "worse" means more urgent. */
export const STATUS_RANK: Record<ReadinessStatus, number> = { ok: 0, sem_dados: 1, atencao: 2, critico: 3 };

export type DeltaDirection = "improved" | "regressed" | "same";

export interface DimensionTransition {
  dimension: ReadinessDimension;
  from: ReadinessStatus;
  to: ReadinessStatus;
  direction: DeltaDirection;
}

export interface VerdictDelta {
  verdict: { from: ReadinessVerdict; to: ReadinessVerdict; direction: DeltaDirection };
  blockers: { before: number; after: number; direction: DeltaDirection };
  /** Dimensions present in BOTH verdicts whose WORST status changed. */
  transitions: DimensionTransition[];
  /** Flagged before, absent now — neutral wording only (7-finding cap). */
  clearedDimensions: ReadinessDimension[];
  /** Absent before, flagged now. */
  newDimensions: { dimension: ReadinessDimension; status: ReadinessStatus }[];
  changed: boolean;
}

/** A dimension can carry several findings — the WORST one is its status. */
export function worstStatusByDimension(output: ReadinessOutput): Map<ReadinessDimension, ReadinessStatus> {
  const worst = new Map<ReadinessDimension, ReadinessStatus>();
  for (const finding of output.findings) {
    const current = worst.get(finding.dimension);
    if (current === undefined || STATUS_RANK[finding.status] > STATUS_RANK[current]) {
      worst.set(finding.dimension, finding.status);
    }
  }
  return worst;
}

const direction = (before: number, after: number, higherIsBetter: boolean): DeltaDirection => {
  if (before === after) return "same";
  const upward = after > before;
  return upward === higherIsBetter ? "improved" : "regressed";
};

export function compareVerdicts(previous: ReadinessOutput, next: ReadinessOutput): VerdictDelta {
  const verdict = {
    from: previous.verdict,
    to: next.verdict,
    direction: direction(VERDICT_RANK[previous.verdict], VERDICT_RANK[next.verdict], true),
  };
  const blockers = {
    before: previous.blocking.length,
    after: next.blocking.length,
    direction: direction(previous.blocking.length, next.blocking.length, false),
  };

  const before = worstStatusByDimension(previous);
  const after = worstStatusByDimension(next);

  const transitions: DimensionTransition[] = [];
  const clearedDimensions: ReadinessDimension[] = [];
  for (const [dimension, fromStatus] of before) {
    const toStatus = after.get(dimension);
    if (toStatus === undefined) {
      clearedDimensions.push(dimension);
      continue;
    }
    if (toStatus !== fromStatus) {
      transitions.push({
        dimension,
        from: fromStatus,
        to: toStatus,
        direction: direction(STATUS_RANK[fromStatus], STATUS_RANK[toStatus], false),
      });
    }
  }
  const newDimensions = [...after.entries()]
    .filter(([dimension]) => !before.has(dimension))
    .map(([dimension, status]) => ({ dimension, status }));

  return {
    verdict,
    blockers,
    transitions,
    clearedDimensions,
    newDimensions,
    changed:
      verdict.direction !== "same" ||
      blockers.direction !== "same" ||
      transitions.length > 0 ||
      clearedDimensions.length > 0 ||
      newDimensions.length > 0,
  };
}
