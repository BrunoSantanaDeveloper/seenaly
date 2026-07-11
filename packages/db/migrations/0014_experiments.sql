-- ============================================================
-- 0014_experiments: the experiment memory (docs/PRODUCT.md — the key
-- differentiator). Most people run tests and lose the learning. Here every
-- test is recorded as hypothesis → change → reason → period → budget →
-- creatives → metrics → result → conclusion → next step.
--
-- Why it matters: concluded experiments feed BACK into the diagnosis engine's
-- brief, so it stops recommending what was already disproven and builds on
-- what worked — the system becomes an expert in THIS account's products,
-- creatives and offers over time. Optional link to the diagnosis that spawned
-- the test closes the loop (diagnosis → experiment → memory → better diagnosis).
-- Org-scoped, hung off a product; RLS mirrors products (members read+manage).
-- ============================================================

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  -- The diagnosis this test came from, when it was registered from one.
  diagnosis_id uuid references public.diagnoses (id) on delete set null,

  title text not null,
  status text not null default 'planned' check (status in ('planned', 'running', 'concluded', 'abandoned')),

  -- The brief's fields (docs/PRODUCT.md "memória de experimentos").
  hypothesis text,
  change_made text,
  reason text,
  period_start date,
  period_end date,
  budget numeric,
  primary_metric text,
  secondary_metric text,
  result text,
  conclusion text,
  next_step text,
  notes text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index experiments_org_idx on public.experiments (org_id);
create index experiments_product_idx on public.experiments (product_id, status);
create index experiments_diagnosis_idx on public.experiments (diagnosis_id);

-- Which creatives a test involved (many-to-many). Optional.
create table public.experiment_creatives (
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  creative_id uuid not null references public.creatives (id) on delete cascade,
  primary key (experiment_id, creative_id)
);

-- ---------- RLS ----------

create or replace function public.is_experiment_member(target_experiment uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.experiments e
    where e.id = target_experiment and public.is_org_member(e.org_id)
  );
$$;

alter table public.experiments enable row level security;
alter table public.experiment_creatives enable row level security;

create policy "experiments_select" on public.experiments for select to authenticated
  using (public.is_org_member(org_id));
create policy "experiments_insert" on public.experiments for insert to authenticated
  with check (public.is_org_member(org_id));
create policy "experiments_update" on public.experiments for update to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
create policy "experiments_delete" on public.experiments for delete to authenticated
  using (public.is_org_member(org_id));

create policy "experiment_creatives_select" on public.experiment_creatives for select to authenticated
  using (public.is_experiment_member(experiment_id));
create policy "experiment_creatives_insert" on public.experiment_creatives for insert to authenticated
  with check (public.is_experiment_member(experiment_id));
create policy "experiment_creatives_delete" on public.experiment_creatives for delete to authenticated
  using (public.is_experiment_member(experiment_id));

create trigger experiments_updated_at before update on public.experiments
  for each row execute function public.set_updated_at();
