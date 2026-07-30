/**
 * Shared loader for a product's creative evidence (library + organic linkage).
 *
 * Server-only but deliberately NOT a "use server" file — it takes the Supabase
 * client as an argument and must never be a callable action. Moved out of
 * creatives/plan-actions.ts so the readiness engine can read the same evidence
 * (its `midia` dimension was blind to the library before this).
 */

import type { PlanCreativeRow } from "./brief";

import type { createClient } from "@flyee/auth/server";

/**
 * Load the library + its organic linkage for a product — the shared shape the
 * plan brief, the paid diagnosis evidence block and the readiness brief read.
 */
export async function loadCreativeEvidence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
): Promise<PlanCreativeRow[]> {
  const { data: creativeRows } = await supabase
    .from("creatives")
    .select("id, name, status, source, format, angle, hook, promise, proof_type, emotion, funnel_stage, result_summary")
    .eq("product_id", productId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(60);
  const rows = (creativeRows ?? []) as (Omit<PlanCreativeRow, "organic_count"> & { id: string })[];
  if (rows.length === 0) return [];

  // Publication counts per creative. Counts, deliberately not metrics — the
  // cross-network invariant lives in the brief builders.
  const { data: links } = await supabase
    .from("organic_content_items")
    .select("creative_id")
    .in(
      "creative_id",
      rows.map((row) => row.id),
    )
    .limit(1000);
  const counts = new Map<string, number>();
  for (const link of (links ?? []) as { creative_id: string | null }[]) {
    if (!link.creative_id) continue;
    counts.set(link.creative_id, (counts.get(link.creative_id) ?? 0) + 1);
  }
  return rows.map(({ id, ...row }) => ({ ...row, organic_count: counts.get(id) ?? 0 }));
}
