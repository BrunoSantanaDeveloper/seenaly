-- ============================================================
-- 0015_funnel: the funnel & real-sales layer (docs/PRODUCT.md pillar 3) —
-- what Meta does not know on its own. Each row is one funnel snapshot for a
-- product over a period: visits → checkout initiated → purchases, plus
-- refunds, pending (boleto/Pix), upsells and net revenue.
--
-- Why it matters: this is exactly the data the diagnosis engine keeps asking
-- for in `missing_data` to separate PAGE (people don't advance) from CHECKOUT
-- (advance and abandon) from OFFER/PRICE. With it, the engine stops guessing.
--
-- v1 is MANUAL entry (the own-checkout launch cut, and the zero-integration
-- beginner path). Platform integrations (Hotmart/Kiwify/webhooks) can later
-- write snapshots into this same table — an enrichment, never a prerequisite.
-- Org-scoped, hung off a product; RLS mirrors products (members read+manage).
-- ============================================================

create table public.funnel_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,

  -- Optional human label (campaign, week...). Period is the real key.
  label text,
  period_start date,
  period_end date,
  -- Where the numbers came from (e.g. "checkout próprio", "Hotmart"). Informational.
  source text,

  -- The funnel stages (counts). All optional — a beginner fills what they have.
  visits bigint,
  checkout_initiated bigint,
  purchases bigint,
  refunds bigint,
  pending bigint,
  upsells bigint,

  gross_revenue numeric,
  net_revenue numeric,
  notes text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index funnel_snapshots_org_idx on public.funnel_snapshots (org_id);
create index funnel_snapshots_product_idx on public.funnel_snapshots (product_id, period_end desc);

-- ---------- RLS: any org member reads and manages (workspace data) ----------

alter table public.funnel_snapshots enable row level security;

create policy "funnel_snapshots_select" on public.funnel_snapshots for select to authenticated
  using (public.is_org_member(org_id));
create policy "funnel_snapshots_insert" on public.funnel_snapshots for insert to authenticated
  with check (public.is_org_member(org_id));
create policy "funnel_snapshots_update" on public.funnel_snapshots for update to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
create policy "funnel_snapshots_delete" on public.funnel_snapshots for delete to authenticated
  using (public.is_org_member(org_id));

create trigger funnel_snapshots_updated_at before update on public.funnel_snapshots
  for each row execute function public.set_updated_at();
