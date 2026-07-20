import { boolean, date, index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { connections } from "./connectors";
import { organizations } from "./organizations";
import { products } from "./product-context";
import { profiles } from "./profiles";

/**
 * Structured output of the diagnostic engine (docs/PRODUCT.md phase 3).
 * Mirrors migration 0012_diagnoses.sql. A diagnosis never requires campaign
 * data: `hadCampaignData = false` + `insufficientData = true` is the valid
 * cold-start outcome for a zero-data beginner.
 */
export const diagnoses = pgTable(
  "diagnoses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => connections.id, { onDelete: "set null" }),

    scope: text("scope").notNull().default("product"),
    campaignId: text("campaign_id"),

    assistantSlug: text("assistant_slug"),
    model: text("model"),

    output: jsonb("output").notNull(),

    confidence: text("confidence"),
    insufficientData: boolean("insufficient_data").notNull().default(false),

    hadCampaignData: boolean("had_campaign_data").notNull().default(false),
    dataWindowStart: date("data_window_start"),
    dataWindowEnd: date("data_window_end"),
    knowledgeRefs: jsonb("knowledge_refs").notNull().default([]),

    // Review loop (migration 0026): when to re-read + when the reminder fired.
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    reviewNotifiedAt: timestamp("review_notified_at", { withTimezone: true }),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("diagnoses_org_idx").on(table.orgId),
    index("diagnoses_product_created_idx").on(table.productId, table.createdAt),
  ],
);

export type Diagnosis = typeof diagnoses.$inferSelect;

/**
 * Usefulness feedback on a diagnosis (migration 0026), mirroring the Organic
 * module's recommendation feedback. One rating per user per diagnosis.
 */
export const diagnosisFeedback = pgTable(
  "diagnosis_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    diagnosisId: uuid("diagnosis_id")
      .notNull()
      .references(() => diagnoses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    rating: text("rating").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("diagnosis_feedback_org_idx").on(table.orgId, table.createdAt),
    unique("diagnosis_feedback_diagnosis_user_key").on(table.diagnosisId, table.userId),
  ],
);

export type DiagnosisFeedback = typeof diagnosisFeedback.$inferSelect;
