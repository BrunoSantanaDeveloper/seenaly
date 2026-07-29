-- ============================================================
-- 0035_admin_controls: close the privilege-escalation hole on `profiles`
-- and give the tenants console the two levers it never had (credits, plan).
--
-- THE HOLE. `profiles_update_own` (0000) authorizes UPDATE on your own row
-- with no column restriction, and Supabase grants UPDATE on every public
-- table to `authenticated`. Any signed-in user could therefore call
-- `PATCH /rest/v1/profiles?id=eq.<own id>` with {"is_superadmin": true} and
-- promote themselves — which opens every /admin console and every
-- `*_all_superadmin` policy in the database (billing, credits, knowledge,
-- audit, the read-only SQL console...). The role must never be assignable
-- from a client session.
--
-- Two layers, on purpose:
--   * column privileges — `authenticated` may write display_name/avatar_url
--     and nothing else, so the escalation is refused before RLS even runs;
--   * a trigger — states the rule with a readable message and survives a
--     future `grant all on all tables` (a Supabase reset, a copied bootstrap
--     script) silently handing the column back.
-- Granting the role stays possible from the service role (the Users console
-- toggle) and from SQL as `postgres` (the first superadmin, see docs/LAUNCH.md)
-- — the platform's own hands, never the browser's.
--
-- THE TWO CONSOLE RPCs. The console cannot reuse the customer-facing credit
-- functions: `org_credit_balance()` is membership-gated and a superadmin is
-- NOT a member of the tenants they operate (it would report 0 for every org).
-- Both new functions are superadmin-only, and the caller records the audit
-- event — the operator's hand on a tenant's balance or plan is never silent.
--
-- Marker for scripts/apply-migrations.mjs = create function public.guard_profile_privileges.
-- ============================================================

-- ---------- 1. Privilege escalation guard ----------

-- SECURITY INVOKER (the default) on purpose: the check reads `current_user`,
-- which a security-definer function would report as the function owner.
create function public.guard_profile_privileges()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_superadmin is distinct from old.is_superadmin
     and current_user in ('authenticated', 'anon') then
    raise exception 'is_superadmin cannot be changed from a client session'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- The columns a user legitimately edits at /settings. Everything else on the
-- row (is_superadmin today, any future flag) is platform-owned.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- ---------- 2. Credit balances for the tenants console ----------

-- org_id (text) -> usable balance, for every organization, in one round trip.
create or replace function public.admin_credit_balances()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'superadmin only';
  end if;

  select coalesce(jsonb_object_agg(b.org_id::text, b.balance), '{}'::jsonb)
  into result
  from (
    select o.id as org_id,
           coalesce((
             select sum(ct.amount)
             from public.credit_transactions ct
             where ct.org_id = o.id
               and (ct.expires_at is null or ct.expires_at > now())
           ), 0)::integer as balance
    from public.organizations o
  ) b;

  return result;
end;
$$;

-- ---------- 3. Manual credit adjustment ----------

-- Positive tops an organization up, negative claws credits back. Recorded as
-- kind 'adjustment' with the operator as `created_by`, so a manual grant is
-- never confused with a plan grant or a purchase in the ledger.
create or replace function public.admin_grant_credits(target_org uuid, amount integer, note text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  balance integer;
begin
  if not public.is_superadmin() then
    raise exception 'superadmin only';
  end if;
  if amount = 0 then
    raise exception 'amount must not be zero';
  end if;
  if not exists (select 1 from public.organizations where id = target_org) then
    raise exception 'organization not found';
  end if;

  select coalesce(sum(ct.amount), 0)::integer
  into balance
  from public.credit_transactions ct
  where ct.org_id = target_org
    and (ct.expires_at is null or ct.expires_at > now());

  -- A negative balance would make every entitlement check ambiguous; refuse
  -- the clawback instead of leaving the org in a state the app cannot read.
  if balance + amount < 0 then
    raise exception 'adjustment would leave a negative balance (balance: %, adjustment: %)', balance, amount;
  end if;

  insert into public.credit_transactions (org_id, amount, kind, description, created_by)
  values (
    target_org,
    amount,
    'adjustment',
    coalesce(nullif(btrim(note), ''), 'Ajuste manual do superadmin'),
    auth.uid()
  );

  return balance + amount;
end;
$$;

-- ---------- 4. Move an organization onto a plan ----------

-- Updates the live subscription (or creates one when the org has none) and
-- returns its id. Deliberately does NOT grant the new plan's credits: the
-- operator decides that with admin_grant_credits, so a plan fix never
-- silently doubles a balance. `admin_suspended` is left untouched — moving a
-- suspended org to another plan must not quietly restore its access.
create or replace function public.admin_set_org_plan(target_org uuid, target_plan uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_period public.billing_period;
  live_id uuid;
begin
  if not public.is_superadmin() then
    raise exception 'superadmin only';
  end if;

  select p.period into plan_period from public.plans p where p.id = target_plan;
  if not found then
    raise exception 'plan not found';
  end if;
  if not exists (select 1 from public.organizations where id = target_org) then
    raise exception 'organization not found';
  end if;

  select s.id into live_id
  from public.subscriptions s
  where s.org_id = target_org
    and s.status in ('trialing', 'active', 'past_due')
  order by s.created_at desc
  limit 1;

  if live_id is null then
    insert into public.subscriptions (org_id, plan_id, status, period)
    values (target_org, target_plan, 'active', plan_period)
    returning id into live_id;
  else
    update public.subscriptions
    set plan_id = target_plan,
        period = plan_period
    where id = live_id;
  end if;

  return live_id;
end;
$$;
