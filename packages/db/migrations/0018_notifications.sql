-- ============================================================
-- 0018_notifications: real in-app notifications behind the header
-- bell. Rows are created by server code (service role) or database
-- triggers; users read and mark their own as read.
-- ============================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Free-form family used to pick the icon in the bell (system, team,
  -- billing, ...). Derived projects add their own.
  type text not null default 'system',
  title text not null,
  body text,
  -- Optional destination opened when the notification is clicked.
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------- RLS ----------

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

-- Users only flip their own read_at; creation stays server-side
-- (service role bypasses RLS) or in security-definer triggers.
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- Built-in emitter: team joins ----------

-- Generic, template-worthy signal: when someone joins an organization,
-- its owners are notified. Serves as the reference implementation for
-- project-specific triggers.
create or replace function public.notify_org_owners_on_member_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_name text;
  member_name text;
begin
  select name into org_name from public.organizations where id = new.org_id;
  select display_name into member_name from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, type, title, href)
  select m.user_id,
         'team',
         coalesce(member_name, 'A new member') || ' joined ' || coalesce(org_name, 'your organization'),
         '/settings/organization'
  from public.memberships m
  where m.org_id = new.org_id and m.role = 'owner' and m.user_id <> new.user_id;

  return new;
end;
$$;

create trigger on_membership_created_notify
  after insert on public.memberships
  for each row execute function public.notify_org_owners_on_member_join();
