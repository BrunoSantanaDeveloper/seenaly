-- ============================================================
-- 0040_readiness_run_lock: at most one readiness generation per product.
--
-- Two tabs (or a double submit) used to run two full RAG+LLM generations and
-- charge twice — the client `busy` flag only ever guarded one tab. Advisory
-- locks do not fit this architecture (each supabase-js RPC is its own pooled
-- PostgREST transaction, so a transaction lock releases before the LLM call
-- and a session lock leaks on a connection we never see again); a
-- recent-verdict window check fails the actual race (both requests start
-- before either inserts). So: a persisted one-row-per-product lock with a TTL,
-- claimed and released through two SECURITY DEFINER functions.
--
-- The TTL (default 180s) makes a crashed server action self-heal: a lock older
-- than the TTL is silently reclaimed by the next caller. 180s comfortably
-- covers the worst observed generation under the 16384-token budget (0037).
--
-- RLS is ENABLED with NO policies on purpose: the two functions are the only
-- access path, and both re-check membership explicitly (SECURITY DEFINER
-- bypasses RLS). Any future policy on this table must keep the RPC path
-- authoritative.
-- ============================================================

create table public.readiness_run_locks (
  product_id uuid primary key references public.products (id) on delete cascade,
  locked_at timestamptz not null default now(),
  locked_by uuid references public.profiles (id) on delete set null
);

alter table public.readiness_run_locks enable row level security;

create function public.claim_readiness_run(target_product uuid, ttl_seconds integer default 180)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed uuid;
begin
  if not exists (
    select 1 from public.products p
    where p.id = target_product and public.is_org_member(p.org_id)
  ) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;

  -- Atomic claim: concurrent callers serialize on the row and exactly one
  -- wins; a stale lock (older than the TTL) is reclaimed in the same
  -- statement, so no janitor is needed.
  insert into public.readiness_run_locks as l (product_id, locked_at, locked_by)
  values (target_product, now(), auth.uid())
  on conflict (product_id) do update
    set locked_at = excluded.locked_at, locked_by = excluded.locked_by
    where l.locked_at < now() - make_interval(secs => ttl_seconds)
  returning product_id into v_claimed;

  return v_claimed is not null;
end;
$$;

create function public.release_readiness_run(target_product uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.products p
    where p.id = target_product and public.is_org_member(p.org_id)
  ) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;

  delete from public.readiness_run_locks where product_id = target_product;
end;
$$;

revoke execute on function public.claim_readiness_run(uuid, integer) from public, anon;
grant execute on function public.claim_readiness_run(uuid, integer) to authenticated;
revoke execute on function public.release_readiness_run(uuid) from public, anon;
grant execute on function public.release_readiness_run(uuid) to authenticated;
