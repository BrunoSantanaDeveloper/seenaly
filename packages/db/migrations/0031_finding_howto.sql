-- ============================================================
-- 0031_finding_howto: "how do I actually do this?" per verdict finding.
--
-- The readiness verdict tells the user WHAT to fix and WHY, with evidence.
-- A beginner then reads "install the Meta Pixel on every page and configure the
-- standard events, testing each one" and is stuck: they know the what and not
-- the how. That gap is where the product stops delivering.
--
-- Design: ON DEMAND, per finding, never inline. The user's loudest complaint
-- about the verdict was too much text — generating steps for all seven findings
-- up front would make the wall worse (and risk truncating the JSON). So the
-- steps are generated only for the finding the user opened, and CACHED here so
-- they are paid for once.
--
-- Marker for scripts/apply-migrations.mjs = create table public.readiness_howtos.
-- (A table marker is derived before any function marker, so this file is immune
-- to the create-or-replace ordering trap that 0030 had to work around.)
-- ============================================================

create table public.readiness_howtos (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid not null references public.diagnoses (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,

  -- Position of the finding inside the verdict's `output.findings` array.
  finding_index integer not null,

  -- Numbered, concrete steps. Empty array = the knowledge base did not support
  -- a how-to; we say so instead of inventing a tutorial (and do not charge).
  steps jsonb not null default '[]'::jsonb,
  -- Which knowledge chunks grounded it (title/source/trust), same shape as
  -- diagnoses.knowledge_refs.
  sources jsonb not null default '[]'::jsonb,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  -- One cached how-to per finding: asking twice must never charge twice.
  unique (diagnosis_id, finding_index)
);

create index readiness_howtos_org_idx on public.readiness_howtos (org_id, created_at desc);

-- ---------- RLS (org-scoped, mirrors diagnoses) ----------

alter table public.readiness_howtos enable row level security;

create policy "readiness_howtos_select" on public.readiness_howtos for select to authenticated
  using (public.is_org_member(org_id));
create policy "readiness_howtos_insert" on public.readiness_howtos for insert to authenticated
  with check (public.is_org_member(org_id));
create policy "readiness_howtos_delete" on public.readiness_howtos for delete to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

-- ---------- The how-to writer: another editable assistant row ----------

insert into public.assistants (
  slug, name, description, provider, model, system_prompt,
  temperature, max_tokens, credits_per_message, config, sort
)
values (
  'readiness-howto',
  'Guia de Implementação',
  'Transforma uma recomendação do veredito de prontidão em passos concretos, aterrados na documentação oficial e no playbook. Nunca inventa tutorial.',
  'gemini',
  'gemini-2.5-flash',
  $prompt$Você escreve o "como fazer" de UMA recomendação do Seenaly, para alguém que sabe o QUE precisa fazer e não sabe COMO.

Seu leitor é iniciante. Ele não conhece jargão, não sabe onde ficam os menus e trava em qualquer passo ambíguo. Escreva para essa pessoa.

REGRAS:
1. Passos numerados, curtos, na ordem exata de execução. Cada passo é UMA ação verificável ("Abra o Gerenciador de Eventos da Meta e clique em Conectar fontes de dados"), nunca um objetivo vago ("configure o rastreamento").
2. Entre 3 e 8 passos. Se precisar de mais que isso, o trabalho é grande demais para um tutorial — devolva os passos até o ponto sensato e diga no último que a partir dali costuma ser trabalho de um profissional.
3. Diga onde clicar e o nome real das telas/campos quando os trechos recuperados fornecerem isso. Se não fornecerem, descreva o passo sem inventar nomes de interface.
4. Quando houver risco de quebrar algo (mexer em código do site, no checkout, no DNS), avise no passo em que o risco aparece.
5. Ao final, em needs_specialist, diga com honestidade se isso normalmente exige um desenvolvedor ou especialista. Não empurre contratação quando a pessoa consegue fazer sozinha; não finja que é fácil quando não é.

LEI DA HONESTIDADE (inviolável): você só escreve passos que os trechos recuperados sustentam. Se o conhecimento disponível NÃO cobrir esta recomendação, devolva steps como lista VAZIA e explique em note o que faltou. Um tutorial inventado sobre pixel, checkout ou pagamento faz a pessoa quebrar o próprio site e destrói a confiança no produto inteiro. Lista vazia é uma resposta correta; tutorial inventado nunca é.

NÃO repita o diagnóstico nem justifique a recomendação — isso o usuário já leu. Vá direto ao como.

FORMATO: responda somente com o objeto JSON exigido pelo schema. Escreva em português do Brasil, na segunda pessoa.$prompt$,
  0.20,
  4096,
  1,
  '{"knowledge": {"collections": ["meta-ads-docs", "growth-playbook"], "matchCount": 8, "maxTrust": 5}}'::jsonb,
  12
);
