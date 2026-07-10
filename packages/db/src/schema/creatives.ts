import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { connections } from "./connectors";
import { organizations } from "./organizations";
import { products } from "./product-context";
import { profiles } from "./profiles";

/**
 * Tagged creative library (docs/PRODUCT.md pillar 4). Mirrors migration
 * 0013_creatives.sql. Every creative carries the diagnostic taxonomy so the
 * engine can reason about WHY winners won. `planned` = manually briefed (cold
 * start); `synced` = linked to meta_creatives via connectionId/metaCreativeId.
 */
export const creatives = pgTable(
  "creatives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    status: text("status").notNull().default("idea"),
    source: text("source").notNull().default("planned"),

    connectionId: uuid("connection_id").references(() => connections.id, { onDelete: "set null" }),
    metaCreativeId: text("meta_creative_id"),

    format: text("format"),
    funnelStage: text("funnel_stage"),
    durationSeconds: integer("duration_seconds"),
    thumbnailUrl: text("thumbnail_url"),

    angle: text("angle"),
    promise: text("promise"),
    pain: text("pain"),
    desire: text("desire"),
    objection: text("objection"),
    hook: text("hook"),
    firstScene: text("first_scene"),
    cta: text("cta"),
    proofType: text("proof_type"),
    visualStyle: text("visual_style"),
    emotion: text("emotion"),
    presumedAudience: text("presumed_audience"),

    resultSummary: text("result_summary"),
    notes: text("notes"),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("creatives_org_idx").on(table.orgId),
    index("creatives_product_idx").on(table.productId),
    index("creatives_status_idx").on(table.productId, table.status),
  ],
);

export type Creative = typeof creatives.$inferSelect;
