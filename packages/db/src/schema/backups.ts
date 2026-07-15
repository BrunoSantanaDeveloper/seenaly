import { bigint, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * One row per backup run (migration 0017). Written exclusively by
 * packages/backup over DATABASE_URL; the superadmin reads the history
 * in /admin/backups via RLS.
 */
export const backupRuns = pgTable("backup_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull().default("running"),
  triggeredBy: text("triggered_by").notNull().default("manual"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  tableCount: integer("table_count").notNull().default(0),
  rowCount: bigint("row_count", { mode: "number" }).notNull().default(0),
  totalBytes: bigint("total_bytes", { mode: "number" }).notNull().default(0),
  /** Folder inside the `backups` bucket holding this run's files (= run id). */
  storagePrefix: text("storage_prefix"),
  error: text("error"),
});

export type BackupRun = typeof backupRuns.$inferSelect;
export type NewBackupRun = typeof backupRuns.$inferInsert;
