/**
 * Which due diagnoses actually deserve a reminder — pure, so the whole
 * decision is unit-testable (the cron around it is trivial glue).
 *
 * The bug this fixes: the cron grouped by product_id ONLY, so a newer
 * CAMPAIGN diagnosis silently suppressed a due READINESS reminder as
 * "superseded" (and vice versa). Supersession is only meaningful within the
 * same product AND the same scope — a structural audit and a media diagnosis
 * are different conversations about the same product.
 */

export interface DueReviewRow {
  id: string;
  product_id: string;
  scope: string;
  org_id: string;
  created_by: string | null;
  created_at: string;
}

export interface LatestRow {
  id: string;
  product_id: string;
  scope: string;
  created_at: string;
}

/**
 * Both inputs are expected newest-first (the cron already orders them).
 * Picks the most recent due row per `${product_id}::${scope}` and drops it
 * when a NEWER row of the same product+scope exists — the user already moved
 * on, don't nag about the older one.
 */
export function selectDueReviewTargets(due: DueReviewRow[], latest: LatestRow[]): DueReviewRow[] {
  const currentByKey = new Map<string, DueReviewRow>();
  for (const row of due) {
    const key = `${row.product_id}::${row.scope}`;
    if (!currentByKey.has(key)) currentByKey.set(key, row);
  }

  const latestIdByKey = new Map<string, string>();
  for (const row of latest) {
    const key = `${row.product_id}::${row.scope}`;
    if (!latestIdByKey.has(key)) latestIdByKey.set(key, row.id);
  }

  const selected: DueReviewRow[] = [];
  for (const [key, row] of currentByKey) {
    if (latestIdByKey.get(key) !== row.id) continue; // superseded within its own scope
    selected.push(row);
  }
  return selected;
}
