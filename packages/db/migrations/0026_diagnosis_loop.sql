-- ============================================================
-- 0026_diagnosis_loop: close the diagnosis learning loop.
--
-- Two gaps this fills (docs analysis 2026-07-19):
--   1. Usefulness feedback on core diagnoses — the engine could not measure its
--      own quality (the Organic module already had this; the core did not).
--   2. A machine-readable review-due timestamp so a cron can bring the user
--      back when it is time to re-read a diagnosis, instead of relying on them
--      remembering. `next_review` was free text only.
--
-- Marker for scripts/apply-migrations.mjs = create table public.diagnosis_feedback.
-- ============================================================

-- ---------- Usefulness feedback (mirrors organic_recommendation_feedback) ----------

create table public.diagnosis_feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  diagnosis_id uuid not null references public.diagnoses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating text not null check (rating in ('useful', 'not_useful', 'incorrect')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One rating per user per diagnosis — the upsert conflict target.
  unique (diagnosis_id, user_id)
);

create index diagnosis_feedback_org_idx on public.diagnosis_feedback (org_id, created_at desc);

-- ---------- Review-due tracking on diagnoses ----------

alter table public.diagnoses
  -- When to re-read this diagnosis (now() + output.next_review_days at insert).
  add column next_review_at timestamptz,
  -- Stamped once the review reminder fires (also stamped when a newer diagnosis
  -- supersedes this one), so the cron never notifies twice.
  add column review_notified_at timestamptz;

-- The cron scans for due, not-yet-notified rows — keep that scan cheap.
create index diagnoses_review_due_idx on public.diagnoses (next_review_at)
  where next_review_at is not null and review_notified_at is null;

-- ---------- RLS ----------

-- Guard: the diagnosis being rated actually belongs to the claimed org.
create or replace function public.diagnosis_belongs_to_org(target_org uuid, target_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_org_member(target_org)
    and exists (select 1 from public.diagnoses d where d.id = target_id and d.org_id = target_org);
$$;

alter table public.diagnosis_feedback enable row level security;

create policy "diagnosis_feedback_select" on public.diagnosis_feedback for select to authenticated
  using (public.is_org_member(org_id));
create policy "diagnosis_feedback_insert" on public.diagnosis_feedback for insert to authenticated
  with check (
    public.is_org_member(org_id)
    and user_id = auth.uid()
    and public.diagnosis_belongs_to_org(org_id, diagnosis_id)
  );
create policy "diagnosis_feedback_update" on public.diagnosis_feedback for update to authenticated
  using (public.is_org_member(org_id) and user_id = auth.uid())
  with check (
    public.is_org_member(org_id)
    and user_id = auth.uid()
    and public.diagnosis_belongs_to_org(org_id, diagnosis_id)
  );
create policy "diagnosis_feedback_delete" on public.diagnosis_feedback for delete to authenticated
  using (public.is_org_member(org_id) and user_id = auth.uid());

create trigger diagnosis_feedback_updated_at before update on public.diagnosis_feedback
  for each row execute function public.set_updated_at();
