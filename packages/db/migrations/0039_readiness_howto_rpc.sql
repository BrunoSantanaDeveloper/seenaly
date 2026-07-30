-- ============================================================
-- 0039_readiness_howto_rpc: how-to cache insert + charge, one transaction,
-- one charge under the double-click race.
--
-- Marker for scripts/apply-migrations.mjs = create function public.record_readiness_howto_and_charge
--
-- The defect this closes: generateFindingHowTo charged FIRST and then ran the
-- readiness_howtos insert with its result UNCHECKED — a failed insert
-- (including the 23505 race on unique(diagnosis_id, finding_index), which is
-- exactly what two parallel clicks produce) charged the org and lost the
-- cache, so the next click charged again for the same answer.
--
-- Race semantics under READ COMMITTED, verified against the 0031 unique
-- constraint: the loser's speculative insert waits on the winner's
-- transaction; once the winner commits (row + charge), the loser's ON CONFLICT
-- DO NOTHING yields null — the function then returns the committed winner row
-- WITHOUT charging. Exactly one charge, both callers get identical content:
-- the cache row is the idempotency key, honored.
--
-- The assistant slug is fixed here (single consumer; a caller must never be
-- able to price-shop via a parameter). Authorization failures use errcode
-- 42501 so they can never be mistaken for the P0001 "insufficient balance"
-- signal the nested block catches.
-- ============================================================

create function public.record_readiness_howto_and_charge(
  p_diagnosis uuid,
  p_finding_index integer,
  p_steps jsonb,
  p_sources jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_cost integer;
  v_id uuid;
  v_result jsonb;
begin
  select d.org_id into v_org
  from public.diagnoses d
  where d.id = p_diagnosis and d.scope = 'readiness';
  if v_org is null or not public.is_org_member(v_org) then
    raise exception 'verdict not found or not a member' using errcode = '42501';
  end if;

  select coalesce(a.credits_per_message, 0) into v_cost
  from public.assistants a
  where a.slug = 'readiness-howto';
  v_cost := coalesce(v_cost, 0);

  begin
    insert into public.readiness_howtos (diagnosis_id, org_id, finding_index, steps, sources, created_by)
    values (p_diagnosis, v_org, p_finding_index, coalesce(p_steps, '[]'::jsonb), coalesce(p_sources, '[]'::jsonb), auth.uid())
    on conflict (diagnosis_id, finding_index) do nothing
    returning id into v_id;

    if v_id is null then
      -- Lost the race: hand back the winner's cached content, charge nothing.
      select jsonb_build_object('ok', true, 'raced', true, 'steps', h.steps, 'sources', h.sources)
      into v_result
      from public.readiness_howtos h
      where h.diagnosis_id = p_diagnosis and h.finding_index = p_finding_index;
      return coalesce(v_result, jsonb_build_object('ok', false, 'code', 'save_failed'));
    end if;

    if v_cost > 0 then
      perform public.consume_credits(v_org, v_cost, p_reason);
    end if;

    return jsonb_build_object('ok', true, 'raced', false, 'id', v_id, 'charged', v_cost);
  exception when raise_exception then
    -- Subtransaction rollback: no orphan free cache row survives, so a retry
    -- after a top-up can still succeed and will charge exactly once.
    return jsonb_build_object('ok', false, 'code', 'insufficient_credits');
  end;
end;
$$;

revoke execute on function public.record_readiness_howto_and_charge(uuid, integer, jsonb, jsonb, text) from public, anon;
grant execute on function public.record_readiness_howto_and_charge(uuid, integer, jsonb, jsonb, text) to authenticated;
