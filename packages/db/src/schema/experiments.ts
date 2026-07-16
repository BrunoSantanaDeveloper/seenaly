import { date, index, numeric, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { creatives } from "./creatives";
import { diagnoses } from "./diagnoses";
import { organizations } from "./organizations";
import { products } from "./product-context";
import { profiles } from "./profiles";

/**
 * Experiment memory (docs/PRODUCT.md — the key differentiator). Mirrors
 * migration 0014_experiments.sql plus the Organic Growth context added by
 * 0024. Concluded experiments feed back into the diagnosis brief so the
 * engine builds on prior learning.
 */
export const experiments = pgTable(
  "experiments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    diagnosisId: uuid("diagnosis_id").references(() => diagnoses.id, { onDelete: "set null" }),

    title: text("title").notNull(),
    status: text("status").notNull().default("planned"),

    hypothesis: text("hypothesis"),
    changeMade: text("change_made"),
    reason: text("reason"),
    platform: text("platform"),
    audience: text("audience"),
    variableTested: text("variable_tested"),
    successCriterion: text("success_criterion"),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    budget: numeric("budget"),
    primaryMetric: text("primary_metric"),
    secondaryMetric: text("secondary_metric"),
    result: text("result"),
    conclusion: text("conclusion"),
    nextStep: text("next_step"),
    notes: text("notes"),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("experiments_org_idx").on(table.orgId),
    index("experiments_product_idx").on(table.productId, table.status),
    index("experiments_diagnosis_idx").on(table.diagnosisId),
  ],
);

export const experimentCreatives = pgTable(
  "experiment_creatives",
  {
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    creativeId: uuid("creative_id")
      .notNull()
      .references(() => creatives.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.experimentId, table.creativeId] })],
);

export type Experiment = typeof experiments.$inferSelect;
