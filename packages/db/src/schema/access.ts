import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { profiles } from "./profiles";

/**
 * Sign-in trail (migration 0016): one row per new auth session, written
 * by a security-definer trigger on auth.sessions. Users read their own
 * history; the superadmin reads everything. Append-only — no client
 * writes exist.
 */
export const accessEvents = pgTable("access_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  ip: text("ip"),
  userAgent: text("user_agent"),
  /** Assurance level at session creation: aal1 (password/OAuth) or aal2 (after 2FA). */
  aal: text("aal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AccessEvent = typeof accessEvents.$inferSelect;
export type NewAccessEvent = typeof accessEvents.$inferInsert;
