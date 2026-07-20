-- 0025: credit policy — welcome credits for new organizations.
--
-- The activation journey ends in a diagnosis (5 credits), but a brand-new org
-- on the free plan was born with an empty ledger and no way to buy credits
-- while checkout is disabled (mock billing). This migration grants the free
-- plan's `limits.welcome_credits` once, at organization creation, so the aha
-- moment is reachable for an organic signup.
--
-- Monthly credits for paid plans (`limits.credits_monthly`) are granted by the
-- billing Inngest cron (packages/billing/src/jobs.ts) / scripts/grant-monthly-credits.mjs,
-- NOT here: the membership-gated RPCs cannot run in that context and renewal is
-- a schedule concern, not a trigger concern.

-- Reads the assigned plan's welcome_credits limit and grants it once.
-- Security definer: runs from the organizations trigger, before any membership
-- exists, so RLS on credit_transactions cannot apply.
create function public.grant_welcome_credits(target_org uuid, target_plan uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  welcome integer;
begin
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

-- Same behavior as 0001 (assign the free plan) + the welcome grant.
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

    perform public.grant_welcome_credits(new.id, free_plan.id);
  end if;

  return new;
end;
$$;
