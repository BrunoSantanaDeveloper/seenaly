import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizations } from "./organizations";
import { products } from "./product-context";
import { profiles } from "./profiles";

/**
 * Declared structural profile of a product (docs/PRODUCT.md phase 7 — the
 * readiness layer). Mirrors migration 0028_readiness.sql.
 *
 * Every boolean means "the user CONFIRMED this is done". Unchecked is
 * deliberately ambiguous — not done OR not known — and the engine treats it as
 * unconfirmed rather than absent. That ambiguity is honest and itself
 * diagnostic: not knowing whether the pixel fires IS the finding.
 *
 * The verdict produced from this profile is stored in `diagnoses` with
 * `scope = 'readiness'` — readiness is a mode of the one engine, not a second one.
 */
export const productReadiness = pgTable(
  "product_readiness",
  {
    productId: uuid("product_id")
      .primaryKey()
      .references(() => products.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Mensuração — highest leverage, zero cost. No signal, no learning.
    pixelInstalled: boolean("pixel_installed").notNull().default(false),
    capiInstalled: boolean("capi_installed").notNull().default(false),
    conversionEventTested: boolean("conversion_event_tested").notNull().default(false),
    analyticsInstalled: boolean("analytics_installed").notNull().default(false),

    // Página e oferta
    pageHasProof: boolean("page_has_proof").notNull().default(false),
    pageMobileTested: boolean("page_mobile_tested").notNull().default(false),
    pageFast: boolean("page_fast").notNull().default(false),
    hasGuarantee: boolean("has_guarantee").notNull().default(false),
    guaranteeDays: integer("guarantee_days"),

    // Checkout — own | platform | link | none
    checkoutType: text("checkout_type"),
    paymentPix: boolean("payment_pix").notNull().default(false),
    paymentCard: boolean("payment_card").notNull().default(false),
    checkoutShort: boolean("checkout_short").notNull().default(false),
    abandonedRecovery: boolean("abandoned_recovery").notNull().default(false),

    // Descoberta — SEO + organic presence, the pre-condition of paid acquisition.
    seoBasics: boolean("seo_basics").notNull().default(false),
    indexable: boolean("indexable").notNull().default(false),
    sitemapRobots: boolean("sitemap_robots").notNull().default(false),
    structuredData: boolean("structured_data").notNull().default(false),
    socialProfiles: boolean("social_profiles").notNull().default(false),
    organicContent: boolean("organic_content").notNull().default(false),

    // Retenção e funil
    emailCapture: boolean("email_capture").notNull().default(false),
    emailFollowup: boolean("email_followup").notNull().default(false),
    remarketingAudience: boolean("remarketing_audience").notNull().default(false),

    extra: jsonb("extra").notNull().default({}),

    updatedBy: uuid("updated_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("product_readiness_org_idx").on(table.orgId)],
);

export type ProductReadiness = typeof productReadiness.$inferSelect;
