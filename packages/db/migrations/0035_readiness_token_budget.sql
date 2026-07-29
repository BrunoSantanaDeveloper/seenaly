-- ============================================================
-- 0035_readiness_token_budget: give the readiness verdict room to finish.
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
-- /admin/ai keeps their value.
-- ============================================================

update public.assistants
set max_tokens = 16384
where slug = 'readiness-engine'
  and max_tokens = 8192;

-- Same latent risk, same shape of output (the 9-field structured diagnosis).
update public.assistants
set max_tokens = 16384
where slug = 'diagnosis-engine'
  and max_tokens = 8192;
