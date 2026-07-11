-- ============================================================
-- 0016_admin: platform administration foundation.
--
-- Gives superadmins read access to the multi-tenant core tables
-- (profiles, organizations, memberships, invites) so the /admin
-- consoles can browse them, and adds an admin_metrics() RPC with
-- real platform numbers. RLS stays the real gate everywhere.
-- ============================================================

-- ---------- Superadmin read access to the tenant core ----------

create policy "profiles_select_superadmin" on public.profiles
  for select to authenticated
  using (public.is_superadmin());

create policy "organizations_select_superadmin" on public.organizations
  for select to authenticated
  using (public.is_superadmin());

create policy "memberships_select_superadmin" on public.memberships
  for select to authenticated
  using (public.is_superadmin());

create policy "invites_select_superadmin" on public.invites
  for select to authenticated
  using (public.is_superadmin());

-- ---------- Platform metrics ----------

-- Real aggregate numbers for the /admin overview. Security definer so
-- it can aggregate across tenants, but callable by superadmins only.
create or replace function public.admin_metrics()
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

  select jsonb_build_object(
    'orgs', (select count(*) from public.organizations),
    'users', (select count(*) from public.profiles),
    'new_orgs_30d', (
      select count(*) from public.organizations
      where created_at > now() - interval '30 days'
    ),
    'new_users_30d', (
      select count(*) from public.profiles
      where created_at > now() - interval '30 days'
    ),
    'subscriptions', (
      select coalesce(jsonb_object_agg(s.status, s.total), '{}'::jsonb)
      from (
        select status::text as status, count(*) as total
        from public.subscriptions
        group by status
      ) s
    ),
    'suspended', (
      select count(*) from public.subscriptions
      where admin_suspended and status in ('trialing', 'active', 'past_due')
    ),
    -- Monthly recurring revenue per currency: live paid recurring plans
    -- normalized to a monthly amount (yearly / 12, weekly * 52 / 12).
    'mrr', (
      select coalesce(
        jsonb_agg(jsonb_build_object('currency', m.currency, 'amount_cents', m.amount_cents) order by m.currency),
        '[]'::jsonb
      )
      from (
        select p.currency,
               sum(
                 case p.period
                   when 'monthly' then p.price_cents::numeric
                   when 'yearly' then round(p.price_cents / 12.0)
                   when 'weekly' then round(p.price_cents * 52 / 12.0)
                   else 0
                 end
               )::bigint as amount_cents
        from public.subscriptions s
        join public.plans p on p.id = s.plan_id
        where s.status in ('active', 'past_due')
          and not s.admin_suspended
          and p.kind = 'recurring'
          and p.price_cents > 0
        group by p.currency
      ) m
    ),
    'credits_consumed_30d', (
      select coalesce(-sum(amount), 0)::bigint
      from public.credit_transactions
      where kind = 'consumption' and created_at > now() - interval '30 days'
    )
  ) into result;

  return result;
end;
$$;
