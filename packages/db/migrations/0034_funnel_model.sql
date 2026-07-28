-- ============================================================
-- 0034_funnel_model: the acquisition model the business actually runs.
--
-- Until now the readiness layer (0028) and the funnel layer (0015) both assumed
-- ONE shape: ad -> page -> checkout -> purchase. That is the direct-response
-- infoproduct funnel, and it silently mis-audits every business that does not
-- match it.
--
-- The failing case that motivated this: a SaaS where everyone signs up for a
-- free trial and only decides to pay AFTER logging in. Its checkout is behind
-- authentication, so:
--   * no page scan can ever see it (the scanner reads the public URL);
--   * `checkout_short` / `abandoned_recovery` were being audited against the
--     public page, which is not where that checkout lives;
--   * the conversion the ad optimizes for is the SIGNUP, not the purchase;
--   * the hinge metric — trial -> paid — had nowhere to be recorded, so
--     `funnel_snapshots` could not express the business's real funnel.
--
-- The fix is a DECLARED fact (zero-data-first, same as the rest of the intake),
-- never an inference: the user says which model they run, and the engine brief
-- reframes the checkout surface, the applicable items and the blockers around
-- it.
--
-- NOTE: no prompt change ships here on purpose. The behaviour lives in the
-- engine BRIEF (apps/web/src/lib/readiness/brief.ts), which is generated in
-- code on every run — so it cannot drift from this schema, and it never
-- overwrites a system prompt an operator may have tuned in /admin/ai.
-- ============================================================

-- ---------- Readiness intake: which funnel does this business run? ----------

alter table public.product_readiness
  -- direct      = ad -> page -> checkout -> purchase (the previous implicit assumption)
  -- trial_first = free trial/freemium signup; the paid decision happens AFTER login
  -- lead_first  = lead capture; a human closes the sale (no self-service checkout)
  -- null        = not declared yet; treated exactly like `direct` used to be,
  --               but the brief says "NÃO INFORMADO" instead of asserting it.
  add column if not exists funnel_model text
    check (funnel_model is null or funnel_model in ('direct', 'trial_first', 'lead_first'));

-- ---------- Activation: the structure that only exists in trial-first ----------
-- These are the trial-first equivalents of the checkout items. All of them sit
-- behind the login wall, so all of them are `declared` tier — no scan will ever
-- prove or disprove one, and the brief carries them as unverified on purpose.

alter table public.product_readiness
  -- The real pre-login "checkout" of a trial-first funnel is the signup form.
  add column if not exists signup_friction_low boolean not null default false,
  -- The "aha" moment is named AND measured — without it there is no way to tell
  -- a good trial cohort from a junk one before the paid decision.
  add column if not exists activation_defined boolean not null default false,
  -- The hinge: optimizing ads on signups while blind to trial -> paid scales
  -- whatever brings the cheapest junk trial.
  add column if not exists trial_to_paid_tracked boolean not null default false,
  -- Upgrading has to be reachable and obvious from inside the product.
  add column if not exists upgrade_path_clear boolean not null default false;

-- ---------- Funnel layer: the missing stage ----------
-- `visits -> checkout_initiated -> purchases` cannot express a trial funnel.
-- One nullable column makes visit -> signup -> paid computable, and stays
-- meaningless-but-harmless for direct-response products that leave it empty.

alter table public.funnel_snapshots
  add column if not exists signups bigint;

comment on column public.funnel_snapshots.signups is
  'Trial/free signups in the period. Trial-first funnels: visits -> signups -> purchases. Null for direct-response products.';
