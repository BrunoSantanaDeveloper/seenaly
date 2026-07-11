import { boolean, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { profiles } from "./profiles";

export const blogCommentStatus = pgEnum("blog_comment_status", ["pending", "approved", "rejected"]);

/** Public blog posts (migration 0015): superadmin-authored, per-locale. */
export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locale: text("locale").notNull().default("en"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    bodyMd: text("body_md").notNull().default(""),
    coverUrl: text("cover_url"),
    authorName: text("author_name"),
    tags: text("tags").array().notNull().default([]),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.locale, table.slug)],
);

/** Moderated comments: pending until the superadmin approves. */
export const blogComments = pgTable("blog_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .notNull()
    .references(() => blogPosts.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  authorName: text("author_name"),
  body: text("body").notNull(),
  status: blogCommentStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type BlogComment = typeof blogComments.$inferSelect;
