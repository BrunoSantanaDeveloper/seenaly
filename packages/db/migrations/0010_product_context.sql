-- ============================================================
-- 0010_product_context: the product context model — the HEART of the
-- product (docs/PRODUCT.md, principle #1 and #6). Org-scoped offer,
-- economics, positioning and funnel context. Fully independent of any
-- Meta Ads connection: a beginner with zero campaigns fills this in and
-- the diagnostic engine already has something to reason with.
-- Optional bridge to synced data via connection_id + meta_account_id.
-- RLS: any org member reads AND manages (core collaborative workspace data).
-- ============================================================

create table public.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  description text,

  -- ---- Economics (all optional; the beginner fills these over time) ----
  currency text,
  price numeric,
  unit_cost numeric,
  margin_pct numeric,
  avg_ticket numeric,
  ltv numeric,
  -- Maximum acceptable CAC — the guardrail every recommendation respects.
  target_cac numeric,
  monthly_budget numeric,

  -- ---- Positioning & funnel ----
  -- What the campaign should optimize for (e.g. Purchase, Lead, Subscribe).
  conversion_type text,
  -- Which funnel stage this offer targets (awareness / consideration / conversion...).
  funnel_stage text,
  audience text,
  main_promise text,
  landing_page_url text,
  landing_conversion_rate numeric,
  -- The optimization event configured on the ad set, when known.
  optimization_event text,
  notes text,

  -- ---- Optional bridge to synced Meta data (never required) ----
  connection_id uuid references public.connections (id) on delete set null,
  meta_account_id text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_org_idx on public.products (org_id);
create index products_connection_idx on public.products (connection_id);

-- ---------- Child lists: objections and proofs ----------

-- Objections the offer must overcome (positioning input for creatives/copy).
create table public.product_objections (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_objections_product_idx on public.product_objections (product_id);

-- Proofs available to support the promise (testimonials, results, guarantees...).
create table public.product_proofs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  kind text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_proofs_product_idx on public.product_proofs (product_id);

-- ---------- RLS ----------

-- Membership check reused by the child tables' policies.
create or replace function public.is_product_member(target_product uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.products p
    where p.id = target_product and public.is_org_member(p.org_id)
  );
$$;

alter table public.products enable row level security;
alter table public.product_objections enable row level security;
alter table public.product_proofs enable row level security;

-- Products: any org member can read and manage (core workspace data).
create policy "products_select" on public.products for select to authenticated
  using (public.is_org_member(org_id));
create policy "products_insert" on public.products for insert to authenticated
  with check (public.is_org_member(org_id));
create policy "products_update" on public.products for update to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
create policy "products_delete" on public.products for delete to authenticated
  using (public.is_org_member(org_id));

create policy "product_objections_select" on public.product_objections for select to authenticated
  using (public.is_product_member(product_id));
create policy "product_objections_insert" on public.product_objections for insert to authenticated
  with check (public.is_product_member(product_id));
create policy "product_objections_update" on public.product_objections for update to authenticated
  using (public.is_product_member(product_id))
  with check (public.is_product_member(product_id));
create policy "product_objections_delete" on public.product_objections for delete to authenticated
  using (public.is_product_member(product_id));

create policy "product_proofs_select" on public.product_proofs for select to authenticated
  using (public.is_product_member(product_id));
create policy "product_proofs_insert" on public.product_proofs for insert to authenticated
  with check (public.is_product_member(product_id));
create policy "product_proofs_update" on public.product_proofs for update to authenticated
  using (public.is_product_member(product_id))
  with check (public.is_product_member(product_id));
create policy "product_proofs_delete" on public.product_proofs for delete to authenticated
  using (public.is_product_member(product_id));

-- ---------- updated_at maintenance ----------

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger product_objections_updated_at before update on public.product_objections
  for each row execute function public.set_updated_at();
create trigger product_proofs_updated_at before update on public.product_proofs
  for each row execute function public.set_updated_at();
