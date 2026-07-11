import { integer, jsonb, pgTable, smallint, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";

import { organizations } from "./organizations";
import { profiles } from "./profiles";

export const knowledgeCollections = pgTable("knowledge_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  // null = global collection (superadmin-managed).
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectionId: uuid("collection_id")
    .notNull()
    .references(() => knowledgeCollections.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  source: text("source"),
  // 1 (most authoritative) .. 5 (unverified opinion).
  trustLevel: smallint("trust_level").notNull().default(5),
  content: text("content").notNull(),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  metadata: jsonb("metadata").notNull().default({}),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  content: text("content").notNull(),
  // Gemini gemini-embedding-001, truncated to 768 dims (embeddings.ts).
  embedding: vector("embedding", { dimensions: 768 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KnowledgeCollection = typeof knowledgeCollections.$inferSelect;
export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
