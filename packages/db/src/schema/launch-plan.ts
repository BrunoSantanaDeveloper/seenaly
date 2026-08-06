import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { products } from "./product-context";
import { profiles } from "./profiles";

/**
 * At-most-one-generation-in-flight lock for the Launch Plan engine
 * (docs/PRODUCT.md phase 9). Mirrors `readiness_run_locks` (migration 0040)
 * exactly, renamed: a generation is a billed LLM call, so two tabs must not
 * be able to pay for two plans. Mirrors migration 0046_launch_plan.sql.
 *
 * RLS is enabled with NO policies — `claim_launch_plan_run` /
 * `release_launch_plan_run` (both SECURITY DEFINER) are the only access path.
 */
export const launchPlanRunLocks = pgTable("launch_plan_run_locks", {
  productId: uuid("product_id")
    .primaryKey()
    .references(() => products.id, { onDelete: "cascade" }),
  lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
  lockedBy: uuid("locked_by").references(() => profiles.id, { onDelete: "set null" }),
});

export type LaunchPlanRunLock = typeof launchPlanRunLocks.$inferSelect;
