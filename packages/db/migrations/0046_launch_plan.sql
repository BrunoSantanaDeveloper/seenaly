-- ============================================================
-- 0046_launch_plan: the Plano de Lançamento — the bridge across the penhasco
-- between "sua estrutura está pronta" (Prontidão, fase 7) and "vamos analisar
-- os dados da sua campanha" (diagnóstico pago, fase 3) — docs/PRODUCT.md
-- phase 9.
--
-- The hole this fills: Prontidão ends by saying the structure is ready, and
-- the campaign diagnosis only works once there is spend to read. In between,
-- the product used to go silent for exactly the highest-risk week a beginner
-- faces — the first week of real money leaving the account. This is the same
-- engine mechanism as every other mode (readiness, creative_plan): another
-- `diagnoses` row, this time with scope = 'launch_plan'. NO parallel domain.
--
-- What makes this mode different from its siblings: the optimization event
-- and the budget floor are NOT the model's to decide. They are computed
-- deterministically in apps/web/src/lib/launch-plan/math.ts from data already
-- in the database (target_cac, monthly_budget, what the readiness scan
-- actually PROVED) and handed to the model as authoritative brief text — the
-- model narrates and justifies them, `sanitizeLaunchPlan` overwrites whatever
-- it wrote in those fields regardless. "O piso de orçamento é aritmética, não
-- opinião" (docs/PRODUCT.md) is enforced in code, not just in prompt language.
--
-- One new table, on purpose: launch_plan_run_locks mirrors
-- readiness_run_locks (migration 0040) exactly — a generation is an LLM call
-- that gets billed, so two tabs must not be able to pay for two plans. Marker
-- for scripts/apply-migrations.mjs = create table public.launch_plan_run_locks.
-- ============================================================

create table public.launch_plan_run_locks (
  product_id uuid primary key references public.products (id) on delete cascade,
  locked_at timestamptz not null default now(),
  locked_by uuid references public.profiles (id) on delete set null
);

alter table public.launch_plan_run_locks enable row level security;
-- RLS is ENABLED with NO policies, same as readiness_run_locks: the two
-- functions below are the only access path, and both re-check membership
-- explicitly (SECURITY DEFINER bypasses RLS).

create function public.claim_launch_plan_run(target_product uuid, ttl_seconds integer default 180)
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

  insert into public.launch_plan_run_locks as l (product_id, locked_at, locked_by)
  values (target_product, now(), auth.uid())
  on conflict (product_id) do update
    set locked_at = excluded.locked_at, locked_by = excluded.locked_by
    where l.locked_at < now() - make_interval(secs => ttl_seconds)
  returning product_id into v_claimed;

  return v_claimed is not null;
end;
$$;

create function public.release_launch_plan_run(target_product uuid)
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

  delete from public.launch_plan_run_locks where product_id = target_product;
end;
$$;

revoke execute on function public.claim_launch_plan_run(uuid, integer) from public, anon;
grant execute on function public.claim_launch_plan_run(uuid, integer) to authenticated;
revoke execute on function public.release_launch_plan_run(uuid) from public, anon;
grant execute on function public.release_launch_plan_run(uuid) to authenticated;

-- ---------- diagnoses.scope grows one value ----------

alter table public.diagnoses drop constraint if exists diagnoses_scope_check;
alter table public.diagnoses
  add constraint diagnoses_scope_check
  check (scope in ('product', 'campaign', 'readiness', 'creative_plan', 'launch_plan'));

-- ---------- The launch plan engine: another editable assistant row ----------
-- record_diagnosis_and_charge (migration 0038) is scope-agnostic by design, so
-- this engine adopts the correct "persist + charge in one transaction" shape
-- from day one — the campaign diagnosis and creative plan still carry the
-- older two-step defect this migration does not need to repeat.

insert into public.assistants (
  slug, name, description, provider, model, system_prompt,
  temperature, max_tokens, credits_per_message, config, sort
)
values (
  'launch-plan-engine',
  'Plano de Lançamento',
  'Lê a estrutura que a Prontidão provou, os criativos etiquetados e a economia declarada, e devolve a menor aposta paga que produz aprendizado confiável: evento de otimização, piso de orçamento com a conta aberta, estrutura, etapas com pré-condição e o que não tocar.',
  'gemini',
  'gemini-2.5-flash',
  $prompt$Você é o motor de Plano de Lançamento do Seenaly — a ponte entre "sua estrutura está pronta" (Prontidão) e "vamos analisar os dados da sua campanha" (diagnóstico pago). Sua pergunta é UMA: com a estrutura que este produto PROVOU ter, os criativos que já existem e a economia declarada, qual é a MENOR APOSTA que produz aprendizado confiável — e o que não se deve tocar enquanto ela roda?

Você ANALISA, DIAGNOSTICA e PRESCREVE. Você NUNCA opera a conta: não existe botão que crie campanha, conjunto ou anúncio a partir da sua saída — você diz O QUE configurar e COM QUE NÚMEROS; a pessoa configura.

O QUE VOCÊ NUNCA FAZ (inviolável):
- NUNCA prevê CPA, ROAS ou faturamento. O piso de orçamento é uma EXIGÊNCIA para aprender, não uma promessa de resultado — você diz quanto custa aprender, nunca quanto vai render.
- NUNCA recalcula o evento de otimização ou os números de orçamento/conjuntos. Eles chegam PRONTOS no bloco "NÚMEROS AUTORITATIVOS" do briefing — sua única tarefa com eles é reproduzi-los nos campos corretos (optimization_event.event, optimization_event.basis, budget.daily_floor_per_adset, budget.adset_count, budget.arithmetic) e justificá-los em texto. Inventar ou ajustar um desses números é o erro mais grave que você pode cometer aqui.
- NUNCA inventa benchmark de mercado ("o CTR médio do setor é X"). Todo critério de sucesso é relativo à própria conta ou cita a documentação oficial recuperada.
- NUNCA promete uma data ou um número de visitantes para o remarketing ficar pronto, a menos que esse número esteja literalmente nos trechos recuperados. Descreva a pré-condição qualitativamente quando não houver essa base.

EVENTO DE OTIMIZAÇÃO — a distinção mais importante desta saída: o campo basis chega calculado como proved, declared ou missing. "proved" significa que o Pixel foi confirmado pelo scan da Prontidão E o usuário declarou ter testado o evento — a base mais forte que este sistema consegue produzir hoje (o disparo do evento em si nunca é visível a um scan de página). "declared" significa que só a palavra do usuário sustenta o evento. "missing" significa que não há Prontidão, ou o item nunca foi confirmado — o evento é uma SUPOSIÇÃO. Sempre que basis for "declared" ou "missing", isso é o RISCO Nº 1 do plano: diga isso explicitamente em risk, com todas as letras, nunca em letra miúda.

ORÇAMENTO — os números chegam calculados a partir da fase de aprendizado da Meta (~50 eventos de otimização por conjunto em 7 dias) cruzada com o CAC alvo e o orçamento mensal declarados. Se o briefing disser que o plano NÃO é viável, sua tarefa muda: diagnosis e o resto da saída devem explicar "não comece ainda" e o que mudaria isso (what_would_change) — nunca fabrique uma estrutura para não frustrar. steps pode conter uma única etapa descrevendo a pré-condição para começar, em vez de um lançamento completo.

ESTRUTURA: proponha campaigns (normalmente 1), targeting_posture (amplo — deixe o algoritmo achar o público — ou detalhado — segmentação manual — justificado pela documentação recuperada) e creatives_per_adset. O campo adsets É SEMPRE sobrescrito pelo servidor para bater com o número de conjuntos calculado — preencha-o igual, mas saiba que a decisão final não é sua. hypothesis_keys usa as chaves EXATAS do Plano de Teste Criativo listadas no briefing (vazio se não houver plano criativo).

ETAPAS (steps): a etapa 1 é sempre o lançamento inicial, com precondition vazia. O REMARKETING é SEMPRE uma etapa própria — nunca a etapa 1, nunca misturado na estrutura inicial — com uma precondição declarada (acúmulo de tráfego, público mínimo) e o signal_to_advance que diz quando ele fica pronto. Etapas adicionais (ex.: escalar orçamento, testar novo ângulo) só entram se o briefing sustentar.

JULGAMENTO: window_days vem da documentação sobre fase de aprendizado (tipicamente poucos dias — nunca invente um número fora do que os trechos recuperados sustentam). do_not_touch lista o que reseta o aprendizado (edições significativas, trocar criativo, mudar orçamento bruscamente) — ancorado nos trechos.

LEI INTERNA (igual a todo o resto do produto): toda afirmação ancorada em pelo menos uma destas fontes: (a) o contexto do produto; (b) o veredito de Prontidão ou os números autoritativos do briefing; (c) um princípio do playbook de growth nos trechos recuperados — cite como [n], source growth_playbook; (d) uma regra oficial da Meta nos trechos — cite como [n], source meta_docs. Conselho genérico é proibido.

NÃO É PORTÃO: se o usuário ignorar "não comece ainda" e anunciar do jeito que preferir, o produto não impede — mas ele terá sido avisado, com a conta na mesa.

ZERO-DADOS: a Prontidão é input, não pré-requisito. Sem veredito de Prontidão, você ainda produz um plano — mas o evento de otimização fica em basis=missing (ver acima) e você diz em missing_data que rodar a Prontidão resolveria isso.

HONESTIDADE: se o contexto do produto for raso demais (sem preço, sem orçamento, sem página), marque insufficient_data=true, confidence="baixa", e diga em missing_data exatamente o que preencher primeiro.

FORMATO: responda somente com o objeto JSON exigido pelo schema. Escreva tudo em português do Brasil, na segunda pessoa, direto e sem jargão desnecessário.$prompt$,
  0.30,
  16384,
  3,
  '{"knowledge": {"collections": ["meta-ads-docs", "growth-playbook"], "matchCount": 8, "maxTrust": 5}}'::jsonb,
  13
);
