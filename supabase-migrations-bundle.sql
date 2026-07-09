-- ============================================================
-- Seenaly — combined migration bundle (0000 → 0010)
-- Generated 2026-07-09T12:14:33Z. Paste whole into the
-- Supabase SQL Editor and Run once. Order is significant.
-- Delete this file after applying — it is not a source of truth;
-- packages/db/migrations/*.sql are.
-- ============================================================


-- ############################################################
-- ## 0000_init.sql
-- ############################################################

-- ============================================================
-- 0000_init: multi-tenant foundation (profiles, organizations,
-- memberships, invites) with Row Level Security.
--
-- Apply with the Supabase CLI (supabase db push / migration up)
-- or psql against the project database.
-- ============================================================

-- ---------- Enums ----------

create type public.org_role as enum ('owner', 'admin', 'member');

-- ---------- Tables ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.org_role not null default 'member',
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index memberships_user_idx on public.memberships (user_id);
create index memberships_org_idx on public.memberships (org_id);
create index invites_org_idx on public.invites (org_id);

-- ---------- Helper functions (security definer, used by policies) ----------

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target_org uuid, roles public.org_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;

-- profiles: read own profile and profiles of co-members; update own.
create policy "profiles_select_own_or_comember" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.memberships mine
      join public.memberships theirs on mine.org_id = theirs.org_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- organizations: members read; owners/admins update; owners delete.
-- Creation goes through create_organization() below (security definer),
-- so no direct insert policy is exposed.
create policy "organizations_select_member" on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy "organizations_update_admin" on public.organizations
  for update to authenticated
  using (public.has_org_role(id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(id, array['owner', 'admin']::public.org_role[]));

create policy "organizations_delete_owner" on public.organizations
  for delete to authenticated
  using (public.has_org_role(id, array['owner']::public.org_role[]));

-- memberships: members read their org's roster; owners/admins manage it.
create policy "memberships_select_member" on public.memberships
  for select to authenticated
  using (public.is_org_member(org_id));

create policy "memberships_insert_admin" on public.memberships
  for insert to authenticated
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "memberships_update_admin" on public.memberships
  for update to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "memberships_delete_admin_or_self" on public.memberships
  for delete to authenticated
  using (
    public.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    or user_id = auth.uid()
  );

-- invites: owners/admins manage; acceptance goes through accept_invite().
create policy "invites_select_admin" on public.invites
  for select to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "invites_insert_admin" on public.invites
  for insert to authenticated
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "invites_delete_admin" on public.invites
  for delete to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

-- ---------- Profile bootstrap on signup ----------

-- Creates the profile and, when the signup metadata carries a company
-- name, the user's first organization with an owner membership.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  company text;
  new_org uuid;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  company := nullif(trim(new.raw_user_meta_data ->> 'company'), '');
  if company is not null then
    insert into public.organizations (name, slug, created_by)
    values (
      company,
      lower(regexp_replace(company, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 8),
      new.id
    )
    returning id into new_org;

    insert into public.memberships (org_id, user_id, role)
    values (new_org, new.id, 'owner');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RPCs ----------

-- Creates an organization and makes the caller its owner. Exposed as a
-- security definer RPC because RLS has no sane "insert org + first
-- membership" path for regular users.
create or replace function public.create_organization(org_name text, org_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (org_name, org_slug, auth.uid())
  returning id into new_org;

  insert into public.memberships (org_id, user_id, role)
  values (new_org, auth.uid(), 'owner');

  return new_org;
end;
$$;

-- Accepts a pending invite by token for the current user.
create or replace function public.accept_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into inv
  from public.invites
  where token = invite_token
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'invite not found or expired';
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (inv.org_id, auth.uid(), inv.role)
  on conflict (org_id, user_id) do nothing;

  update public.invites set accepted_at = now() where id = inv.id;

  return inv.org_id;
end;
$$;

-- ---------- updated_at maintenance ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();


-- ############################################################
-- ## 0001_billing.sql
-- ############################################################

-- ============================================================
-- 0001_billing: per-organization subscriptions with two billing
-- models (recurring / credits), add-on modules, coupons, invoices
-- mirror, credit ledger, and a superadmin role.
--
-- Provider-agnostic: Stripe/Asaas specifics live in provider_refs
-- jsonb columns and in packages/billing.
-- ============================================================

-- ---------- Superadmin ----------

alter table public.profiles add column is_superadmin boolean not null default false;

-- Bootstrap (run manually once):
--   update public.profiles set is_superadmin = true where id = '<user uuid>';

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select p.is_superadmin from public.profiles p where p.id = auth.uid()), false);
$$;

-- ---------- Enums ----------

create type public.plan_kind as enum ('recurring', 'credits');
create type public.billing_period as enum ('weekly', 'monthly', 'yearly');
create type public.module_kind as enum ('recurring', 'one_time');
create type public.discount_type as enum ('percent', 'fixed');
create type public.subscription_status as enum ('incomplete', 'trialing', 'active', 'past_due', 'canceled');
create type public.invoice_status as enum ('open', 'paid', 'failed', 'refunded', 'void');
create type public.billing_provider as enum ('stripe', 'asaas');
create type public.credit_kind as enum ('purchase', 'grant', 'consumption', 'expiry', 'adjustment');

-- ---------- Catalog: plans and modules (superadmin-managed) ----------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  kind public.plan_kind not null default 'recurring',
  -- Null period on a credits plan means a one-time purchase of
  -- non-expiring credits; recurring plans always have a period.
  period public.billing_period,
  price_cents integer not null default 0,
  currency text not null default 'BRL',
  -- credits granted per cycle (kind = credits)
  credit_amount integer,
  -- whether granted credits expire at the end of the cycle
  credits_expire boolean not null default false,
  trial_days integer not null default 0,
  is_free boolean not null default false,
  is_active boolean not null default true,
  -- superadmin-adjustable feature limits, e.g. {"members": 3, "projects": 1}
  limits jsonb not null default '{}'::jsonb,
  -- provider-specific references, e.g. {"stripe": {"price_id": "..."}}
  provider_refs jsonb not null default '{}'::jsonb,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_recurring_period check (kind <> 'recurring' or period is not null),
  constraint plans_credits_amount check (kind <> 'credits' or credit_amount > 0)
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  kind public.module_kind not null default 'recurring',
  price_cents integer not null default 0,
  currency text not null default 'BRL',
  -- what the module unlocks, merged over plan limits
  limits jsonb not null default '{}'::jsonb,
  provider_refs jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type public.discount_type not null,
  -- percent: 1-100; fixed: amount in cents
  discount_value integer not null,
  max_redemptions integer,
  redeemed_count integer not null default 0,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Subscriptions ----------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.subscription_status not null default 'incomplete',
  -- Superadmin kill-switch, independent of the provider lifecycle.
  admin_suspended boolean not null default false,
  provider public.billing_provider,
  provider_customer_id text,
  provider_subscription_id text,
  period public.billing_period,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  coupon_id uuid references public.coupons (id) on delete set null,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live subscription per organization (history rows keep status canceled).
create unique index subscriptions_org_live_unique on public.subscriptions (org_id)
  where status in ('trialing', 'active', 'past_due');

create index subscriptions_provider_sub_idx on public.subscriptions (provider_subscription_id);

create table public.subscription_modules (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  module_id uuid not null references public.modules (id),
  status text not null default 'active' check (status in ('active', 'canceled')),
  provider_item_id text,
  added_at timestamptz not null default now(),
  canceled_at timestamptz,
  unique (subscription_id, module_id)
);

-- ---------- Credit ledger ----------

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- positive = grant/purchase, negative = consumption
  amount integer not null,
  kind public.credit_kind not null,
  description text,
  -- null = never expires
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index credit_transactions_org_idx on public.credit_transactions (org_id);

-- ---------- Invoices (mirror of provider charges) ----------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider public.billing_provider not null,
  provider_invoice_id text not null,
  amount_cents integer not null,
  currency text not null default 'BRL',
  status public.invoice_status not null default 'open',
  description text,
  invoice_url text,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_invoice_id)
);

create index invoices_org_idx on public.invoices (org_id);

-- ---------- RLS ----------

alter table public.plans enable row level security;
alter table public.modules enable row level security;
alter table public.coupons enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_modules enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.invoices enable row level security;

-- Catalog: anyone signed in can read active entries (pricing UI);
-- superadmin has full control.
create policy "plans_select" on public.plans for select to authenticated
  using (is_active or public.is_superadmin());
create policy "plans_all_superadmin" on public.plans for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy "modules_select" on public.modules for select to authenticated
  using (is_active or public.is_superadmin());
create policy "modules_all_superadmin" on public.modules for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Coupons are NOT listable by users (enumeration); validation goes
-- through the validate_coupon() RPC.
create policy "coupons_all_superadmin" on public.coupons for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- Org members read their billing data; superadmin reads/manages all.
-- Regular users never write these tables directly: mutations happen in
-- server code (service role) driven by provider webhooks and actions.
create policy "subscriptions_select_member" on public.subscriptions for select to authenticated
  using (public.is_org_member(org_id) or public.is_superadmin());
create policy "subscriptions_all_superadmin" on public.subscriptions for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy "subscription_modules_select_member" on public.subscription_modules for select to authenticated
  using (
    exists (
      select 1 from public.subscriptions s
      where s.id = subscription_id and (public.is_org_member(s.org_id) or public.is_superadmin())
    )
  );
create policy "subscription_modules_all_superadmin" on public.subscription_modules for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy "credit_transactions_select_member" on public.credit_transactions for select to authenticated
  using (public.is_org_member(org_id) or public.is_superadmin());
create policy "credit_transactions_all_superadmin" on public.credit_transactions for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy "invoices_select_member" on public.invoices for select to authenticated
  using (public.is_org_member(org_id) or public.is_superadmin());
create policy "invoices_all_superadmin" on public.invoices for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- ---------- Default free plan ----------

insert into public.plans (slug, name, description, kind, period, price_cents, is_free, limits, sort)
values (
  'free',
  'Free',
  'Default plan assigned to every new organization.',
  'recurring',
  'monthly',
  0,
  true,
  '{"members": 3}'::jsonb,
  0
);

-- Every new organization starts on the free plan.
create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  free_plan public.plans%rowtype;
begin
  select * into free_plan
  from public.plans
  where is_free and is_active
  order by created_at
  limit 1;

  if found then
    insert into public.subscriptions (org_id, plan_id, status, period)
    values (new.id, free_plan.id, 'active', free_plan.period);
  end if;

  return new;
end;
$$;

create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- ---------- RPCs ----------

-- Current usable credit balance for an organization.
create or replace function public.org_credit_balance(target_org uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(ct.amount), 0)::integer
  from public.credit_transactions ct
  where ct.org_id = target_org
    and (ct.expires_at is null or ct.expires_at > now())
    and public.is_org_member(target_org);
$$;

-- Consumes credits for a feature; fails when the balance is insufficient.
create or replace function public.consume_credits(target_org uuid, amount integer, reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  balance integer;
begin
  if amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if not public.is_org_member(target_org) then
    raise exception 'not a member of this organization';
  end if;

  select public.org_credit_balance(target_org) into balance;
  if balance < amount then
    raise exception 'insufficient credits (balance: %, required: %)', balance, amount;
  end if;

  insert into public.credit_transactions (org_id, amount, kind, description, created_by)
  values (target_org, -amount, 'consumption', reason, auth.uid());

  return balance - amount;
end;
$$;

-- Validates a coupon for checkout without exposing the coupons table.
create or replace function public.validate_coupon(coupon_code text)
returns table (id uuid, code text, discount_type public.discount_type, discount_value integer)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.code, c.discount_type, c.discount_value
  from public.coupons c
  where c.code = coupon_code
    and c.is_active
    and (c.valid_until is null or c.valid_until > now())
    and (c.max_redemptions is null or c.redeemed_count < c.max_redemptions);
$$;

-- Shallow-merge aggregate for jsonb objects (used by org_entitlements).
create or replace function public.jsonb_merge(a jsonb, b jsonb)
returns jsonb language sql immutable as $$ select coalesce(a, '{}'::jsonb) || coalesce(b, '{}'::jsonb); $$;

create aggregate public.jsonb_merge_agg (jsonb) (
  sfunc = public.jsonb_merge,
  stype = jsonb,
  initcond = '{}'
);

-- Effective entitlements for an org: plan limits merged with active
-- module limits, plus the suspension flag. App features gate on this.
create or replace function public.org_entitlements(target_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  sub public.subscriptions%rowtype;
  merged jsonb;
begin
  if not (public.is_org_member(target_org) or public.is_superadmin()) then
    raise exception 'not a member of this organization';
  end if;

  select * into sub
  from public.subscriptions
  where org_id = target_org and status in ('trialing', 'active', 'past_due')
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('active', false, 'reason', 'no_subscription');
  end if;

  select p.limits into merged from public.plans p where p.id = sub.plan_id;

  select coalesce(merged || jsonb_object_agg_merged.limits, merged) into merged
  from (
    select jsonb_merge_agg(m.limits) as limits
    from public.subscription_modules sm
    join public.modules m on m.id = sm.module_id
    where sm.subscription_id = sub.id and sm.status = 'active'
  ) as jsonb_object_agg_merged
  where jsonb_object_agg_merged.limits is not null;

  return jsonb_build_object(
    'active', (not sub.admin_suspended) and sub.status in ('trialing', 'active'),
    'suspended', sub.admin_suspended,
    'status', sub.status,
    'plan_id', sub.plan_id,
    'limits', coalesce(merged, '{}'::jsonb),
    'credit_balance', public.org_credit_balance(target_org)
  );
end;
$$;

-- ---------- updated_at maintenance ----------

create trigger plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

create trigger modules_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();


-- ############################################################
-- ## 0002_ai.sql
-- ############################################################

-- ============================================================
-- 0002_ai: instruction-driven AI assistants (superadmin-managed),
-- per-organization conversations/messages, and a private storage
-- bucket for image/audio attachments.
-- ============================================================

create type public.ai_provider as enum ('anthropic', 'gemini', 'openrouter');

-- ---------- Assistants (the "specific instructions" layer) ----------

create table public.assistants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  provider public.ai_provider not null default 'anthropic',
  -- Required. For openrouter this is the full model id (e.g.
  -- "anthropic/claude-sonnet-5"); for anthropic/gemini the native id.
  model text not null,
  -- The behavior contract: every chat with this assistant obeys these
  -- instructions. Edited by superadmins at runtime, no deploy needed.
  system_prompt text not null,
  temperature numeric(3, 2) not null default 0.7,
  max_tokens integer not null default 2048,
  -- Debited from the organization credit ledger on every user message.
  credits_per_message integer not null default 0,
  -- Reserved for future tools/RAG configuration.
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Conversations and messages (org-scoped) ----------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  assistant_id uuid not null references public.assistants (id),
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_org_idx on public.conversations (org_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- [{"kind": "image"|"audio", "path": "<storage path>", "mime": "..."}]
  attachments jsonb not null default '[]'::jsonb,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id);

-- ---------- RLS ----------

alter table public.assistants enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "assistants_select" on public.assistants for select to authenticated
  using (is_active or public.is_superadmin());
create policy "assistants_all_superadmin" on public.assistants for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy "conversations_select_member" on public.conversations for select to authenticated
  using (public.is_org_member(org_id));
create policy "conversations_insert_member" on public.conversations for insert to authenticated
  with check (public.is_org_member(org_id) and created_by = auth.uid());
create policy "conversations_update_member" on public.conversations for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "conversations_delete_creator" on public.conversations for delete to authenticated
  using (created_by = auth.uid() or public.is_superadmin());

create policy "messages_select_member" on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and public.is_org_member(c.org_id)
    )
  );
create policy "messages_insert_member" on public.messages for insert to authenticated
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and public.is_org_member(c.org_id)
    )
  );

-- ---------- Attachments bucket (private; path: <org_id>/...) ----------

insert into storage.buckets (id, name, public) values ('ai-attachments', 'ai-attachments', false);

create policy "ai_attachments_select_member" on storage.objects for select to authenticated
  using (bucket_id = 'ai-attachments' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "ai_attachments_insert_member" on storage.objects for insert to authenticated
  with check (bucket_id = 'ai-attachments' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "ai_attachments_delete_member" on storage.objects for delete to authenticated
  using (bucket_id = 'ai-attachments' and public.is_org_member(((storage.foldername(name))[1])::uuid));

-- ---------- updated_at maintenance ----------

create trigger assistants_updated_at
  before update on public.assistants
  for each row execute function public.set_updated_at();

create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------- Seed: example assistant (replace in derived projects) ----------

insert into public.assistants (slug, name, description, provider, model, system_prompt, sort)
values (
  'product-assistant',
  'Product Assistant',
  'Example assistant seeded by the template — edit or replace its instructions in /admin/ai.',
  'anthropic',
  'claude-sonnet-5',
  'You are the in-app assistant for this product. Answer questions about how to use the application, be concise and practical, and reply in the language the user writes in. If you are asked about something unrelated to the product or outside your knowledge, say so briefly instead of guessing. This is a template placeholder instruction set: derived projects must replace it with product-specific instructions.',
  0
);


-- ############################################################
-- ## 0003_knowledge.sql
-- ############################################################

-- ============================================================
-- 0003_knowledge: knowledge base with trust levels + pgvector RAG.
-- Collections are global (org_id null, superadmin-managed) or
-- org-scoped (managed by org owners/admins). Documents carry a
-- trust_level (1 = most authoritative .. 5 = unverified opinion)
-- that retrieval uses to prioritize evidence.
-- ============================================================

create extension if not exists vector with schema extensions;

-- ---------- Collections ----------

create table public.knowledge_collections (
  id uuid primary key default gen_random_uuid(),
  -- null = global collection (superadmin-managed, visible to everyone).
  org_id uuid references public.organizations (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (org_id, slug)
);

-- ---------- Documents ----------

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.knowledge_collections (id) on delete cascade,
  title text not null,
  -- Where the content came from (URL, file name, "manual"...). Informational.
  source text,
  -- 1 official source, 2 verified first-party data, 3 reported results,
  -- 4 internal playbook, 5 unverified/opinion. Lower = more authoritative.
  trust_level smallint not null default 5 check (trust_level between 1 and 5),
  -- Raw text to be chunked + embedded by the ingestion job.
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_documents_collection_idx on public.knowledge_documents (collection_id);

-- ---------- Chunks (the retrieval unit) ----------

-- 768 dimensions = Gemini text-embedding-004 (the template's embedder).
create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  idx integer not null,
  content text not null,
  embedding extensions.vector(768) not null,
  created_at timestamptz not null default now()
);

create index knowledge_chunks_document_idx on public.knowledge_chunks (document_id);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- ---------- RLS ----------

alter table public.knowledge_collections enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

-- Who can manage a collection: superadmin for global, owner/admin for org-scoped.
create or replace function public.can_manage_collection(target_collection uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.knowledge_collections c
    where c.id = target_collection
      and (
        (c.org_id is null and public.is_superadmin())
        or (c.org_id is not null and public.has_org_role(c.org_id, array['owner', 'admin']::public.org_role[]))
      )
  );
$$;

create policy "knowledge_collections_select" on public.knowledge_collections for select to authenticated
  using (org_id is null or public.is_org_member(org_id) or public.is_superadmin());
create policy "knowledge_collections_write_global" on public.knowledge_collections for all to authenticated
  using (org_id is null and public.is_superadmin())
  with check (org_id is null and public.is_superadmin());
create policy "knowledge_collections_write_org" on public.knowledge_collections for all to authenticated
  using (org_id is not null and public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  with check (org_id is not null and public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "knowledge_documents_select" on public.knowledge_documents for select to authenticated
  using (
    exists (
      select 1 from public.knowledge_collections c
      where c.id = collection_id
        and (c.org_id is null or public.is_org_member(c.org_id) or public.is_superadmin())
    )
  );
create policy "knowledge_documents_write" on public.knowledge_documents for all to authenticated
  using (public.can_manage_collection(collection_id))
  with check (public.can_manage_collection(collection_id));

create policy "knowledge_chunks_select" on public.knowledge_chunks for select to authenticated
  using (
    exists (
      select 1
      from public.knowledge_documents d
      join public.knowledge_collections c on c.id = d.collection_id
      where d.id = document_id
        and (c.org_id is null or public.is_org_member(c.org_id) or public.is_superadmin())
    )
  );
-- Chunk writes: whoever can manage the parent collection (inline ingestion
-- fallback runs as the user; the Inngest job uses the service role anyway).
create policy "knowledge_chunks_write" on public.knowledge_chunks for all to authenticated
  using (
    exists (
      select 1 from public.knowledge_documents d
      where d.id = document_id and public.can_manage_collection(d.collection_id)
    )
  )
  with check (
    exists (
      select 1 from public.knowledge_documents d
      where d.id = document_id and public.can_manage_collection(d.collection_id)
    )
  );

-- ---------- Retrieval RPC ----------

-- Security invoker: RLS decides which chunks the caller can see.
-- Ranking: cosine similarity plus a small bonus per trust level, so a
-- tier-1 chunk beats a tier-5 chunk of comparable relevance without
-- letting authoritative-but-irrelevant content crowd out good matches.
create or replace function public.knowledge_search(
  query_embedding extensions.vector(768),
  collections uuid[],
  match_count integer default 8,
  max_trust smallint default 5,
  min_similarity double precision default 0.25
)
returns table (
  chunk_id uuid,
  document_id uuid,
  collection_id uuid,
  title text,
  source text,
  trust_level smallint,
  content text,
  similarity double precision
)
language sql
stable
set search_path = ''
as $$
  select
    ch.id as chunk_id,
    d.id as document_id,
    d.collection_id,
    d.title,
    d.source,
    d.trust_level,
    ch.content,
    1 - (ch.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.knowledge_chunks ch
  join public.knowledge_documents d on d.id = ch.document_id
  where d.collection_id = any (collections)
    and d.status = 'ready'
    and d.trust_level <= max_trust
    and 1 - (ch.embedding operator(extensions.<=>) query_embedding) >= min_similarity
  order by
    (1 - (ch.embedding operator(extensions.<=>) query_embedding)) + (5 - d.trust_level) * 0.03 desc
  limit greatest(match_count, 1);
$$;

-- ---------- updated_at maintenance ----------

create trigger knowledge_collections_updated_at
  before update on public.knowledge_collections
  for each row execute function public.set_updated_at();

create trigger knowledge_documents_updated_at
  before update on public.knowledge_documents
  for each row execute function public.set_updated_at();


-- ############################################################
-- ## 0004_connectors.sql
-- ############################################################

-- ============================================================
-- 0004_connectors: per-organization connections to external APIs.
-- Visible metadata lives in `connections` (RLS: members read,
-- owners/admins manage). Credentials live in `connection_secrets`,
-- which has RLS enabled and NO policies: only the service role can
-- touch tokens — they never reach the browser.
-- ============================================================

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- Connector slug registered in @flyee/connectors (e.g. "meta-ads").
  provider text not null,
  name text not null,
  status text not null default 'connected' check (status in ('connected', 'error', 'disabled')),
  -- Provider-side identity/context (account id, scopes...). Non-secret.
  metadata jsonb not null default '{}'::jsonb,
  -- Incremental sync position, owned by the connector implementation.
  sync_cursor jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  sync_error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index connections_org_idx on public.connections (org_id);

create table public.connection_secrets (
  connection_id uuid primary key references public.connections (id) on delete cascade,
  -- Tokens / API keys as provided by the connector's auth flow.
  secret jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- RLS ----------

alter table public.connections enable row level security;
alter table public.connection_secrets enable row level security;
-- No policies on connection_secrets: service role only, by design.

create policy "connections_select_member" on public.connections for select to authenticated
  using (public.is_org_member(org_id));
create policy "connections_insert_manager" on public.connections for insert to authenticated
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));
create policy "connections_update_manager" on public.connections for update to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));
create policy "connections_delete_manager" on public.connections for delete to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

-- ---------- updated_at maintenance ----------

create trigger connections_updated_at
  before update on public.connections
  for each row execute function public.set_updated_at();

create trigger connection_secrets_updated_at
  before update on public.connection_secrets
  for each row execute function public.set_updated_at();


-- ############################################################
-- ## 0005_audit.sql
-- ############################################################

-- ============================================================
-- 0005_audit: compliance layer (LGPD / Lei 13.787-style needs).
-- 1. audit_events    — append-only trail of who did what.
-- 2. record_versions — immutable row history for tables a project
--    marks with enable_row_versioning() (mechanism only: the
--    template marks no tables).
-- 3. consent_terms / consent_acceptances — versioned terms and
--    per-subject acceptance records.
-- ============================================================

-- ---------- Audit events (append-only) ----------

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  -- Verb, project-defined (e.g. "patient.viewed", "document.issued").
  action text not null,
  entity_type text,
  entity_id text,
  -- What changed / extra context. Never store secrets here.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_org_idx on public.audit_events (org_id, created_at desc);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);

alter table public.audit_events enable row level security;

-- Append-only by construction: no update/delete policies exist.
create policy "audit_events_select_admin" on public.audit_events for select to authenticated
  using (
    public.is_superadmin()
    or (org_id is not null and public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  );
create policy "audit_events_insert_member" on public.audit_events for insert to authenticated
  with check (
    actor_id = auth.uid()
    and (public.is_superadmin() or (org_id is not null and public.is_org_member(org_id)))
  );

-- ---------- Immutable row versioning ----------

create table public.record_versions (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  org_id uuid,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  -- Full row snapshot (NEW for insert/update, OLD for delete).
  data jsonb not null,
  changed_by uuid,
  created_at timestamptz not null default now()
);

create index record_versions_record_idx on public.record_versions (table_name, record_id, created_at);

alter table public.record_versions enable row level security;

-- Read-only history: written exclusively by the trigger below
-- (security definer), no insert/update/delete policies.
create policy "record_versions_select_admin" on public.record_versions for select to authenticated
  using (
    public.is_superadmin()
    or (org_id is not null and public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  );

-- Trigger function: snapshots every write on marked tables.
-- Requires the table to have an `id uuid` primary key; an `org_id uuid`
-- column, when present, scopes who may read the history.
create or replace function public.audit_record_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot jsonb;
begin
  if tg_op = 'DELETE' then
    snapshot := to_jsonb(old);
  else
    snapshot := to_jsonb(new);
  end if;

  insert into public.record_versions (table_name, record_id, org_id, operation, data, changed_by)
  values (
    tg_table_name,
    (snapshot ->> 'id')::uuid,
    case when snapshot ? 'org_id' then (snapshot ->> 'org_id')::uuid else null end,
    tg_op,
    snapshot,
    auth.uid()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Mechanism only: derived projects mark their sensitive tables in their
-- own migrations, e.g.  select public.enable_row_versioning('public.patients');
create or replace function public.enable_row_versioning(target regclass)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists audit_row_versions on %s', target);
  execute format(
    'create trigger audit_row_versions after insert or update or delete on %s
       for each row execute function public.audit_record_version()',
    target
  );
end;
$$;

-- ---------- Consents (versioned terms + acceptances) ----------

create table public.consent_terms (
  id uuid primary key default gen_random_uuid(),
  -- Scope of the consent (e.g. "treatment", "audio-recording", "ai-processing").
  slug text not null,
  version integer not null default 1,
  title text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (slug, version)
);

create table public.consent_acceptances (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.consent_terms (id),
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- Who consented, project-defined (e.g. "patient" + patient id, "user" + user id).
  subject_type text not null,
  subject_id text not null,
  recorded_by uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index consent_acceptances_subject_idx on public.consent_acceptances (org_id, subject_type, subject_id);

alter table public.consent_terms enable row level security;
alter table public.consent_acceptances enable row level security;

create policy "consent_terms_select" on public.consent_terms for select to authenticated
  using (true);
create policy "consent_terms_all_superadmin" on public.consent_terms for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy "consent_acceptances_select_member" on public.consent_acceptances for select to authenticated
  using (public.is_org_member(org_id));
create policy "consent_acceptances_insert_member" on public.consent_acceptances for insert to authenticated
  with check (public.is_org_member(org_id) and recorded_by = auth.uid());
-- Revocation is the only permitted change (set revoked_at); rows are never deleted.
create policy "consent_acceptances_update_member" on public.consent_acceptances for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));


-- ############################################################
-- ## 0006_documents.sql
-- ############################################################

-- ============================================================
-- 0006_documents: issued documents (professional records, invoices,
-- certificates...) with versioning, content hash and a public
-- verification code (QR target). PDFs live in the private
-- "documents" bucket; verification exposes only non-sensitive
-- fields via a security-definer RPC.
-- ============================================================

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- Project-defined template slug (e.g. "session-plan", "prescription", "invoice").
  kind text not null,
  title text not null,
  -- Data the project used to render the document (not exposed by verification).
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  -- Previous version of this document, when reissued.
  parent_id uuid references public.documents (id),
  status text not null default 'draft' check (status in ('draft', 'issued', 'revoked')),
  -- Public verification code printed as QR on the document.
  verify_code text not null unique,
  -- sha256 of the stored PDF, proving integrity at verification time.
  content_hash text,
  storage_path text,
  issued_by uuid references public.profiles (id) on delete set null,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_org_idx on public.documents (org_id, created_at desc);

-- ---------- RLS ----------

alter table public.documents enable row level security;

create policy "documents_select_member" on public.documents for select to authenticated
  using (public.is_org_member(org_id));
create policy "documents_insert_manager" on public.documents for insert to authenticated
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));
create policy "documents_update_manager" on public.documents for update to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));
-- Issued documents are never deleted (revoke instead); drafts may be discarded.
create policy "documents_delete_draft" on public.documents for delete to authenticated
  using (status = 'draft' and public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

-- ---------- Storage bucket (private; path: <org_id>/...) ----------

insert into storage.buckets (id, name, public) values ('documents', 'documents', false);

create policy "documents_bucket_select_member" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "documents_bucket_insert_manager" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']::public.org_role[])
  );

-- ---------- Public verification (QR target) ----------

-- Anonymous-callable, security definer: exposes only what a third party
-- needs to check authenticity — never the payload or the file itself.
create or replace function public.verify_document(code text)
returns table (
  kind text,
  title text,
  status text,
  version integer,
  issued_at timestamptz,
  content_hash text,
  organization_name text
)
language sql
security definer
set search_path = ''
stable
as $$
  select d.kind, d.title, d.status, d.version, d.issued_at, d.content_hash, o.name as organization_name
  from public.documents d
  join public.organizations o on o.id = d.org_id
  where d.verify_code = code and d.status in ('issued', 'revoked');
$$;

grant execute on function public.verify_document(text) to anon, authenticated;

-- ---------- updated_at maintenance ----------

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();


-- ############################################################
-- ## 0007_transcriptions.sql
-- ############################################################

-- ============================================================
-- 0007_transcriptions: audio -> diarized transcript pipeline.
-- Audio is uploaded to the private "transcriptions" bucket, a job
-- transcribes it (speaker separation + timestamps) and, when
-- delete_audio_after is set, the source audio is removed once the
-- transcript is ready (retention by design — e.g. consultation
-- recordings that must not outlive their validated transcript).
-- ============================================================

create table public.transcriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- Path inside the "transcriptions" bucket; nulled after retention delete.
  audio_path text,
  mime text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  error text,
  -- Remove the source audio as soon as the transcript is ready.
  delete_audio_after boolean not null default false,
  -- { "language": "...", "segments": [{ "speaker", "start", "text" }] }
  result jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transcriptions_org_idx on public.transcriptions (org_id, created_at desc);

-- ---------- RLS ----------

alter table public.transcriptions enable row level security;

create policy "transcriptions_select_member" on public.transcriptions for select to authenticated
  using (public.is_org_member(org_id));
create policy "transcriptions_insert_member" on public.transcriptions for insert to authenticated
  with check (public.is_org_member(org_id) and created_by = auth.uid());
create policy "transcriptions_update_member" on public.transcriptions for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "transcriptions_delete_creator" on public.transcriptions for delete to authenticated
  using (
    created_by = auth.uid()
    or public.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
  );

-- ---------- Storage bucket (private; path: <org_id>/...) ----------

insert into storage.buckets (id, name, public) values ('transcriptions', 'transcriptions', false);

create policy "transcriptions_bucket_select_member" on storage.objects for select to authenticated
  using (bucket_id = 'transcriptions' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "transcriptions_bucket_insert_member" on storage.objects for insert to authenticated
  with check (bucket_id = 'transcriptions' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "transcriptions_bucket_delete_member" on storage.objects for delete to authenticated
  using (bucket_id = 'transcriptions' and public.is_org_member(((storage.foldername(name))[1])::uuid));

-- ---------- updated_at maintenance ----------

create trigger transcriptions_updated_at
  before update on public.transcriptions
  for each row execute function public.set_updated_at();


-- ############################################################
-- ## 0008_whatsapp.sql
-- ############################################################

-- ============================================================
-- 0008_whatsapp: message log for the WhatsApp dispatcher.
-- Every outbound (manual, automatic or scheduled) and inbound
-- message is recorded here — the auditable trail of what was
-- sent to whom. Providers (Meta Cloud API / Evolution API) are
-- selected by env in @flyee/whatsapp.
-- ============================================================

create table public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: inbound messages arrive before the project resolves the org.
  org_id uuid references public.organizations (id) on delete cascade,
  direction text not null check (direction in ('out', 'in')),
  -- E.164-ish digits, e.g. 5511999999999.
  to_number text,
  from_number text,
  kind text not null default 'text' check (kind in ('text', 'template')),
  text text,
  template text,
  template_params jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'received', 'canceled')),
  error text,
  provider text,
  provider_message_id text,
  -- Future timestamp = scheduled send (the Inngest job sleeps until then).
  send_at timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wa_messages_org_idx on public.wa_messages (org_id, created_at desc);
create index wa_messages_provider_idx on public.wa_messages (provider, provider_message_id);

-- ---------- RLS ----------

alter table public.wa_messages enable row level security;

-- No delete policy: the log is part of the audit trail.
create policy "wa_messages_select_member" on public.wa_messages for select to authenticated
  using (public.is_superadmin() or (org_id is not null and public.is_org_member(org_id)));
create policy "wa_messages_insert_member" on public.wa_messages for insert to authenticated
  with check (
    direction = 'out'
    and created_by = auth.uid()
    and org_id is not null
    and public.is_org_member(org_id)
  );
create policy "wa_messages_update_member" on public.wa_messages for update to authenticated
  using (org_id is not null and public.is_org_member(org_id))
  with check (org_id is not null and public.is_org_member(org_id));

-- ---------- updated_at maintenance ----------

create trigger wa_messages_updated_at
  before update on public.wa_messages
  for each row execute function public.set_updated_at();


-- ############################################################
-- ## 0009_meta_ads.sql
-- ############################################################

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


-- ############################################################
-- ## 0010_product_context.sql
-- ############################################################

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

