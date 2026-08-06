/**
 * Publishing cadence for the Creative Test Plan (docs/PRODUCT.md phase 8).
 *
 * The plan's `volume_note` already states the conditional math in prose ("at
 * this pace, ~N weeks"), but a beginner asked "what do I actually record THIS
 * week?" and prose could not answer that. This turns the same inputs — the
 * hypotheses in the engine's own priority order, plus a pace the USER
 * declares — into a week-by-week schedule. It does NOT schedule or publish
 * anything (that stays out of scope, docs/PRODUCT.md phase 8's own
 * invariant): it is a calendar of intent the person follows by hand.
 *
 * Pure — no I/O — so it is trivially testable and safe to run on the client.
 */

export interface CadenceHypothesisInput {
  key: string;
  angle: string;
  content_count: number;
}

export interface CadenceEntry {
  key: string;
  angle: string;
  /** Pieces of THIS hypothesis scheduled in THIS week — not its total. */
  count: number;
}

export interface CadenceWeek {
  /** 1-based. */
  week: number;
  entries: CadenceEntry[];
}

export interface CadencePlan {
  weeks: CadenceWeek[];
  totalWeeks: number;
}

/**
 * Fills weeks sequentially at `pacePerWeek` pieces/week, walking the
 * hypotheses in the order given (the engine's own "most promising first").
 * A hypothesis that does not fill a week on its own shares that week with
 * the next one rather than leaving capacity idle — the schedule always uses
 * exactly `pace` slots per week except the last.
 */
export function buildCadence(hypotheses: CadenceHypothesisInput[], pacePerWeek: number): CadencePlan {
  const pace = Math.max(1, Math.round(pacePerWeek));
  const weeks: CadenceWeek[] = [];
  let weekNumber = 1;
  let remainingInWeek = pace;
  let currentEntries: CadenceEntry[] = [];

  const closeWeek = () => {
    if (currentEntries.length > 0) weeks.push({ week: weekNumber, entries: currentEntries });
    weekNumber += 1;
    remainingInWeek = pace;
    currentEntries = [];
  };

  for (const hypothesis of hypotheses) {
    let left = hypothesis.content_count;
    while (left > 0) {
      if (remainingInWeek === 0) closeWeek();
      const take = Math.min(left, remainingInWeek);
      const existing = currentEntries.find((entry) => entry.key === hypothesis.key);
      if (existing) existing.count += take;
      else currentEntries.push({ key: hypothesis.key, angle: hypothesis.angle, count: take });
      left -= take;
      remainingInWeek -= take;
    }
  }
  if (currentEntries.length > 0) weeks.push({ week: weekNumber, entries: currentEntries });

  return { weeks, totalWeeks: weeks.length };
}
