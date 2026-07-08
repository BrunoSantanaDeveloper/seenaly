-- ============================================================
-- 0009_meta_ads: normalized Meta Ads data synced by the meta-ads
-- connector (apps/web/src/lib/meta-ads). Every table hangs off a
-- `connection` (packages/db 0004) and therefore off an organization.
-- RLS: org members READ; writes are service-role only (the connector
-- runs under the service client in runConnectionSync).
-- Grain: account > campaign > ad_set > ad > creative for structure,
-- plus one insights row per ad per day.
-- ============================================================

-- Membership check reused by every table's SELECT policy: is the caller
-- a member of the organization that owns this connection?
create or replace function public.is_connection_member(target_connection uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.connections c
    where c.id = target_connection and public.is_org_member(c.org_id)
  );
$$;

-- ---------- Ad accounts ----------

create table public.meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  -- Meta numeric ad account id (without the "act_" prefix).
  account_id text not null,
  name text,
  currency text,
  timezone_name text,
  account_status smallint,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, account_id)
);

create index meta_ad_accounts_connection_idx on public.meta_ad_accounts (connection_id);

-- ---------- Campaigns ----------

create table public.meta_campaigns (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  account_id text not null,
  campaign_id text not null,
  name text,
  objective text,
  status text,
  effective_status text,
  buying_type text,
  -- Budgets in the account currency's minor units (as Meta returns them).
  daily_budget bigint,
  lifetime_budget bigint,
  start_time timestamptz,
  stop_time timestamptz,
  -- Meta's updated_time — lets a future incremental refresh filter by it.
  updated_time timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, campaign_id)
);

create index meta_campaigns_connection_idx on public.meta_campaigns (connection_id);
create index meta_campaigns_account_idx on public.meta_campaigns (connection_id, account_id);

-- ---------- Ad sets ----------

create table public.meta_ad_sets (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  account_id text not null,
  ad_set_id text not null,
  campaign_id text,
  name text,
  status text,
  effective_status text,
  -- The optimization event chosen for the ad set — key input for diagnostics.
  optimization_goal text,
  billing_event text,
  bid_strategy text,
  daily_budget bigint,
  lifetime_budget bigint,
  -- learning_stage_info: { status: LEARNING|SUCCESS|..., conversions, ... }.
  -- Drives the "not enough data to conclude" guardrail (learning phase).
  learning_stage_info jsonb,
  -- Targeting summary as returned by the API.
  targeting jsonb,
  start_time timestamptz,
  end_time timestamptz,
  updated_time timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, ad_set_id)
);

create index meta_ad_sets_connection_idx on public.meta_ad_sets (connection_id);
create index meta_ad_sets_campaign_idx on public.meta_ad_sets (connection_id, campaign_id);

-- ---------- Creatives (foundation for the Phase 4 tagged library) ----------

create table public.meta_creatives (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  account_id text not null,
  creative_id text not null,
  name text,
  title text,
  body text,
  call_to_action_type text,
  object_type text,
  thumbnail_url text,
  image_url text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, creative_id)
);

create index meta_creatives_connection_idx on public.meta_creatives (connection_id);

-- ---------- Ads ----------

create table public.meta_ads (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  account_id text not null,
  ad_id text not null,
  ad_set_id text,
  campaign_id text,
  creative_id text,
  name text,
  status text,
  effective_status text,
  updated_time timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, ad_id)
);

create index meta_ads_connection_idx on public.meta_ads (connection_id);
create index meta_ads_ad_set_idx on public.meta_ads (connection_id, ad_set_id);

-- ---------- Daily insights (ad x day) ----------

create table public.meta_insights_daily (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  account_id text not null,
  ad_id text not null,
  ad_set_id text,
  campaign_id text,
  date date not null,
  spend numeric,
  impressions bigint,
  reach bigint,
  frequency numeric,
  cpm numeric,
  ctr numeric,
  cpc numeric,
  clicks bigint,
  inline_link_clicks bigint,
  -- Convenience columns extracted from actions/action_values for the common
  -- purchase case; the full arrays stay in actions/action_values for any event.
  purchases numeric,
  purchase_value numeric,
  purchase_roas numeric,
  actions jsonb,
  action_values jsonb,
  -- Relevance diagnostics (quality/engagement/conversion rate ranking).
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, ad_id, date)
);

create index meta_insights_daily_connection_idx on public.meta_insights_daily (connection_id);
create index meta_insights_daily_ad_date_idx on public.meta_insights_daily (connection_id, ad_id, date);
create index meta_insights_daily_campaign_date_idx on public.meta_insights_daily (connection_id, campaign_id, date);

-- ---------- RLS: members read, service role writes ----------

alter table public.meta_ad_accounts enable row level security;
alter table public.meta_campaigns enable row level security;
alter table public.meta_ad_sets enable row level security;
alter table public.meta_creatives enable row level security;
alter table public.meta_ads enable row level security;
alter table public.meta_insights_daily enable row level security;

-- Only SELECT policies (no INSERT/UPDATE/DELETE for authenticated): the
-- connector writes with the service role, which bypasses RLS.
create policy "meta_ad_accounts_select" on public.meta_ad_accounts for select to authenticated
  using (public.is_connection_member(connection_id));
create policy "meta_campaigns_select" on public.meta_campaigns for select to authenticated
  using (public.is_connection_member(connection_id));
create policy "meta_ad_sets_select" on public.meta_ad_sets for select to authenticated
  using (public.is_connection_member(connection_id));
create policy "meta_creatives_select" on public.meta_creatives for select to authenticated
  using (public.is_connection_member(connection_id));
create policy "meta_ads_select" on public.meta_ads for select to authenticated
  using (public.is_connection_member(connection_id));
create policy "meta_insights_daily_select" on public.meta_insights_daily for select to authenticated
  using (public.is_connection_member(connection_id));

-- ---------- updated_at maintenance ----------

create trigger meta_ad_accounts_updated_at before update on public.meta_ad_accounts
  for each row execute function public.set_updated_at();
create trigger meta_campaigns_updated_at before update on public.meta_campaigns
  for each row execute function public.set_updated_at();
create trigger meta_ad_sets_updated_at before update on public.meta_ad_sets
  for each row execute function public.set_updated_at();
create trigger meta_creatives_updated_at before update on public.meta_creatives
  for each row execute function public.set_updated_at();
create trigger meta_ads_updated_at before update on public.meta_ads
  for each row execute function public.set_updated_at();
create trigger meta_insights_daily_updated_at before update on public.meta_insights_daily
  for each row execute function public.set_updated_at();
