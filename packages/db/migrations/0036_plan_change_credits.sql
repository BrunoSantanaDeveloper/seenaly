-- ============================================================
-- 0036_plan_change_credits: moving a tenant to a paid plan now delivers that
-- plan's monthly allowance, instead of leaving them on the leftovers.
--
-- What 0035 got wrong. `admin_set_org_plan` deliberately granted nothing, to
-- avoid double-granting against the monthly cron. The result in practice: an
-- org moved from Free to Pro sat at the 2 credits left over from its welcome
-- grant, on a R$ 197 plan, until the NEXT month's cron — because
-- `grantMonthlyCredits` had already run for the current month, when the org
-- was still on Free (Free has no `credits_monthly`, so it was skipped). The
-- operator's only exit was a manual adjustment, which the cron cannot see and
-- would therefore top up AGAIN — the very double-grant 0035 was avoiding.
--
-- The fix is to share the cron's idempotency key instead of avoiding the
-- grant: one grant per org per calendar month, identified by the exact
-- description `packages/billing/src/credits.ts` writes
-- ('Créditos mensais do plano — YYYY-MM', month bucketed in America/Sao_Paulo).
-- Whoever gets there first wins — console, cron or `npm run db:grant-credits`
-- — and the other two skip. Keep this string in sync with
-- `monthlyGrantDescription()`; it is the contract between them.
--
-- Both functions return jsonb so the console can TELL the operator what
-- happened ("500 granted" vs "already granted this month"), instead of
-- leaving them to guess from a balance that did not move.
--
-- Marker for scripts/apply-migrations.mjs = create function public.admin_grant_monthly_credits.
-- ============================================================

create or replace function public.admin_grant_monthly_credits(target_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  month text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');
  -- Named to avoid colliding with credit_transactions.description inside the
  -- queries below (plpgsql would resolve the bare name ambiguously).
  grant_description text;
  sub record;
  monthly integer;
  balance integer;
begin
  if not public.is_superadmin() then
    raise exception 'superadmin only';
  end if;
  grant_description := 'Créditos mensais do plano — ' || month;

  balance := coalesce((
    select sum(ct.amount)
    from public.credit_transactions ct
    where ct.org_id = target_org
      and (ct.expires_at is null or ct.expires_at > now())
  ), 0)::integer;

  select s.status, s.admin_suspended, nullif(p.limits->>'credits_monthly', '')::integer as monthly
  into sub
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.org_id = target_org
    and s.status in ('trialing', 'active', 'past_due')
  order by s.created_at desc
  limit 1;

  -- `sub.status is null` rather than FOUND: a no-row SELECT INTO assigns NULLs,
  -- and that test cannot be invalidated by a statement added above it later.
  if sub.status is null then
    return jsonb_build_object('granted', false, 'reason', 'no_subscription', 'month', month, 'balance', balance);
  end if;
  -- Same guards the cron applies: a suspended or not-yet-paying subscription
  -- must not be fed credits by a plan move.
  if sub.admin_suspended then
    return jsonb_build_object('granted', false, 'reason', 'suspended', 'month', month, 'balance', balance);
  end if;
  if sub.status not in ('trialing', 'active') then
    return jsonb_build_object('granted', false, 'reason', 'inactive', 'month', month, 'balance', balance);
  end if;

  monthly := sub.monthly;
  if monthly is null or monthly <= 0 then
    return jsonb_build_object('granted', false, 'reason', 'no_monthly_credits', 'month', month, 'balance', balance);
  end if;

  if exists (
    select 1 from public.credit_transactions ct
    where ct.org_id = target_org and ct.kind = 'grant' and ct.description = grant_description
  ) then
    return jsonb_build_object(
      'granted', false, 'reason', 'already_granted', 'amount', monthly, 'month', month, 'balance', balance
    );
  end if;

  insert into public.credit_transactions (org_id, amount, kind, description, created_by)
  values (target_org, monthly, 'grant', grant_description, auth.uid());

  return jsonb_build_object(
    'granted', true, 'reason', null, 'amount', monthly, 'month', month, 'balance', balance + monthly
  );
end;
$$;

-- Return type changes from uuid to jsonb, so the 0035 version has to go first.
drop function if exists public.admin_set_org_plan(uuid, uuid);

-- Moves the org and immediately settles the new plan's monthly allowance.
-- `admin_suspended` is still left untouched: paying for a plan and having
-- access restored are different decisions, and only the operator makes the
-- second one.
create or replace function public.admin_set_org_plan(target_org uuid, target_plan uuid)
returns jsonb
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

  return jsonb_build_object(
    'subscription_id', live_id,
    'credits', public.admin_grant_monthly_credits(target_org)
  );
end;
$$;
