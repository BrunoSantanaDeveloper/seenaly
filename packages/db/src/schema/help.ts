import { boolean, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/**
 * Customer-facing help center content (migration 0014): per-locale rows
 * managed by the superadmin in /admin/help, served publicly at /help.
 */
export const helpCategories = pgTable(
  "help_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locale: text("locale").notNull().default("en"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    sort: integer("sort").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.locale, table.slug)],
);

export const helpArticles = pgTable(
  "help_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => helpCategories.id, { onDelete: "cascade" }),
    locale: text("locale").notNull().default("en"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    bodyMd: text("body_md").notNull().default(""),
    sort: integer("sort").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.locale, table.slug)],
);

export type HelpCategory = typeof helpCategories.$inferSelect;
export type HelpArticle = typeof helpArticles.$inferSelect;
