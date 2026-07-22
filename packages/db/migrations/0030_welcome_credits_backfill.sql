-- ============================================================
-- 0030_welcome_credits_backfill: give pre-0025 organizations their welcome credits.
--
-- 0025 grants `limits.welcome_credits` from the organization-creation trigger.
-- Every org created BEFORE that migration was applied therefore has an empty
-- ledger and no way to fill it: the free plan has no `credits_monthly`, and
-- checkout is disabled while billing is mocked. The result is an account that
-- cannot run a single diagnosis or readiness check — the product is unusable
-- for them, silently, with only "insufficient credits" as an explanation.
--
-- Found in production on 2026-07-22: org "VetFun" (created 2026-07-16, free
-- plan, welcome_credits = 25) had ZERO credit_transactions rows.
--
-- IMPORTANT — marker ordering: scripts/apply-migrations.mjs derives the marker
-- from the FIRST `create [or replace] function public.X` in the file. The new
-- `backfill_welcome_credits` must therefore be declared BEFORE the
-- `create or replace` of `grant_welcome_credits`, otherwise the marker would
-- resolve to a function that already exists and this migration would be
-- skipped silently.
--
-- Marker for scripts/apply-migrations.mjs = create function public.backfill_welcome_credits.
-- ============================================================

-- Idempotent by construction: only orgs with no welcome grant are touched, so
-- re-running is a no-op. Returns how many orgs were granted.
create function public.backfill_welcome_credits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  granted integer;
begin
  with target as (
    -- One subscription per org: prefer the active one, then the most recent
    -- (canceled history rows must never decide the plan).
    select distinct on (o.id)
      o.id as org_id,
      nullif(p.limits->>'welcome_credits', '')::integer as welcome
    from public.organizations o
    join public.subscriptions s on s.org_id = o.id
    join public.plans p on p.id = s.plan_id
    where not exists (
      select 1 from public.credit_transactions ct
      where ct.org_id = o.id and ct.description = 'Créditos de boas-vindas'
    )
    order by o.id, (s.status = 'active') desc, s.created_at desc
  )
  insert into public.credit_transactions (org_id, amount, kind, description)
  select org_id, welcome, 'grant', 'Créditos de boas-vindas'
  from target
  where welcome is not null and welcome > 0;

  get diagnostics granted = row_count;
  return granted;
end;
$$;

-- Harden the original: 0025 inserted unconditionally, relying on the trigger
-- firing exactly once. A re-fired trigger, a restore, or a manual call would
-- double-grant. Make the grant itself idempotent.
create or replace function public.grant_welcome_credits(target_org uuid, target_plan uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  welcome integer;
begin
  if exists (
    select 1 from public.credit_transactions
    where org_id = target_org and description = 'Créditos de boas-vindas'
  ) then
    return;
  end if;

  select nullif(p.limits->>'welcome_credits', '')::integer
    into welcome
  from public.plans p
  where p.id = target_plan;

  if welcome is not null and welcome > 0 then
    insert into public.credit_transactions (org_id, amount, kind, description)
    values (target_org, welcome, 'grant', 'Créditos de boas-vindas');
  end if;
end;
$$;

-- Run it for everyone who missed out.
select public.backfill_welcome_credits();
