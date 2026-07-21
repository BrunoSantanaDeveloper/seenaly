import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { connections } from "./connectors";
import { organizations } from "./organizations";
import { profiles } from "./profiles";

/**
 * Product context model — the heart of the product (docs/PRODUCT.md).
 * Org-scoped offer/economics/positioning/funnel. Independent of any Meta
 * connection; the optional connectionId/metaAccountId bridge to synced data.
 * Mirrors migration 0010_product_context.sql.
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    description: text("description"),

    // Economics (all optional).
    currency: text("currency"),
    price: numeric("price"),
    unitCost: numeric("unit_cost"),
    marginPct: numeric("margin_pct"),
    avgTicket: numeric("avg_ticket"),
    ltv: numeric("ltv"),
    targetCac: numeric("target_cac"),
    monthlyBudget: numeric("monthly_budget"),

    // Positioning & funnel.
    conversionType: text("conversion_type"),
    funnelStage: text("funnel_stage"),
    audience: text("audience"),
    mainPromise: text("main_promise"),
    landingPageUrl: text("landing_page_url"),
    landingConversionRate: numeric("landing_conversion_rate"),
    optimizationEvent: text("optimization_event"),
    notes: text("notes"),

    // How the offer is charged (migration 0027). These are INPUT: the economics
    // columns above are derived from them by lib/pricing.ts.
    pricingModel: text("pricing_model"),
    pricingInputs: jsonb("pricing_inputs").notNull().default({}),

    // Optional bridge to synced Meta data (never required).
    connectionId: uuid("connection_id").references(() => connections.id, { onDelete: "set null" }),
    metaAccountId: text("meta_account_id"),

    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("products_org_idx").on(table.orgId),
    index("products_connection_idx").on(table.connectionId),
  ],
);

export const productObjections = pgTable(
  "product_objections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("product_objections_product_idx").on(table.productId)],
);

export const productProofs = pgTable(
  "product_proofs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    kind: text("kind"),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("product_proofs_product_idx").on(table.productId)],
);

/**
 * Repeatable pricing rows (migration 0027): subscription tiers, credit packs
 * or offer-ladder items, depending on `products.pricing_model`.
 */
export const productPlans = pgTable(
  "product_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name"),
    price: numeric("price"),
    /** weekly | monthly | quarterly | semiannual | annual | one_time */
    period: text("period"),
    /** Credits/units in a pack, or units in a ladder item. */
    quantity: numeric("quantity"),
    /** Share of paying customers on this row (0-100) — blended ticket input. */
    sharePct: numeric("share_pct"),
    /** The row the ad anchors on (the advertised / entry offer). */
    isPrimary: boolean("is_primary").notNull().default(false),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("product_plans_product_idx").on(table.productId, table.sort)],
);

export type Product = typeof products.$inferSelect;
export type ProductObjection = typeof productObjections.$inferSelect;
export type ProductProof = typeof productProofs.$inferSelect;
export type ProductPlan = typeof productPlans.$inferSelect;
