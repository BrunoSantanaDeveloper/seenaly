import { bigint, date, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizations } from "./organizations";
import { products } from "./product-context";
import { profiles } from "./profiles";

/**
 * Funnel & real-sales snapshots (docs/PRODUCT.md pillar 3). Mirrors migration
 * 0015_funnel.sql. Manual v1 (own-checkout cut); platform integrations may
 * later write into the same table. Feeds the diagnosis engine the page →
 * checkout → purchase rates it needs to separate page / checkout / offer.
 */
export const funnelSnapshots = pgTable(
  "funnel_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    label: text("label"),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    source: text("source"),

    visits: bigint("visits", { mode: "number" }),
    /** Trial/free signups — the stage a trial-first funnel converts through. */
    signups: bigint("signups", { mode: "number" }),
    checkoutInitiated: bigint("checkout_initiated", { mode: "number" }),
    purchases: bigint("purchases", { mode: "number" }),
    refunds: bigint("refunds", { mode: "number" }),
    pending: bigint("pending", { mode: "number" }),
    upsells: bigint("upsells", { mode: "number" }),

    grossRevenue: numeric("gross_revenue"),
    netRevenue: numeric("net_revenue"),
    notes: text("notes"),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("funnel_snapshots_org_idx").on(table.orgId),
    index("funnel_snapshots_product_idx").on(table.productId, table.periodEnd),
  ],
);

export type FunnelSnapshot = typeof funnelSnapshots.$inferSelect;
