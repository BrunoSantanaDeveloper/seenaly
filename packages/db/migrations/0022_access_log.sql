-- ============================================================
-- 0022_access_log: sign-in trail ("registro de acessos").
-- Every new auth session (= one real sign-in; token refresh reuses
-- the session row) is copied to public.access_events by a trigger
-- on auth.sessions — same pattern as on_auth_user_created (0000).
-- Users see their own history at /settings/security; the superadmin
-- sees everything in /admin/audit → Access.
-- ============================================================

create table public.access_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ip text,
  user_agent text,
  -- Assurance level at session creation: aal1 (password/OAuth) or aal2 (after 2FA).
  aal text,
  created_at timestamptz not null default now()
);

create index access_events_user_idx on public.access_events (user_id, created_at desc);
create index access_events_created_idx on public.access_events (created_at desc);

-- ---------- RLS ----------

alter table public.access_events enable row level security;

create policy "access_events_select_own" on public.access_events
  for select to authenticated
  using (user_id = auth.uid());

create policy "access_events_select_superadmin" on public.access_events
  for select to authenticated
  using (public.is_superadmin());

-- Append-only by construction: written exclusively by the security-definer
-- trigger below; no insert/update/delete policies exist.

-- ---------- Trigger on auth.sessions ----------

-- Reads NEW through jsonb so the function tolerates auth-schema column
-- differences across Supabase versions, and swallows every error: a
-- logging failure must never take a sign-in down.
create or replace function public.log_access_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb := to_jsonb(new);
begin
  insert into public.access_events (user_id, ip, user_agent, aal)
  values (
    (payload ->> 'user_id')::uuid,
    nullif(payload ->> 'ip', ''),
    nullif(payload ->> 'user_agent', ''),
    coalesce(payload ->> 'aal', 'aal1')
  );
  return new;
exception when others then
  return new;
end;
$$;

-- If your Supabase project restricts triggers on the auth schema, drop
-- this trigger and rely on the dashboard's Auth logs instead — the
-- access_events table and its UI degrade to empty gracefully.
create trigger on_auth_session_created
  after insert on auth.sessions
  for each row execute function public.log_access_event();
