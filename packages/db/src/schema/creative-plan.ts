import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { creatives } from "./creatives";
import { diagnoses } from "./diagnoses";
import { organizations } from "./organizations";
import { profiles } from "./profiles";

/**
 * Creative Test Plan lineage (docs/PRODUCT.md phase 8). Mirrors migration
 * 0033_creative_plan.sql. A plan is a `diagnoses` row (scope='creative_plan');
 * this table records which hypothesis materialized into which library creative.
 * The unique (diagnosis_id, hypothesis_key) pair is the idempotency guarantee.
 */
export const creativePlanLinks = pgTable(
  "creative_plan_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    diagnosisId: uuid("diagnosis_id")
      .notNull()
      .references(() => diagnoses.id, { onDelete: "cascade" }),
    hypothesisKey: text("hypothesis_key").notNull(),
    creativeId: uuid("creative_id")
      .notNull()
      .references(() => creatives.id, { onDelete: "cascade" }),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("creative_plan_links_hypothesis_uq").on(table.diagnosisId, table.hypothesisKey),
    index("creative_plan_links_org_idx").on(table.orgId),
    index("creative_plan_links_creative_idx").on(table.creativeId),
  ],
);

export type CreativePlanLink = typeof creativePlanLinks.$inferSelect;
