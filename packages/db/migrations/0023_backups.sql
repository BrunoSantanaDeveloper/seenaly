-- ============================================================
-- 0023_backups: automatic logical database backups.
-- packages/backup exports every public table to JSONL.gz files in
-- the private `backups` bucket (daily Inngest cron + manual runs
-- from /admin/backups); each run is recorded in backup_runs.
-- This complements — never replaces — Supabase's native backups
-- and PITR, which remain the disaster-recovery layer.
-- ============================================================

create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  triggered_by text not null default 'manual' check (triggered_by in ('cron', 'manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  table_count integer not null default 0,
  row_count bigint not null default 0,
  total_bytes bigint not null default 0,
  -- Folder inside the `backups` bucket holding this run's files (= run id).
  storage_prefix text,
  error text
);

create index backup_runs_started_idx on public.backup_runs (started_at desc);

-- ---------- RLS ----------

alter table public.backup_runs enable row level security;

-- Superadmin reads the history in /admin/backups; all writes happen over
-- DATABASE_URL (postgres role, bypasses RLS) inside packages/backup — no
-- client write policies exist.
create policy "backup_runs_select_superadmin" on public.backup_runs
  for select to authenticated
  using (public.is_superadmin());

-- ---------- Private storage bucket ----------

-- No storage.objects policies on purpose: only the service role (which
-- bypasses RLS) writes archives and signs download URLs.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;
