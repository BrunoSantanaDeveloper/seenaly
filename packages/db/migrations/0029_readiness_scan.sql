-- ============================================================
-- 0029_readiness_scan: the optional technical scanner (docs/PRODUCT.md phase 7, fase B).
--
-- The readiness verdict works entirely from DECLARED facts (0028). This adds
-- the enrichment tier: fetch the product's page and observe what is actually
-- there — title/meta/canonical/OG, structured data, indexability, sitemap,
-- tracking pixels. Observed facts enter the brief as trust-1 evidence.
--
-- Same invariant as the Meta connector: enrichment, never a gate. A product
-- with no URL, an unreachable site, or a blocked scan still gets a full
-- verdict from the declared checklist.
--
-- Why a table and not columns on product_readiness: scans are a time series
-- ("did my SEO actually improve after I fixed it?"), and an ALTER-only
-- migration derives no marker object for scripts/apply-migrations.mjs.
--
-- Marker for scripts/apply-migrations.mjs = create table public.product_scans.
-- ============================================================

create table public.product_scans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,

  -- What we asked for vs. where we actually landed (redirects are diagnostic:
  -- an http→https or www→apex hop is normal, a chain of five is a finding).
  requested_url text not null,
  final_url text,

  -- A failed scan is a first-class, persisted outcome — never a silent gap.
  -- `ok = false` with an error is a valid row the engine reasons about.
  ok boolean not null default false,
  status_code integer,
  error text,

  -- The full extracted signal set (apps/web/src/lib/readiness/scan-analyze.ts).
  -- Kept as jsonb because the signal list evolves faster than a schema should:
  -- a new check must not require a migration to be captured.
  result jsonb not null default '{}'::jsonb,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index product_scans_product_created_idx on public.product_scans (product_id, created_at desc);
create index product_scans_org_idx on public.product_scans (org_id);

-- ---------- RLS (mirrors product_readiness / product_plans) ----------

alter table public.product_scans enable row level security;

create policy "product_scans_select" on public.product_scans for select to authenticated
  using (public.is_product_member(product_id));
create policy "product_scans_insert" on public.product_scans for insert to authenticated
  with check (public.is_product_member(product_id));
create policy "product_scans_delete" on public.product_scans for delete to authenticated
  using (public.is_product_member(product_id));
