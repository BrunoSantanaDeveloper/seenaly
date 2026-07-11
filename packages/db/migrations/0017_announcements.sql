-- ============================================================
-- 0017_announcements: system-wide announcements published by the
-- superadmin and shown to every signed-in user until dismissed.
-- ============================================================

create type public.announcement_level as enum ('info', 'warning', 'critical');

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  level public.announcement_level not null default 'info',
  -- Optional "learn more" destination (internal path or full URL).
  href text,
  starts_at timestamptz not null default now(),
  -- Null = shown until deactivated.
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.announcement_dismissals (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

-- ---------- RLS ----------

alter table public.announcements enable row level security;
alter table public.announcement_dismissals enable row level security;

-- Users see only what is currently live; superadmin sees and manages all.
create policy "announcements_select_live" on public.announcements
  for select to authenticated
  using (
    public.is_superadmin()
    or (is_active and starts_at <= now() and (ends_at is null or ends_at > now()))
  );

create policy "announcements_all_superadmin" on public.announcements
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy "announcement_dismissals_select_own" on public.announcement_dismissals
  for select to authenticated
  using (user_id = auth.uid());

create policy "announcement_dismissals_insert_own" on public.announcement_dismissals
  for insert to authenticated
  with check (user_id = auth.uid());

-- ---------- updated_at maintenance ----------

create trigger announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();
