import { gzipSync } from "node:zlib";
import postgres from "postgres";

import { createServiceClient } from "@flyee/auth/service";

const BUCKET = "backups";
const DEFAULT_RETENTION_DAYS = 30;

export type BackupTrigger = "cron" | "manual";

export type BackupResult =
  | { ok: true; runId: string; tables: number; rows: number; bytes: number }
  | { ok: false; hint: string };

export const isBackupConfigured = () =>
  Boolean(
    process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

/**
 * Export every public table to `<run-id>/<table>.jsonl.gz` in the private
 * `backups` bucket and record the run in backup_runs (migration 0017).
 *
 * This is a LOGICAL DATA backup (rows as JSONL, one file per table) meant
 * for operational visibility and quick data recovery — it does not carry
 * DDL. Supabase's native backups/PITR remain the disaster-recovery layer.
 *
 * Tables are discovered at runtime from information_schema, so a derived
 * project's own tables are included automatically.
 */
export async function runBackup(options: { trigger: BackupTrigger }): Promise<BackupResult> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, hint: "DATABASE_URL is not set — backups read the database directly." };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, hint: "SUPABASE_SERVICE_ROLE_KEY is not set — backups write to the private storage bucket." };
  }

  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const storage = createServiceClient().storage.from(BUCKET);

  let runId: string | null = null;
  try {
    const [run] = await sql`
      insert into backup_runs (status, triggered_by) values ('running', ${options.trigger}) returning id
    `;
    runId = run.id as string;

    const tables = await sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'backup_runs'
      order by table_name
    `;

    let totalRows = 0;
    let totalBytes = 0;
    for (const { table_name: table } of tables) {
      const lines: string[] = [];
      await sql`select * from ${sql(table)}`.cursor(500, async (rows) => {
        for (const row of rows) lines.push(JSON.stringify(row));
      });
      const archive = gzipSync(Buffer.from(lines.join("\n"), "utf8"));
      const { error: uploadError } = await storage.upload(`${runId}/${table}.jsonl.gz`, archive, {
        contentType: "application/gzip",
        upsert: true,
      });
      if (uploadError) throw new Error(`upload ${table}: ${uploadError.message}`);
      totalRows += lines.length;
      totalBytes += archive.byteLength;
    }

    await sql`
      update backup_runs set
        status = 'success',
        finished_at = now(),
        table_count = ${tables.length},
        row_count = ${totalRows},
        total_bytes = ${totalBytes},
        storage_prefix = ${runId}
      where id = ${runId}
    `;

    await pruneOldRuns(sql, storage);

    return { ok: true, runId, tables: tables.length, rows: totalRows, bytes: totalBytes };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId) {
      await sql`
        update backup_runs set status = 'error', finished_at = now(), error = ${message} where id = ${runId}
      `.catch(() => undefined);
    }
    return { ok: false, hint: message };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** Delete runs (rows + archives) older than BACKUP_RETENTION_DAYS (default 30). */
async function pruneOldRuns(
  sql: postgres.Sql,
  storage: ReturnType<ReturnType<typeof createServiceClient>["storage"]["from"]>,
) {
  const days = Number(process.env.BACKUP_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
  const stale = await sql`
    select id, storage_prefix from backup_runs
    where started_at < now() - make_interval(days => ${days})
  `;
  for (const run of stale) {
    if (run.storage_prefix) {
      const { data: files } = await storage.list(run.storage_prefix as string, { limit: 1000 });
      const paths = (files ?? []).map((file) => `${run.storage_prefix}/${file.name}`);
      if (paths.length > 0) await storage.remove(paths);
    }
    await sql`delete from backup_runs where id = ${run.id}`;
  }
}
