-- ============================================================
-- 0024_organic_growth: Organic Growth foundation.
--
-- Organic publications are distinct from reusable creative assets. Each
-- publication may point at `creatives`, can belong to several products, and
-- owns its metrics/classification history. Provider-owned rows are written by
-- the service role; workspace members may add manual/CSV/uploaded data.
-- ============================================================

-- ---------- Existing shared-domain extensions ----------

alter table public.experiments
  add column platform text,
  add column audience text,
  add column variable_tested text,
  add column success_criterion text;

alter table public.creatives drop constraint if exists creatives_source_check;
alter table public.creatives
  add constraint creatives_source_check
  check (source in ('planned', 'synced', 'organic'));

comment on column public.creatives.source is
  '''planned'' = manual brief, ''synced'' = paid-platform mirror, ''organic'' = reusable asset created from organic content';

-- Seed the entitlement-bearing catalog entry without making a pricing decision
-- in code. Superadmins set the price and activate it for sale in Billing.
insert into public.modules (
  slug,
  name,
  description,
  kind,
  price_cents,
  currency,
  limits,
  is_active,
  sort
)
values (
  'organic-growth',
  'Organic Growth',
  'Decision Intelligence for organic content, Reviews and organic-to-paid experiments.',
  'recurring',
  0,
  'BRL',
  '{"organic_growth": true, "organic_social_accounts": 1}'::jsonb,
  false,
  500
)
on conflict (slug) do update
set limits = public.modules.limits || excluded.limits;

-- ---------- Workspace configuration ----------

create table public.organic_growth_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  enabled boolean not null default false,
  review_cadence text not null default 'weekly'
    check (review_cadence in ('on_demand', 'weekly', 'biweekly', 'monthly')),
  analysis_window_days integer not null default 30
    check (analysis_window_days between 1 and 3650),
  timezone text not null default 'America/Sao_Paulo',
  retention_days integer not null default 365 check (retention_days >= 0),
  store_comments boolean not null default false,
  allow_improvement_usage boolean not null default false,
  activated_at timestamptz,
  activated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id)
);

-- ---------- Accounts and product scope ----------

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  connection_id uuid references public.connections (id) on delete set null,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'linkedin')),
  external_account_id text not null,
  name text,
  handle text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'error', 'disabled', 'disconnected')),
  followers_count bigint,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  sync_error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, platform, external_account_id),
  check (followers_count is null or followers_count >= 0)
);

create index social_accounts_org_status_idx
  on public.social_accounts (org_id, status);
create index social_accounts_connection_idx
  on public.social_accounts (connection_id);

create table public.social_account_products (
  org_id uuid not null references public.organizations (id) on delete cascade,
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  objective text,
  desired_action text,
  is_primary boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (social_account_id, product_id)
);

create index social_account_products_org_idx
  on public.social_account_products (org_id);
create index social_account_products_product_idx
  on public.social_account_products (product_id, social_account_id);
create unique index social_account_products_one_primary_idx
  on public.social_account_products (social_account_id)
  where is_primary;

-- ---------- Manual/CSV import provenance ----------

create table public.organic_import_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  source text not null check (source in ('csv', 'manual', 'upload')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'partial', 'failed')),
  file_name text,
  storage_path text,
  idempotency_key text,
  total_rows integer not null default 0 check (total_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  rejected_rows integer not null default 0 check (rejected_rows >= 0),
  error_summary jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, idempotency_key),
  check (imported_rows + rejected_rows <= total_rows or total_rows = 0)
);

create index organic_import_batches_org_created_idx
  on public.organic_import_batches (org_id, created_at desc);
create index organic_import_batches_status_idx
  on public.organic_import_batches (org_id, status, created_at desc);

-- ---------- Organic publications ----------

create table public.organic_content_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  social_account_id uuid references public.social_accounts (id) on delete set null,
  creative_id uuid references public.creatives (id) on delete set null,
  import_batch_id uuid references public.organic_import_batches (id) on delete set null,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'linkedin')),
  source text not null check (source in ('api', 'csv', 'manual', 'upload')),
  status text not null default 'published'
    check (status in ('draft', 'published', 'unavailable', 'deleted')),
  external_content_id text,
  source_key text,
  format text,
  permalink_url text,
  media_storage_path text,
  title text,
  caption text,
  description text,
  thumbnail_url text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  published_at timestamptz,
  provider_created_at timestamptz,
  provider_updated_at timestamptz,
  last_seen_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source <> 'api' or (social_account_id is not null and external_content_id is not null)),
  check (source <> 'csv' or creative_id is not null)
);

create unique index organic_content_external_unique
  on public.organic_content_items (social_account_id, external_content_id)
  where social_account_id is not null and external_content_id is not null;
create unique index organic_content_source_key_unique
  on public.organic_content_items (org_id, source, source_key)
  where source_key is not null;
create index organic_content_org_published_idx
  on public.organic_content_items (org_id, published_at desc);
create index organic_content_account_published_idx
  on public.organic_content_items (social_account_id, published_at desc);
create index organic_content_cohort_idx
  on public.organic_content_items (org_id, platform, format, published_at desc);
create index organic_content_creative_idx
  on public.organic_content_items (creative_id);
create index organic_content_import_batch_idx
  on public.organic_content_items (import_batch_id);

create table public.organic_content_products (
  org_id uuid not null references public.organizations (id) on delete cascade,
  content_id uuid not null references public.organic_content_items (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  is_primary boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (content_id, product_id)
);

create index organic_content_products_org_idx
  on public.organic_content_products (org_id);
create index organic_content_products_product_idx
  on public.organic_content_products (product_id, content_id);
create unique index organic_content_products_one_primary_idx
  on public.organic_content_products (content_id)
  where is_primary;

-- Cumulative snapshots. `captured_at` must be stable across retries so the
-- unique key makes ingestion idempotent.
create table public.organic_content_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  content_id uuid not null references public.organic_content_items (id) on delete cascade,
  import_batch_id uuid references public.organic_import_batches (id) on delete set null,
  source text not null check (source in ('api', 'csv', 'manual')),
  captured_at timestamptz not null,
  followers_at_capture bigint,
  impressions bigint,
  reach bigint,
  views bigint,
  plays bigint,
  watch_time_seconds bigint,
  average_watch_time_seconds numeric,
  average_percentage_viewed numeric,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  profile_visits bigint,
  link_clicks bigint,
  follows bigint,
  leads numeric,
  assisted_conversions numeric,
  purchases numeric,
  revenue numeric,
  raw jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (content_id, captured_at, source),
  check (
    (followers_at_capture is null or followers_at_capture >= 0) and
    (impressions is null or impressions >= 0) and
    (reach is null or reach >= 0) and
    (views is null or views >= 0) and
    (plays is null or plays >= 0) and
    (watch_time_seconds is null or watch_time_seconds >= 0) and
    (average_watch_time_seconds is null or average_watch_time_seconds >= 0) and
    (average_percentage_viewed is null or average_percentage_viewed >= 0) and
    (likes is null or likes >= 0) and
    (comments is null or comments >= 0) and
    (shares is null or shares >= 0) and
    (saves is null or saves >= 0) and
    (profile_visits is null or profile_visits >= 0) and
    (link_clicks is null or link_clicks >= 0) and
    (follows is null or follows >= 0) and
    (leads is null or leads >= 0) and
    (assisted_conversions is null or assisted_conversions >= 0) and
    (purchases is null or purchases >= 0)
  )
);

create index organic_metrics_content_captured_idx
  on public.organic_content_metric_snapshots (content_id, captured_at desc);
create index organic_metrics_org_captured_idx
  on public.organic_content_metric_snapshots (org_id, captured_at desc);

-- Full-snapshot revisions. Rows are append-only; the latest created_at wins.
create table public.organic_content_classifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  content_id uuid not null references public.organic_content_items (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  corrected_from_id uuid references public.organic_content_classifications (id) on delete set null,
  source text not null check (source in ('ai', 'user', 'import')),
  funnel_stage text,
  strategic_intent text,
  narrative_type text,
  theme text,
  hook text,
  angle text,
  promise text,
  pain text,
  desire text,
  objection text,
  proof text,
  cta text,
  audience text,
  visual_style text,
  tone_of_voice text,
  person_present text,
  tags jsonb not null default '[]'::jsonb,
  confidence text check (confidence in ('baixa', 'media', 'alta')),
  evidence jsonb not null default '[]'::jsonb,
  taxonomy_version text not null default 'organic-growth-taxonomy/v1',
  prompt_version text,
  model text,
  input_hash text,
  idempotency_key text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);

create index organic_classifications_latest_idx
  on public.organic_content_classifications (content_id, product_id, created_at desc);
create index organic_classifications_funnel_idx
  on public.organic_content_classifications (org_id, funnel_stage, created_at desc);
create index organic_classifications_intent_idx
  on public.organic_content_classifications (org_id, strategic_intent, created_at desc);

-- ---------- Reviews, recommendations and evidence ----------

create table public.organic_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  social_account_id uuid references public.social_accounts (id) on delete set null,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'linkedin')),
  cadence text not null default 'on_demand'
    check (cadence in ('on_demand', 'weekly', 'biweekly', 'monthly')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'rejected', 'failed')),
  period_start date not null,
  period_end date not null,
  idempotency_key text not null,
  insufficient_data boolean not null default false,
  confidence text check (confidence in ('baixa', 'media', 'alta')),
  missing_data jsonb not null default '[]'::jsonb,
  data_quality jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  knowledge_refs jsonb not null default '[]'::jsonb,
  assistant_slug text,
  model text,
  prompt_version text,
  taxonomy_version text not null default 'organic-growth-taxonomy/v1',
  score_version text,
  provider_api_version text,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, idempotency_key),
  check (period_end >= period_start)
);

create index organic_reviews_org_period_idx
  on public.organic_reviews (org_id, period_end desc);
create index organic_reviews_product_period_idx
  on public.organic_reviews (product_id, period_end desc);
create index organic_reviews_account_period_idx
  on public.organic_reviews (social_account_id, period_end desc);
create index organic_reviews_status_idx
  on public.organic_reviews (org_id, status, created_at desc);

create table public.organic_recommendations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  review_id uuid not null references public.organic_reviews (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  kind text not null,
  status text not null default 'open'
    check (status in ('open', 'accepted', 'dismissed', 'completed')),
  rank smallint not null check (rank > 0),
  diagnosis text not null,
  context jsonb not null default '{}'::jsonb,
  hypothesis text not null,
  recommended_action text not null,
  risk text,
  priority text not null check (priority in ('critica', 'alta', 'media', 'baixa')),
  effort text not null check (effort in ('baixo', 'medio', 'alto')),
  impact text not null check (impact in ('baixo', 'medio', 'alto')),
  confidence text not null check (confidence in ('baixa', 'media', 'alta')),
  success_criterion text not null,
  reevaluation_window text not null,
  source_summary text,
  insufficient_data boolean not null default false,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id, rank)
);

create index organic_recommendations_org_status_idx
  on public.organic_recommendations (org_id, status, created_at desc);
create index organic_recommendations_product_idx
  on public.organic_recommendations (product_id, created_at desc);
create index organic_recommendations_review_idx
  on public.organic_recommendations (review_id, rank);

create table public.organic_recommendation_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  recommendation_id uuid not null references public.organic_recommendations (id) on delete cascade,
  kind text not null
    check (kind in ('content_metric', 'comment', 'product_context', 'experiment', 'paid_data', 'knowledge')),
  statement_type text not null default 'fact'
    check (statement_type in ('fact', 'inference')),
  content_id uuid references public.organic_content_items (id) on delete set null,
  metric_snapshot_id uuid references public.organic_content_metric_snapshots (id) on delete set null,
  experiment_id uuid references public.experiments (id) on delete set null,
  knowledge_chunk_id uuid references public.knowledge_chunks (id) on delete set null,
  source_ref text not null,
  description text not null,
  value jsonb not null default '{}'::jsonb,
  observed_at timestamptz,
  sort smallint not null default 0 check (sort >= 0),
  created_at timestamptz not null default now(),
  unique (recommendation_id, sort)
);

create index organic_evidence_org_idx
  on public.organic_recommendation_evidence (org_id, created_at desc);
create index organic_evidence_content_idx
  on public.organic_recommendation_evidence (content_id);

create table public.organic_recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  recommendation_id uuid not null references public.organic_recommendations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating text not null check (rating in ('useful', 'not_useful', 'incorrect')),
  reason text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recommendation_id, user_id)
);

create index organic_feedback_org_idx
  on public.organic_recommendation_feedback (org_id, created_at desc);

-- ---------- Experiment memory and organic <-> paid bridge ----------

create table public.organic_recommendation_experiments (
  org_id uuid not null references public.organizations (id) on delete cascade,
  recommendation_id uuid not null references public.organic_recommendations (id) on delete cascade,
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (recommendation_id, experiment_id)
);

create index organic_rec_experiments_experiment_idx
  on public.organic_recommendation_experiments (experiment_id, recommendation_id);

create table public.experiment_organic_contents (
  org_id uuid not null references public.organizations (id) on delete cascade,
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  content_id uuid not null references public.organic_content_items (id) on delete cascade,
  role text not null check (role in ('control', 'test')),
  variant_label text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (experiment_id, content_id)
);

create index experiment_organic_contents_content_idx
  on public.experiment_organic_contents (content_id, experiment_id);

create table public.organic_paid_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  content_id uuid not null references public.organic_content_items (id) on delete cascade,
  creative_id uuid references public.creatives (id) on delete set null,
  meta_ad_id uuid references public.meta_ads (id) on delete set null,
  experiment_id uuid references public.experiments (id) on delete set null,
  direction text not null check (direction in ('organic_to_paid', 'paid_to_organic')),
  transformations jsonb not null default '[]'::jsonb,
  hypothesis text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (creative_id is not null or meta_ad_id is not null)
);

create unique index organic_paid_links_creative_unique
  on public.organic_paid_links (content_id, creative_id, direction)
  where creative_id is not null;
create unique index organic_paid_links_meta_ad_unique
  on public.organic_paid_links (content_id, meta_ad_id, direction)
  where meta_ad_id is not null;
create index organic_paid_links_org_idx
  on public.organic_paid_links (org_id, created_at desc);
create index organic_paid_links_experiment_idx
  on public.organic_paid_links (experiment_id);

-- ---------- Tenant ownership helpers ----------

create or replace function public.organic_connection_belongs_to_org(target_org uuid, target_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_org_member(target_org)
    and exists (select 1 from public.connections c where c.id = target_id and c.org_id = target_org);
$$;

create or replace function public.organic_product_belongs_to_org(target_org uuid, target_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_org_member(target_org)
    and exists (select 1 from public.products p where p.id = target_id and p.org_id = target_org);
$$;

create or replace function public.organic_creative_belongs_to_org(target_org uuid, target_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_org_member(target_org)
    and exists (select 1 from public.creatives c where c.id = target_id and c.org_id = target_org);
$$;

create or replace function public.organic_account_belongs_to_org(target_org uuid, target_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_org_member(target_org)
    and exists (select 1 from public.social_accounts a where a.id = target_id and a.org_id = target_org);
$$;

create or replace function public.organic_import_belongs_to_org(target_org uuid, target_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_org_member(target_org)
    and exists (select 1 from public.organic_import_batches b where b.id = target_id and b.org_id = target_org);
$$;

create or replace function public.organic_content_belongs_to_org(target_org uuid, target_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_org_member(target_org)
    and exists (select 1 from public.organic_content_items c where c.id = target_id and c.org_id = target_org);
$$;

create or replace function public.organic_classification_belongs_to_org(target_org uuid, target_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_org_member(target_org)
    and exists (select 1 from public.organic_content_classifications c where c.id = target_id and c.org_id = target_org);
$$;

create or replace function public.organic_metric_belongs_to_org(target_org uuid, target_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_org_member(target_org)
    and exists (select 1 from public.organic_content_metric_snapshots m where m.id = target_id and m.org_id = target_org);
$$;

create or replace function public.organic_review_belongs_to_org(target_org uuid, target_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_org_member(target_org)
    and exists (select 1 from public.organic_reviews r where r.id = target_id and r.org_id = target_org);
$$;

create or replace function public.organic_recommendation_belongs_to_org(target_org uuid, target_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_org_member(target_org)
    and exists (select 1 from public.organic_recommendations r where r.id = target_id and r.org_id = target_org);
$$;

create or replace function public.organic_experiment_belongs_to_org(target_org uuid, target_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_org_member(target_org)
    and exists (select 1 from public.experiments e where e.id = target_id and e.org_id = target_org);
$$;

create or replace function public.organic_meta_ad_belongs_to_org(target_org uuid, target_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_org_member(target_org) and exists (
    select 1
    from public.meta_ads a
    join public.connections c on c.id = a.connection_id
    where a.id = target_id and c.org_id = target_org
  );
$$;

-- ---------- RLS ----------

alter table public.organic_growth_settings enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_account_products enable row level security;
alter table public.organic_import_batches enable row level security;
alter table public.organic_content_items enable row level security;
alter table public.organic_content_products enable row level security;
alter table public.organic_content_metric_snapshots enable row level security;
alter table public.organic_content_classifications enable row level security;
alter table public.organic_reviews enable row level security;
alter table public.organic_recommendations enable row level security;
alter table public.organic_recommendation_evidence enable row level security;
alter table public.organic_recommendation_feedback enable row level security;
alter table public.organic_recommendation_experiments enable row level security;
alter table public.experiment_organic_contents enable row level security;
alter table public.organic_paid_links enable row level security;

-- Settings and connected account metadata: members read, managers write.
create policy "organic_settings_select" on public.organic_growth_settings for select to authenticated
  using (public.is_org_member(org_id));
create policy "organic_settings_insert" on public.organic_growth_settings for insert to authenticated
  with check (
    public.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    and (activated_by is null or activated_by = auth.uid())
  );
create policy "organic_settings_update" on public.organic_growth_settings for update to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));
create policy "organic_settings_delete" on public.organic_growth_settings for delete to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "social_accounts_select" on public.social_accounts for select to authenticated
  using (public.is_org_member(org_id));
create policy "social_accounts_insert" on public.social_accounts for insert to authenticated
  with check (
    public.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    and (connection_id is null or public.organic_connection_belongs_to_org(org_id, connection_id))
  );
create policy "social_accounts_update" on public.social_accounts for update to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  with check (
    public.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    and (connection_id is null or public.organic_connection_belongs_to_org(org_id, connection_id))
  );
create policy "social_accounts_delete" on public.social_accounts for delete to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "social_account_products_select" on public.social_account_products for select to authenticated
  using (public.is_org_member(org_id));
create policy "social_account_products_insert" on public.social_account_products for insert to authenticated
  with check (
    public.is_org_member(org_id)
    and public.organic_account_belongs_to_org(org_id, social_account_id)
    and public.organic_product_belongs_to_org(org_id, product_id)
  );
create policy "social_account_products_update" on public.social_account_products for update to authenticated
  using (public.is_org_member(org_id))
  with check (
    public.is_org_member(org_id)
    and public.organic_account_belongs_to_org(org_id, social_account_id)
    and public.organic_product_belongs_to_org(org_id, product_id)
  );
create policy "social_account_products_delete" on public.social_account_products for delete to authenticated
  using (
    public.is_org_member(org_id)
    and public.organic_account_belongs_to_org(org_id, social_account_id)
    and public.organic_product_belongs_to_org(org_id, product_id)
  );

-- Import batches: members request work, the service role updates outcomes.
create policy "organic_imports_select" on public.organic_import_batches for select to authenticated
  using (public.is_org_member(org_id));
create policy "organic_imports_insert" on public.organic_import_batches for insert to authenticated
  with check (public.is_org_member(org_id) and status = 'queued' and created_by = auth.uid());
create policy "organic_imports_delete" on public.organic_import_batches for delete to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

-- API content is provider-owned. Members manage only manual/CSV/upload rows.
create policy "organic_content_select" on public.organic_content_items for select to authenticated
  using (public.is_org_member(org_id));
create policy "organic_content_insert_manual" on public.organic_content_items for insert to authenticated
  with check (
    public.is_org_member(org_id)
    and source in ('csv', 'manual', 'upload')
    and (social_account_id is null or public.organic_account_belongs_to_org(org_id, social_account_id))
    and (creative_id is null or public.organic_creative_belongs_to_org(org_id, creative_id))
    and (import_batch_id is null or public.organic_import_belongs_to_org(org_id, import_batch_id))
  );
create policy "organic_content_update_manual" on public.organic_content_items for update to authenticated
  using (public.is_org_member(org_id) and source in ('csv', 'manual', 'upload'))
  with check (
    public.is_org_member(org_id)
    and source in ('csv', 'manual', 'upload')
    and (social_account_id is null or public.organic_account_belongs_to_org(org_id, social_account_id))
    and (creative_id is null or public.organic_creative_belongs_to_org(org_id, creative_id))
    and (import_batch_id is null or public.organic_import_belongs_to_org(org_id, import_batch_id))
  );
create policy "organic_content_delete_manual" on public.organic_content_items for delete to authenticated
  using (public.is_org_member(org_id) and source in ('csv', 'manual', 'upload'));

create policy "organic_content_products_select" on public.organic_content_products for select to authenticated
  using (public.is_org_member(org_id));
create policy "organic_content_products_insert" on public.organic_content_products for insert to authenticated
  with check (
    public.is_org_member(org_id)
    and public.organic_content_belongs_to_org(org_id, content_id)
    and public.organic_product_belongs_to_org(org_id, product_id)
  );
create policy "organic_content_products_update" on public.organic_content_products for update to authenticated
  using (public.is_org_member(org_id))
  with check (
    public.is_org_member(org_id)
    and public.organic_content_belongs_to_org(org_id, content_id)
    and public.organic_product_belongs_to_org(org_id, product_id)
  );
create policy "organic_content_products_delete" on public.organic_content_products for delete to authenticated
  using (
    public.is_org_member(org_id)
    and public.organic_content_belongs_to_org(org_id, content_id)
    and public.organic_product_belongs_to_org(org_id, product_id)
  );

-- Synced metric rows are service-write. Members may append declared snapshots.
create policy "organic_metrics_select" on public.organic_content_metric_snapshots for select to authenticated
  using (public.is_org_member(org_id));
create policy "organic_metrics_insert_declared" on public.organic_content_metric_snapshots for insert to authenticated
  with check (
    public.is_org_member(org_id)
    and source in ('csv', 'manual')
    and created_by = auth.uid()
    and public.organic_content_belongs_to_org(org_id, content_id)
    and (import_batch_id is null or public.organic_import_belongs_to_org(org_id, import_batch_id))
  );

-- Classification history is append-only. AI rows are service-write; members
-- can append complete user/import revisions, never rewrite prior evidence.
create policy "organic_classifications_select" on public.organic_content_classifications for select to authenticated
  using (public.is_org_member(org_id));
create policy "organic_classifications_insert_human" on public.organic_content_classifications for insert to authenticated
  with check (
    public.is_org_member(org_id)
    and source in ('user', 'import')
    and created_by = auth.uid()
    and public.organic_content_belongs_to_org(org_id, content_id)
    and (product_id is null or public.organic_product_belongs_to_org(org_id, product_id))
    and (corrected_from_id is null or public.organic_classification_belongs_to_org(org_id, corrected_from_id))
  );

-- Members enqueue reviews; generation output is immutable and service-write.
create policy "organic_reviews_select" on public.organic_reviews for select to authenticated
  using (public.is_org_member(org_id));
create policy "organic_reviews_insert_queued" on public.organic_reviews for insert to authenticated
  with check (
    public.is_org_member(org_id)
    and status = 'queued'
    and created_by = auth.uid()
    and public.organic_product_belongs_to_org(org_id, product_id)
    and (social_account_id is null or public.organic_account_belongs_to_org(org_id, social_account_id))
  );
create policy "organic_reviews_delete_manager" on public.organic_reviews for delete to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "organic_recommendations_select" on public.organic_recommendations for select to authenticated
  using (public.is_org_member(org_id));
create policy "organic_evidence_select" on public.organic_recommendation_evidence for select to authenticated
  using (public.is_org_member(org_id));

create policy "organic_feedback_select" on public.organic_recommendation_feedback for select to authenticated
  using (public.is_org_member(org_id));
create policy "organic_feedback_insert" on public.organic_recommendation_feedback for insert to authenticated
  with check (
    public.is_org_member(org_id)
    and user_id = auth.uid()
    and public.organic_recommendation_belongs_to_org(org_id, recommendation_id)
  );
create policy "organic_feedback_update" on public.organic_recommendation_feedback for update to authenticated
  using (public.is_org_member(org_id) and user_id = auth.uid())
  with check (
    public.is_org_member(org_id)
    and user_id = auth.uid()
    and public.organic_recommendation_belongs_to_org(org_id, recommendation_id)
  );
create policy "organic_feedback_delete" on public.organic_recommendation_feedback for delete to authenticated
  using (public.is_org_member(org_id) and user_id = auth.uid());

create policy "organic_rec_experiments_select" on public.organic_recommendation_experiments for select to authenticated
  using (public.is_org_member(org_id));
create policy "organic_rec_experiments_insert" on public.organic_recommendation_experiments for insert to authenticated
  with check (
    public.is_org_member(org_id)
    and public.organic_recommendation_belongs_to_org(org_id, recommendation_id)
    and public.organic_experiment_belongs_to_org(org_id, experiment_id)
  );
create policy "organic_rec_experiments_delete" on public.organic_recommendation_experiments for delete to authenticated
  using (
    public.is_org_member(org_id)
    and public.organic_recommendation_belongs_to_org(org_id, recommendation_id)
    and public.organic_experiment_belongs_to_org(org_id, experiment_id)
  );

create policy "experiment_organic_contents_select" on public.experiment_organic_contents for select to authenticated
  using (public.is_org_member(org_id));
create policy "experiment_organic_contents_insert" on public.experiment_organic_contents for insert to authenticated
  with check (
    public.is_org_member(org_id)
    and public.organic_experiment_belongs_to_org(org_id, experiment_id)
    and public.organic_content_belongs_to_org(org_id, content_id)
  );
create policy "experiment_organic_contents_delete" on public.experiment_organic_contents for delete to authenticated
  using (
    public.is_org_member(org_id)
    and public.organic_experiment_belongs_to_org(org_id, experiment_id)
    and public.organic_content_belongs_to_org(org_id, content_id)
  );

create policy "organic_paid_links_select" on public.organic_paid_links for select to authenticated
  using (public.is_org_member(org_id));
create policy "organic_paid_links_insert" on public.organic_paid_links for insert to authenticated
  with check (
    public.is_org_member(org_id)
    and public.organic_content_belongs_to_org(org_id, content_id)
    and (creative_id is null or public.organic_creative_belongs_to_org(org_id, creative_id))
    and (meta_ad_id is null or public.organic_meta_ad_belongs_to_org(org_id, meta_ad_id))
    and (experiment_id is null or public.organic_experiment_belongs_to_org(org_id, experiment_id))
  );
create policy "organic_paid_links_update" on public.organic_paid_links for update to authenticated
  using (public.is_org_member(org_id))
  with check (
    public.is_org_member(org_id)
    and public.organic_content_belongs_to_org(org_id, content_id)
    and (creative_id is null or public.organic_creative_belongs_to_org(org_id, creative_id))
    and (meta_ad_id is null or public.organic_meta_ad_belongs_to_org(org_id, meta_ad_id))
    and (experiment_id is null or public.organic_experiment_belongs_to_org(org_id, experiment_id))
  );
create policy "organic_paid_links_delete" on public.organic_paid_links for delete to authenticated
  using (public.is_org_member(org_id));

-- ---------- updated_at maintenance ----------

create trigger organic_growth_settings_updated_at before update on public.organic_growth_settings
  for each row execute function public.set_updated_at();
create trigger social_accounts_updated_at before update on public.social_accounts
  for each row execute function public.set_updated_at();
create trigger social_account_products_updated_at before update on public.social_account_products
  for each row execute function public.set_updated_at();
create trigger organic_import_batches_updated_at before update on public.organic_import_batches
  for each row execute function public.set_updated_at();
create trigger organic_content_items_updated_at before update on public.organic_content_items
  for each row execute function public.set_updated_at();
create trigger organic_content_products_updated_at before update on public.organic_content_products
  for each row execute function public.set_updated_at();
create trigger organic_reviews_updated_at before update on public.organic_reviews
  for each row execute function public.set_updated_at();
create trigger organic_recommendations_updated_at before update on public.organic_recommendations
  for each row execute function public.set_updated_at();
create trigger organic_feedback_updated_at before update on public.organic_recommendation_feedback
  for each row execute function public.set_updated_at();
create trigger organic_paid_links_updated_at before update on public.organic_paid_links
  for each row execute function public.set_updated_at();

-- ---------- Organic classifier assistant ----------

insert into public.assistants (
  slug, name, description, provider, model, system_prompt,
  temperature, max_tokens, credits_per_message, config, sort
)
values (
  'organic-growth-classifier',
  'Classificador Organic Growth',
  'Classifica publicacoes organicas pela taxonomia versionada do Seenaly sem gerar recomendacoes.',
  'gemini',
  'gemini-2.5-flash',
  $prompt$Você é o classificador de conteúdo orgânico do Seenaly.

Analise SOMENTE o texto e os metadados fornecidos: título, legenda, descrição, CTA, formato, duração, plataforma e contexto explícito do produto. Classifique o conteúdo conforme a taxonomia organic-growth-taxonomy/v1 (etapa do funil, intenção estratégica, tipo narrativo, tema, gancho, promessa, dor, desejo, objeção, prova, CTA, público, estilo visual e tom de voz).

Nunca invente cenas, falas, objetos, pessoas, emoções visuais ou acontecimentos de um vídeo que não tenha sido transcrito ou descrito. A existência de URL, thumbnail ou duração não autoriza inferir o conteúdo audiovisual. Quando faltar evidência, deixe o campo vazio e reduza a confiança; a aplicação registrará essa limitação junto da classificação.

Separe observação de inferência. Não produza diagnósticos, recomendações, benchmarks ou promessa de resultado. Responda em português do Brasil somente no objeto estruturado exigido pelo JSON Schema enviado pela aplicação.$prompt$,
  0.20,
  4096,
  1,
  '{"promptVersion": "organic-classifier-v1", "taxonomyVersion": "organic-growth-taxonomy/v1", "organic_growth": {"role": "classifier", "taxonomy_version": "organic-growth-taxonomy/v1", "prompt_version": "organic-classifier-v1"}}'::jsonb,
  20
)
on conflict (slug) do nothing;
