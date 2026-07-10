-- ============================================================
-- 0013_creatives: the tagged creative library (docs/PRODUCT.md, pillar 4).
--
-- The goal is to know WHY a creative performed, not just which one did — so
-- every creative carries the diagnostic taxonomy (hook/angle/proof + the tag
-- dimensions). A creative is either `planned` (entered by hand — the beginner
-- briefs and tags creatives before any campaign exists, per the maturity
-- invariant) or `synced` (linked to a row the Meta connector pulled into
-- meta_creatives). Winning-pattern analysis (tag × performance) comes later,
-- when synced insights exist; v1 is the library + its use in diagnosis.
-- Org-scoped, hung off a product; RLS mirrors products (members read+manage).
-- ============================================================

create table public.creatives (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,

  name text not null,
  -- Creative-testing lifecycle, not a generic status.
  status text not null default 'idea' check (status in ('idea', 'testing', 'winner', 'paused', 'archived')),
  -- 'planned' = manually briefed; 'synced' = mirrored from meta_creatives.
  source text not null default 'planned' check (source in ('planned', 'synced')),

  -- Optional bridge to synced Meta data (never required).
  connection_id uuid references public.connections (id) on delete set null,
  meta_creative_id text,

  -- ---- Structured dimensions (filtering + lifecycle) ----
  format text,
  funnel_stage text,
  duration_seconds integer,
  thumbnail_url text,

  -- ---- The diagnostic taxonomy: the "why" (all optional free text) ----
  angle text,
  promise text,
  pain text,
  desire text,
  objection text,
  hook text,
  first_scene text,
  cta text,
  proof_type text,
  visual_style text,
  emotion text,
  presumed_audience text,

  -- The reusable learning once the creative has run (qualitative; quantitative
  -- comes from the linked meta_creatives → insights when synced).
  result_summary text,
  notes text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index creatives_org_idx on public.creatives (org_id);
create index creatives_product_idx on public.creatives (product_id);
create index creatives_status_idx on public.creatives (product_id, status);

-- ---------- RLS: any org member reads and manages (workspace data) ----------

alter table public.creatives enable row level security;

create policy "creatives_select" on public.creatives for select to authenticated
  using (public.is_org_member(org_id));
create policy "creatives_insert" on public.creatives for insert to authenticated
  with check (public.is_org_member(org_id));
create policy "creatives_update" on public.creatives for update to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
create policy "creatives_delete" on public.creatives for delete to authenticated
  using (public.is_org_member(org_id));

create trigger creatives_updated_at before update on public.creatives
  for each row execute function public.set_updated_at();
