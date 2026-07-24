-- ============================================================
-- 0032_readiness_assist: the concierge exit — "nosso time faz junto com você".
--
-- The hole this fills: a beginner (the framed-art merchant, burned by agencies)
-- reaches an item he cannot execute even WITH the step-by-step. His only
-- "someone does it for me" exit today is "Delegar em 1 minuto", which hands the
-- job — and the money — to an outside professional, i.e. back to the exact
-- relationship that burned him. This keeps both inside the product.
--
-- Two tables, on purpose:
--   * assist_offerings — the price CATALOG. The price of a human service must be
--     tunable without a deploy (and will change as the team learns what each
--     service really costs), so it is data, not a constant in the code. It is
--     also not an `assistants` row: this is human work, not an AI assistant, and
--     overloading that table would corrupt its meaning and its /admin/ai console.
--   * readiness_assists — the request QUEUE. Every request is a durable row with
--     its context, so nothing lives only inside a WhatsApp thread.
--
-- Scope decision recorded here because it is a security boundary, not a UX
-- choice: the service is "we do it TOGETHER, on a call". Seenaly never asks for
-- or stores the customer's site/Meta credentials — no third-party secret custody,
-- no liability for breaking their store. `contact_note` is free text the user
-- writes; it must never be used to collect passwords, and the UI says so.
--
-- Marker for scripts/apply-migrations.mjs = create table public.assist_offerings.
-- ============================================================

create table public.assist_offerings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',

  -- What the org pays, in the SAME credits used everywhere else. Kept here so
  -- pricing is tuned as a data edit, never a code change.
  credits integer not null default 0,
  -- Roughly how long the session takes, shown to set expectations honestly.
  estimated_minutes integer not null default 30,

  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Everyone signed in may READ the catalog (the price has to be visible before
-- committing). Only the platform (service role / superadmin) writes it.
alter table public.assist_offerings enable row level security;

create policy "assist_offerings_select" on public.assist_offerings for select to authenticated
  using (is_active);

create table public.readiness_assists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  offering_id uuid references public.assist_offerings (id) on delete set null,

  -- The checklist item they got stuck on (a ReadinessItemKey), plus WHY the
  -- product decided to offer help. Both are what the operator needs to arrive
  -- at the call already knowing the case.
  item_key text not null,
  reason text not null,

  -- requested → scheduled → in_progress → done | cancelled
  status text not null default 'requested',

  -- What was actually charged, frozen at request time: the catalog price may
  -- change later, and the receipt must not silently change with it.
  credits_charged integer not null default 0,

  -- Free text from the user ("meu site é Wix, só consigo de manhã"). NEVER
  -- credentials — the product tells them not to, and the team must not ask.
  contact_note text,
  -- Filled by the team as they work the queue.
  operator_note text,

  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One OPEN request per item per product: a double-click, or an impatient user
  -- asking again, must never bill twice or create a duplicate in the queue.
  -- Closed requests (done/cancelled) are excluded so a later relapse can be
  -- requested again.
  constraint readiness_assists_status_check
    check (status in ('requested', 'scheduled', 'in_progress', 'done', 'cancelled'))
);

create unique index readiness_assists_open_unique
  on public.readiness_assists (product_id, item_key)
  where status in ('requested', 'scheduled', 'in_progress');

create index readiness_assists_queue_idx on public.readiness_assists (status, created_at desc);
create index readiness_assists_org_idx on public.readiness_assists (org_id, created_at desc);

alter table public.readiness_assists enable row level security;

-- Org-scoped, mirroring diagnoses/readiness_howtos. The team reads the whole
-- queue through the service role in the admin console, not through these.
create policy "readiness_assists_select" on public.readiness_assists for select to authenticated
  using (public.is_org_member(org_id));
create policy "readiness_assists_insert" on public.readiness_assists for insert to authenticated
  with check (public.is_org_member(org_id));
-- Cancelling is the user's own call; only owners/admins of the org may do it.
create policy "readiness_assists_update" on public.readiness_assists for update to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

-- ---------- The first offering ----------
-- Priced deliberately close to what the same job costs on the open market, so
-- keeping it in-house is a real choice rather than a discount trap. Tune freely.
insert into public.assist_offerings (slug, name, description, credits, estimated_minutes, sort)
values (
  'readiness-item-session',
  'Sessão guiada com o time Seenaly',
  'Uma chamada em que o time faz o item junto com você, na sua tela. Não pedimos sua senha nem acesso ao seu site: quem executa é você, com a gente conduzindo — e ao final a verificação confirma na página.',
  25,
  40,
  1
);
