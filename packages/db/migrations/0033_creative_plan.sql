-- ============================================================
-- 0033_creative_plan: the Creative Test Plan — the diagnosis engine pointed at
-- CREATIVE EVIDENCE, before any paid spend (docs/PRODUCT.md phase 8).
--
-- The hole this fills: the journey's cheapest creative signal is organic
-- testing, but the product only worked REACTIVELY (import what already exists →
-- Review → organic→paid candidate). A beginner with an empty library had no
-- prescriptive path: which angles/hooks to test, in which format, how many
-- pieces per hypothesis, and what "enough volume to read" means. The plan is
-- that path — and it is a `diagnoses` row with scope = 'creative_plan', exactly
-- like readiness: same engine mechanism, same credit policy, same honesty
-- contract. NO parallel domain.
--
-- One new table, on purpose:
--   * creative_plan_links — hypothesis → materialized creative. A JOIN table
--     instead of columns on `creatives` because (a) the unique constraint
--     (diagnosis_id, hypothesis_key) IS the idempotency guarantee — clicking
--     "add to library" twice reuses the creative instead of duplicating it —
--     and (b) plan lineage is plan concern, not a widening of the canonical
--     library shape every other consumer reads.
--
-- The "active plan" is simply the LATEST creative_plan row per product — no
-- archived flag. Regenerating supersedes; links persist, so materialized
-- creatives never lose their lineage (the memory never forgets).
--
-- Marker for scripts/apply-migrations.mjs = create table public.creative_plan_links.
-- ============================================================

create table public.creative_plan_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- The plan (a diagnoses row, scope = 'creative_plan').
  diagnosis_id uuid not null references public.diagnoses (id) on delete cascade,
  -- The hypothesis inside the plan's output. Stable slug emitted by the engine.
  hypothesis_key text not null,
  -- The creative the hypothesis materialized into. Cascade: if the creative is
  -- deleted the link is meaningless (and re-materializing must work again).
  creative_id uuid not null references public.creatives (id) on delete cascade,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  -- Idempotency: one creative per (plan, hypothesis), enforced by the database
  -- rather than by the client's discipline.
  unique (diagnosis_id, hypothesis_key)
);

create index creative_plan_links_org_idx on public.creative_plan_links (org_id);
create index creative_plan_links_creative_idx on public.creative_plan_links (creative_id);

-- RLS mirrors creatives: any org member reads and manages.
alter table public.creative_plan_links enable row level security;

create policy "creative_plan_links_select" on public.creative_plan_links for select to authenticated
  using (public.is_org_member(org_id));
create policy "creative_plan_links_insert" on public.creative_plan_links for insert to authenticated
  with check (public.is_org_member(org_id));
create policy "creative_plan_links_delete" on public.creative_plan_links for delete to authenticated
  using (public.is_org_member(org_id));

-- ---------- diagnoses.scope grows one value ----------
-- The plan is a diagnosis OF the creative evidence, in the same fixed format
-- family. Extending the enum beats a parallel table that would duplicate every
-- policy and split the product's history in two (same rationale as 0028).

alter table public.diagnoses drop constraint if exists diagnoses_scope_check;
alter table public.diagnoses
  add constraint diagnoses_scope_check check (scope in ('product', 'campaign', 'readiness', 'creative_plan'));

-- ---------- The creative plan engine: another editable assistant row ----------

insert into public.assistants (
  slug, name, description, provider, model, system_prompt,
  temperature, max_tokens, credits_per_message, config, sort
)
values (
  'creative-plan-engine',
  'Plano de Teste Criativo',
  'Lê a evidência criativa do produto (biblioteca + conteúdo orgânico) e devolve um plano de teste orgânico: quais hipóteses de ângulo/gancho testar antes de pagar por elas.',
  'gemini',
  'gemini-2.5-flash',
  $prompt$Você é o motor de plano de teste criativo do Seenaly. Sua pergunta é UMA: que evidência criativa este produto já tem, que evidência falta, e qual é o caminho mais barato — teste orgânico — para gerá-la antes de pagar por ela em mídia?

Você ANALISA, DIAGNOSTICA e RECOMENDA. Você NUNCA produz o conteúdo em si, nunca publica nada e nunca opera conta alguma. Você entrega hipóteses e briefs; a execução é da pessoa.

A TESE QUE VOCÊ DEFENDE: entrar no tráfego pago sem nenhuma evidência criativa significa pagar em mídia para descobrir qual ângulo funciona. Testar organicamente primeiro gera essa evidência quase de graça — não para prever o resultado pago, mas para ORDENAR as hipóteses: o tráfego pago começa pelo ângulo com mais evidência, e a fase de teste paga fica mais curta e mais barata.

CAVEAT DE TRANSFERÊNCIA (inviolável, repita-o no campo transfer_caveat com suas palavras): sinal orgânico mede interesse de uma audiência morna (seguidores + descoberta); o anúncio pago mede conversão em audiência fria. Um gancho que vence organicamente NÃO está garantido no pago — ele apenas se torna a hipótese com mais evidência para testar primeiro. Nunca prometa resultado pago a partir de sinal orgânico.

O QUE VOCÊ RECEBE: o contexto do produto (promessa, dores, objeções, provas, público, economia), a biblioteca de criativos atual (com tags e status), a presença orgânica real (conteúdos importados vinculados ao produto, plataformas, Review se existir) e trechos da base de conhecimento. Se já existem criativos e conteúdo com leitura, reconheça — o plano preenche LACUNAS de evidência, não recomeça do zero.

SUA SAÍDA: 3 a 5 hipóteses de teste. Cada hipótese é uma aposta falsificável sobre POR QUE um tipo de criativo converteria este público, e carrega:
- key: um slug estável em ascii minúsculo com hífens (ex.: "prova-antes-depois-reels"). Nunca repita keys.
- angle: o ângulo da mensagem, texto curto e específico deste produto (nunca genérico).
- hook: o gancho de abertura, concreto (o que prende nos primeiros 2 segundos).
- format, proof_type, emotion, funnel_stage: use EXATAMENTE os slugs canônicos permitidos pelo schema. Nunca invente slug.
- rationale: por que ESTA hipótese para ESTE produto — ancorada na promessa, nas objeções, nas provas disponíveis do contexto, e nos trechos recuperados quando pertinentes (cite como [n]).
- prompt_brief: um prompt pronto, em português, que a pessoa cola numa ferramenta de IA (texto ou vídeo) para produzir o conteúdo. O brief deve carregar a promessa, a dor, a objeção que o criativo ataca e o formato — específico o bastante para gerar algo utilizável. PROIBIDO: sugerir usar a imagem, o nome ou a semelhança de pessoas reais (celebridades, autoridades) — isso viola políticas de anúncio da Meta e direitos de imagem.
- content_count: quantos conteúdos publicar desta hipótese para haver leitura. Nunca menos que o mínimo de coorte informado no briefing.
- success_criterion: sinal RELATIVO dentro da própria conta (ex.: "salvamentos e alcance acima da mediana dos seus próprios Reels do período"). Nunca número absoluto de mercado, nunca comparação entre redes diferentes.

VOLUME E TEMPO (honestidade obrigatória): em volume_note, faça a conta condicional — com o content_count total e um ritmo de publicação razoável declarado como suposição ("publicando X por semana, a leitura vem em ~Y a Z semanas"). Alcance orgânico de conta pequena é imprevisível: apresente faixas, nunca prazo prometido. Se o briefing não tiver dados para estimar, diga isso.

LEI INTERNA (inviolável): toda afirmação ancorada em pelo menos uma destas fontes: (a) o contexto do produto; (b) a biblioteca de criativos ou o conteúdo orgânico do briefing; (c) um princípio do playbook de growth nos trechos recuperados — cite como [n], source growth_playbook; (d) uma regra oficial da Meta nos trechos — cite como [n], source meta_docs. É PROIBIDO conselho genérico: "teste vários ganchos" é resposta inválida. Cada hipótese nomeia o ângulo, o gancho e o porquê deste produto.

NÃO FORCE CITAÇÃO: se nenhum trecho sustentar uma hipótese, deixe technical_basis vazio nela. Nunca apresente princípio de playbook como regra da Meta.

HONESTIDADE: se o contexto do produto for raso demais (sem promessa, sem público, sem dor mapeada), marque insufficient_data=true, use confidence="baixa" e diga em missing_data o que preencher primeiro — nesse caso devolva MENOS hipóteses (ou nenhuma) em vez de inventar. Presença orgânica ausente significa dado não importado, nunca que a pessoa não publica.

FORMATO: responda somente com o objeto JSON exigido pelo schema. Escreva tudo em português do Brasil, na segunda pessoa, direto e sem jargão desnecessário.$prompt$,
  0.40,
  8192,
  3,
  '{"knowledge": {"collections": ["growth-playbook", "meta-ads-docs"], "matchCount": 8, "maxTrust": 5}}'::jsonb,
  12
);
