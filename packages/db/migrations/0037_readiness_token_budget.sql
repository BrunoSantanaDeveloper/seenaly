-- ============================================================
-- 0037_readiness_token_budget: give the readiness verdict room to finish.
--
-- Marker for scripts/apply-migrations.mjs = create function public.apply_readiness_token_budget
--
-- Replaces 0035_readiness_token_budget.sql, which was a pure UPDATE: the
-- migration runner derives markers only from catalog-observable objects
-- (tables/functions/buckets/columns), so that file derived NO marker and was
-- silently skipped on every run — and it also duplicated the 0035 prefix with
-- 0035_admin_controls.sql. The data change is now wrapped in a one-shot
-- function (the 0030_welcome_credits_backfill pattern): the function persists
-- in pg_proc and IS the marker.
--
-- Symptom: "O motor falhou ao verificar a prontidão: Gemini returned invalid
-- JSON: { "verdict": "nao_pronto", "summary": "..." — the answer stopped
-- mid-string.
--
-- Cause (measured, not guessed): on gemini-2.5-flash the REASONING tokens are
-- billed against the same `max_tokens` budget as the answer, and they are not
-- deterministic. Running one identical readiness prompt repeatedly:
--
--   prompt 5.575 | reasoning 4.945 | answer 1.776   -> 82% of an 8.192 budget
--   prompt 5.575 | reasoning 3.825 | answer 1.990
--   (capped run) reasoning 5.401 | answer 2.638     -> 8.039, would NOT have fit
--
-- So an 8.192 budget was a coin flip: whenever reasoning spiked, the JSON was
-- truncated and the user got a parse error instead of a verdict. The readiness
-- verdict is the largest output in the product (up to 7 findings, each with
-- evidence, technical basis, action and success criterion), so it is the first
-- one to fall over.
--
-- Two fixes ship together:
--  1. the Gemini provider now caps reasoning at a third of the budget, so the
--     answer always has two thirds reserved (packages/ai/src/providers/gemini.ts)
--     — that alone makes the failure structural rather than random;
--  2. this migration doubles the budget, so even a long audit has headroom.
--
-- Only rows still on the seeded 8192 are touched: an operator who tuned this in
-- /admin/ai keeps their value — which also makes a re-run (or a manual earlier
-- application of the old 0035 file) a harmless no-op.
-- ============================================================

-- SECURITY INVOKER on purpose: the migration runner executes as postgres; an
-- authenticated session that somehow reached this via RPC lacks UPDATE on
-- assistants, so the call would fail instead of granting a privilege path.
create function public.apply_readiness_token_budget()
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  update public.assistants
  set max_tokens = 16384
  where slug = 'readiness-engine'
    and max_tokens = 8192;
  get diagnostics n = row_count;

  -- Same latent risk, same shape of output (the 9-field structured diagnosis).
  update public.assistants
  set max_tokens = 16384
  where slug = 'diagnosis-engine'
    and max_tokens = 8192;

  return n;
end;
$$;

revoke execute on function public.apply_readiness_token_budget() from public, anon, authenticated;

select public.apply_readiness_token_budget();
