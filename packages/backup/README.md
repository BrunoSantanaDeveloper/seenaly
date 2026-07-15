# @flyee/backup

Automatic **logical** database backups for the template.

`runBackup()` discovers every table in the `public` schema at runtime (so a
derived project's tables are included automatically), streams each table's rows
to gzipped **JSONL**, and uploads them to the private `backups` storage bucket
under `<run-id>/<table>.jsonl.gz`. Each run is recorded in `backup_runs`
(migration `0023_backups.sql`) with status, table/row counts, size and duration.

## How it runs

- **Nightly cron** — `backupCronFunction` fires at `03:00 UTC` (Inngest).
- **On demand** — the superadmin clicks *Run backup now* in `/admin/backups`,
  which sends `backup/run.requested`. Without Inngest keys the console falls
  back to running the export inline (bounded by the serverless function
  timeout — fine for template-scale data, not a large production DB).
- **Retention** — after each successful run, runs (rows + archives) older than
  `BACKUP_RETENTION_DAYS` (default 30) are pruned.

Register the jobs by spreading `backupFunctions` into the Inngest `serve()` call
(`apps/web/src/app/api/inngest/route.ts`).

## Configuration

| Env | Purpose |
| --- | --- |
| `DATABASE_URL` | Direct Postgres connection the export reads from. |
| `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` | Writes archives to / signs downloads from the private bucket. |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Run backups as a background job instead of inline. |
| `BACKUP_RETENTION_DAYS` | Days to keep runs before pruning (default 30). |

Without `DATABASE_URL` or the service key, `runBackup()` returns
`{ ok: false, hint }` and the console shows the hint — a fresh clone never
crashes.

## Scope — read this

This is a **data** backup (rows as JSONL), meant for operational visibility and
quick recovery of table contents. It does **not** capture DDL (schema, indexes,
policies, functions), roles, or storage objects. It is **not** a disaster-recovery
solution on its own: keep Supabase's native daily backups / PITR as the real DR
layer. Think of this as a portable, downloadable, self-hosted-in-your-bucket copy
of the data on top of that.
