-- ============================================================
-- 0038_readiness_billing_rpc: make "persist + charge" one transaction.
--
-- Marker for scripts/apply-migrations.mjs = create function public.record_diagnosis_and_charge
--
-- The defect this closes: generateReadiness charged credits FIRST and inserted
-- the verdict SECOND — an insert failure took the money and lost the verdict.
-- The reverse order (insert, then charge, then delete on failure) does not work
-- under RLS either: diagnoses grants DELETE only to owner/admin (0012), so a
-- plain member's rollback delete silently affects zero rows. The only shape
-- that keeps the invariant "the user pays if and only if the verdict row
-- exists" under every failure mode is a single SECURITY DEFINER function doing
-- both inside one transaction.
--
-- Same defect, same fix for the concierge: requestAssist used to insert first
-- and charge second with a compensating delete — which was ALSO a no-op under
-- RLS (0032 defines no DELETE policy on readiness_assists). Instead of granting
-- users a delete right (dangerous: a buggy client could delete a PAID request
-- with no refund), record_assist_and_charge makes insert + charge atomic.
--
-- Security notes, uniform across both functions:
--  * SECURITY DEFINER bypasses RLS, so membership is re-checked explicitly and
--    authorization failures raise with errcode 42501 — deliberately distinct
--    from raise_exception (P0001), which the nested block catches as the
--    consume_credits "insufficient balance" signal.
--  * The PRICE is read inside the function (assistants.credits_per_message /
--    assist_offerings.credits by a fixed slug) — a caller can never state its
--    own cost.
--  * record_diagnosis_and_charge is scope-agnostic on purpose: the campaign
--    diagnosis and the creative plan carry the identical charge-before-persist
--    defect and adopt this same function in a follow-up.
-- ============================================================

create function public.record_diagnosis_and_charge(
  target_org uuid,
  target_product uuid,
  p_scope text,
  p_assistant_slug text,
  p_model text,
  p_output jsonb,
  p_confidence text,
  p_insufficient_data boolean,
  p_had_campaign_data boolean default false,
  p_knowledge_refs jsonb default '[]'::jsonb,
  p_reason text default null,
  p_next_review_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost integer;
  v_id uuid;
begin
  if not public.is_org_member(target_org) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;
  if not exists (select 1 from public.products p where p.id = target_product and p.org_id = target_org) then
    raise exception 'product does not belong to this organization' using errcode = '42501';
  end if;

  select coalesce(a.credits_per_message, 0) into v_cost
  from public.assistants a
  where a.slug = p_assistant_slug;
  v_cost := coalesce(v_cost, 0);

  -- Nested block = subtransaction: catching the charge failure rolls the
  -- insert back, so a failed debit can never leave a free verdict behind.
  begin
    insert into public.diagnoses (
      org_id, product_id, scope, assistant_slug, model, output, confidence,
      insufficient_data, had_campaign_data, knowledge_refs, next_review_at, created_by
    )
    values (
      target_org, target_product, p_scope, p_assistant_slug, p_model, p_output, p_confidence,
      p_insufficient_data, p_had_campaign_data, coalesce(p_knowledge_refs, '[]'::jsonb),
      p_next_review_at, auth.uid()
    )
    returning id into v_id;

    if v_cost > 0 then
      perform public.consume_credits(target_org, v_cost, p_reason);
    end if;

    return jsonb_build_object('ok', true, 'id', v_id, 'charged', v_cost);
  exception when raise_exception then
    return jsonb_build_object(
      'ok', false,
      'code', 'insufficient_credits',
      'balance', public.org_credit_balance(target_org),
      'cost', v_cost
    );
  end;
end;
$$;

revoke execute on function public.record_diagnosis_and_charge(uuid, uuid, text, text, text, jsonb, text, boolean, boolean, jsonb, text, timestamptz) from public, anon;
grant execute on function public.record_diagnosis_and_charge(uuid, uuid, text, text, text, jsonb, text, boolean, boolean, jsonb, text, timestamptz) to authenticated;

-- ------------------------------------------------------------
-- Concierge request + charge, atomic. The offering slug is fixed here (not a
-- parameter) for the same price-authority reason. The partial unique index
-- readiness_assists_open_unique (0032) makes the double-click race a
-- unique_violation, which resolves to the winner's row WITHOUT charging the
-- loser — idempotency is a billing guarantee.
-- ------------------------------------------------------------

create function public.record_assist_and_charge(
  target_product uuid,
  p_item_key text,
  p_request_reason text,
  p_credit_reason text,
  p_contact_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_offering_id uuid;
  v_cost integer;
  v_existing uuid;
  v_id uuid;
begin
  select p.org_id into v_org from public.products p where p.id = target_product;
  if v_org is null or not public.is_org_member(v_org) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;

  select o.id, coalesce(o.credits, 0) into v_offering_id, v_cost
  from public.assist_offerings o
  where o.slug = 'readiness-item-session' and o.is_active
  limit 1;
  if v_offering_id is null then
    return jsonb_build_object('ok', false, 'code', 'assist_unavailable');
  end if;

  -- Already asked and waiting: return the existing request instead of billing
  -- again.
  select ra.id into v_existing
  from public.readiness_assists ra
  where ra.product_id = target_product
    and ra.item_key = p_item_key
    and ra.status in ('requested', 'scheduled', 'in_progress')
  limit 1;
  if v_existing is not null then
    return jsonb_build_object('ok', true, 'id', v_existing, 'already_open', true, 'charged', 0);
  end if;

  begin
    insert into public.readiness_assists (
      org_id, product_id, offering_id, item_key, reason, contact_note, credits_charged, requested_by
    )
    values (
      v_org, target_product, v_offering_id, p_item_key, p_request_reason,
      nullif(left(coalesce(p_contact_note, ''), 2000), ''), v_cost, auth.uid()
    )
    returning id into v_id;

    if v_cost > 0 then
      perform public.consume_credits(v_org, v_cost, p_credit_reason);
    end if;

    return jsonb_build_object('ok', true, 'id', v_id, 'already_open', false, 'charged', v_cost);
  exception
    when unique_violation then
      -- The partial unique index fired: someone (or a double-click) got here
      -- first. Success from the user's point of view — and no second charge.
      select ra.id into v_existing
      from public.readiness_assists ra
      where ra.product_id = target_product
        and ra.item_key = p_item_key
        and ra.status in ('requested', 'scheduled', 'in_progress')
      limit 1;
      if v_existing is not null then
        return jsonb_build_object('ok', true, 'id', v_existing, 'already_open', true, 'charged', 0);
      end if;
      return jsonb_build_object('ok', false, 'code', 'save_failed');
    when raise_exception then
      return jsonb_build_object('ok', false, 'code', 'insufficient_credits');
  end;
end;
$$;

revoke execute on function public.record_assist_and_charge(uuid, text, text, text, text) from public, anon;
grant execute on function public.record_assist_and_charge(uuid, text, text, text, text) to authenticated;
