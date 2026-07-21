-- ============================================================
-- 0027_pricing_model: how the offer is actually charged.
--
-- A single "price" column is a lowest-common-denominator that fits no real
-- business model: a SaaS has tiers and periods, a credit product has packs, a
-- high-ticket service sells through leads, an offer ladder earns on the upsell.
-- Beginners know the FACTS (their plan prices) but not how to convert them into
-- acquisition economics — that conversion is Seenaly's job, not theirs.
--
-- Design: this is INPUT. The existing economics columns (price, avg_ticket,
-- ltv, target_cac) stay the engine's contract and are DERIVED from these rows
-- (apps/web/src/lib/pricing.ts). Old products keep working untouched.
--
-- Marker for scripts/apply-migrations.mjs = create table public.product_plans.
-- ============================================================

-- Repeatable pricing rows: subscription tiers, credit packs, ladder items.
create table public.product_plans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,

  name text,
  price numeric,
  -- Billing period for recurring tiers; null/one_time for single charges.
  period text check (
    period is null or period in ('weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'one_time')
  ),
  -- Credits/units in a pack (credit model) or units in a ladder item.
  quantity numeric,
  -- Share of paying customers on this row (0-100) — drives the blended ticket.
  share_pct numeric,
  -- The row the ad anchors on (the advertised / entry offer).
  is_primary boolean not null default false,
  sort integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_plans_product_idx on public.product_plans (product_id, sort);

-- Which model the rows above describe + the model-specific scalars
-- (retention months, close rate, repurchase rate, AOV, trial…).
alter table public.products
  add column pricing_model text,
  add column pricing_inputs jsonb not null default '{}'::jsonb;

-- ---------- RLS (mirrors product_objections / product_proofs) ----------

alter table public.product_plans enable row level security;

create policy "product_plans_select" on public.product_plans for select to authenticated
  using (public.is_product_member(product_id));
create policy "product_plans_insert" on public.product_plans for insert to authenticated
  with check (public.is_product_member(product_id));
create policy "product_plans_update" on public.product_plans for update to authenticated
  using (public.is_product_member(product_id))
  with check (public.is_product_member(product_id));
create policy "product_plans_delete" on public.product_plans for delete to authenticated
  using (public.is_product_member(product_id));

create trigger product_plans_updated_at before update on public.product_plans
  for each row execute function public.set_updated_at();
