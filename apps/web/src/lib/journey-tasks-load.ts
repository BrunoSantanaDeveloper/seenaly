/**
 * Fetch everything `buildJourneyTasks` needs, from either side of the wire.
 *
 * The queue has TWO consumers now (2026-08-07 review): the Home card and the
 * workspace rail, where it has to travel with the user instead of waiting for
 * them to come back to Home. Both need identical data, so the loading lives
 * here once and takes the client as an argument — `@flyee/auth/server` in the
 * product layout (RSC), `@flyee/auth/client` on the Home page.
 *
 * RLS is the access boundary in both cases; this module adds none of its own.
 * Every read is scoped to one product the caller already resolved.
 */

import { isCreativePlanOutput } from "./creative-plan/schema";
import { buildJourneyTasks, type JourneyTask, type JourneyTasksInput } from "./journey-tasks";
import { isLaunchPlanOutput } from "./launch-plan/schema";
import { toReadinessProfile } from "./readiness/checklist";
import { isReadinessOutput } from "./readiness/schema";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface JourneyTasksResult {
  tasks: JourneyTask[];
  /**
   * Whether any engine output exists at all. It separates "nothing to do" from
   * "nothing generated yet" — the difference between a congratulation and a
   * first-run invitation, and the two must never be rendered the same way.
   */
  known: boolean;
}

const EMPTY: JourneyTasksResult = { tasks: [], known: false };

/** Latest row of one scope for this product, or null. */
async function latest(supabase: SupabaseClient, productId: string, scope: string) {
  const { data } = await supabase
    .from("diagnoses")
    .select("id, output")
    .eq("product_id", productId)
    .eq("scope", scope)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string; output: unknown } | null) ?? null;
}

export async function loadJourneyTasks(
  supabase: SupabaseClient,
  productId: string,
  workspace: boolean,
): Promise<JourneyTasksResult> {
  const [readinessRow, creativePlanRow, launchPlanRow] = await Promise.all([
    latest(supabase, productId, "readiness"),
    latest(supabase, productId, "creative_plan"),
    latest(supabase, productId, "launch_plan"),
  ]);

  let readiness: JourneyTasksInput["readiness"] = null;
  if (readinessRow && isReadinessOutput(readinessRow.output)) {
    const [{ data: profileRow }, { data: experimentRows }] = await Promise.all([
      supabase.from("product_readiness").select("*").eq("product_id", productId).maybeSingle(),
      supabase.from("experiments").select("change_made").eq("diagnosis_id", readinessRow.id),
    ]);
    readiness = {
      verdictId: readinessRow.id,
      output: readinessRow.output,
      profile: toReadinessProfile(profileRow as Record<string, unknown> | null),
      registeredChangeMade: new Set(
        ((experimentRows ?? []) as { change_made: string | null }[])
          .map((row) => row.change_made)
          .filter((value): value is string => Boolean(value)),
      ),
    };
  }

  let creativePlan: JourneyTasksInput["creativePlan"] = null;
  if (creativePlanRow && isCreativePlanOutput(creativePlanRow.output)) {
    const { data: links } = await supabase
      .from("creative_plan_links")
      .select("hypothesis_key, creative_id")
      .eq("diagnosis_id", creativePlanRow.id);
    const linkRows = (links ?? []) as { hypothesis_key: string; creative_id: string }[];
    const creativeIds = linkRows.map((link) => link.creative_id);
    const publishedCount: Record<string, number> = {};
    if (creativeIds.length > 0) {
      const { data: publications } = await supabase
        .from("organic_content_items")
        .select("creative_id")
        .in("creative_id", creativeIds)
        .limit(1000);
      const counts = new Map<string, number>();
      for (const publication of (publications ?? []) as { creative_id: string | null }[]) {
        if (!publication.creative_id) continue;
        counts.set(publication.creative_id, (counts.get(publication.creative_id) ?? 0) + 1);
      }
      for (const link of linkRows) publishedCount[link.hypothesis_key] = counts.get(link.creative_id) ?? 0;
    }
    creativePlan = { output: creativePlanRow.output, publishedCount };
  }

  let launchPlan: JourneyTasksInput["launchPlan"] = null;
  if (launchPlanRow && isLaunchPlanOutput(launchPlanRow.output)) {
    const { data: experimentRows } = await supabase
      .from("experiments")
      .select("change_made")
      .eq("diagnosis_id", launchPlanRow.id);
    const registeredStepKeys = new Set<string>();
    for (const row of (experimentRows ?? []) as { change_made: string | null }[]) {
      // Same anchor `registerExperimentFromLaunchStep` writes.
      const match = /^Etapa do lançamento \[([^\]]+)\]/.exec(row.change_made ?? "");
      if (match) registeredStepKeys.add(match[1]);
    }
    launchPlan = { output: launchPlanRow.output, registeredStepKeys };
  }

  if (!readiness && !creativePlan && !launchPlan) return EMPTY;
  return {
    tasks: buildJourneyTasks({ productId, workspace, readiness, creativePlan, launchPlan }),
    known: true,
  };
}
