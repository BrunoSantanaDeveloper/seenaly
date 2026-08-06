/**
 * The single source of truth for "what is the user's next step in THIS
 * product's journey?" — docs/PRODUCT.md's ordered pillars (context →
 * readiness → creative evidence → launch plan → campaign diagnosis →
 * experiments), expressed once.
 *
 * Before this file, the same ladder was hand-copied across the home journey
 * map, the workspace rail's "próxima ação" and the product next-step card —
 * and had already drifted: none of the three copies knew the campaign
 * diagnosis needs synced Meta data to say anything useful, so a zero-data
 * beginner could be pointed at a screen whose only possible answer was "não
 * há dados de campanha" — a dead end a 2026-08-05 product review named as the
 * worst moment in the whole journey. `diagnosis` is skipped as a
 * RECOMMENDATION target (never as a destination — it stays one click away
 * everywhere, per the maturity spectrum invariant: value is never gated)
 * until campaign data actually exists; `experiments` absorbs that slot
 * instead, because a launch step or a readiness finding is always trackable
 * there regardless of Meta data.
 */

export type JourneyStage = "context" | "readiness" | "creatives" | "launch" | "diagnosis" | "experiments";

export interface JourneyProgress {
  hasContext: boolean;
  hasReadiness: boolean;
  hasCreativeEvidence: boolean;
  hasLaunchPlan: boolean;
  hasDiagnosis: boolean;
  hasExperiment: boolean;
  /** Synced Meta campaign data exists — decides whether `diagnosis` is a
   *  useful recommendation or a guaranteed "sem dados" dead end. */
  hasCampaignData: boolean;
}

/**
 * The next stage to recommend. `diagnosis` is still a legitimate return value
 * — once campaign data exists (first read, or every subsequent "iterate"
 * loop once every other pillar is also done).
 */
export function nextJourneyStage(progress: JourneyProgress): JourneyStage {
  if (!progress.hasContext) return "context";
  if (!progress.hasReadiness) return "readiness";
  if (!progress.hasCreativeEvidence) return "creatives";
  if (!progress.hasLaunchPlan) return "launch";
  if (progress.hasCampaignData && !progress.hasDiagnosis) return "diagnosis";
  if (!progress.hasExperiment) return "experiments";
  return "diagnosis";
}
