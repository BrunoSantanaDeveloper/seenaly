-- ============================================================
-- 0011_onboarding: activation state for onboarding checklists and
-- setup wizards. STORES ONLY STATE (which steps a user completed,
-- whether they dismissed a flow) — the step DEFINITIONS live in the
-- derived project's code (labels, links, done-predicates). Generic
-- mechanism; the project supplies the domain.
--
-- Powers "completion drive" (Gestalt closure: 3 of 5 done), the one
-- gamification pattern that reliably works — not points/badges/streaks.
-- ============================================================

create table public.onboarding_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Null for purely personal flows; set for org-setup flows.
  org_id uuid references public.organizations (id) on delete cascade,
  -- Slug of the checklist/wizard (a project may run several, e.g.
  -- "user-activation", "org-setup").
  flow text not null,
  -- Completed step keys (the step catalog is defined in code).
  completed_steps jsonb not null default '[]'::jsonb,
  -- User closed the checklist card (it can still be reopened).
  dismissed boolean not null default false,
  -- Set when every required step is done — the "aha / activated" moment.
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (user_id, org_id, flow)
);

create index onboarding_state_user_idx on public.onboarding_state (user_id);

-- ---------- RLS ----------

alter table public.onboarding_state enable row level security;

-- Personal state: users read and write their OWN rows. Org-scoped flows
-- additionally require membership (so a user can't record activation for
-- an org they don't belong to).
create policy "onboarding_select_own" on public.onboarding_state for select to authenticated
  using (user_id = auth.uid() and (org_id is null or public.is_org_member(org_id)));
create policy "onboarding_insert_own" on public.onboarding_state for insert to authenticated
  with check (user_id = auth.uid() and (org_id is null or public.is_org_member(org_id)));
create policy "onboarding_update_own" on public.onboarding_state for update to authenticated
  using (user_id = auth.uid() and (org_id is null or public.is_org_member(org_id)))
  with check (user_id = auth.uid() and (org_id is null or public.is_org_member(org_id)));

-- ---------- updated_at maintenance ----------

create trigger onboarding_state_updated_at
  before update on public.onboarding_state
  for each row execute function public.set_updated_at();
