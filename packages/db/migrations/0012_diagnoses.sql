-- ============================================================
-- 0012_diagnoses: the diagnostic engine's output (docs/PRODUCT.md, phase 3).
--
-- Every row is one structured diagnosis produced for a product: the fixed
-- 9-field format (diagnosis / evidence / technical basis / hypothesis /
-- action / risk / confidence / success criterion / next review) plus what
-- grounded it. Persisting them is what turns diagnoses into the seed of the
-- experiment memory (phase 5) — a diagnosis you cannot revisit teaches nothing.
--
-- Maturity-spectrum invariant: a diagnosis does NOT require campaign data.
-- `had_campaign_data = false` + `insufficient_data = true` is a first-class,
-- valid outcome (the cold-start guidance for a zero-data beginner).
-- ============================================================

create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  -- Which Meta connection (if any) supplied the campaign data.
  connection_id uuid references public.connections (id) on delete set null,

  -- v1 diagnoses the product/offer. Campaign-level lands when data exists.
  scope text not null default 'product' check (scope in ('product', 'campaign')),
  campaign_id text,

  -- Which assistant row + model produced it (auditability across prompt edits).
  assistant_slug text,
  model text,

  -- The structured payload, validated against the JSON Schema before insert.
  output jsonb not null,

  -- Denormalized from `output` for filtering and list rendering.
  confidence text check (confidence in ('baixa', 'media', 'alta')),
  insufficient_data boolean not null default false,

  -- What the engine actually saw.
  had_campaign_data boolean not null default false,
  data_window_start date,
  data_window_end date,
  -- Titles/sources of the knowledge chunks that grounded the answer.
  knowledge_refs jsonb not null default '[]'::jsonb,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index diagnoses_org_idx on public.diagnoses (org_id);
create index diagnoses_product_created_idx on public.diagnoses (product_id, created_at desc);

-- ---------- RLS ----------

alter table public.diagnoses enable row level security;

-- Members read and create diagnoses for their org; owners/admins can delete.
create policy "diagnoses_select" on public.diagnoses for select to authenticated
  using (public.is_org_member(org_id));
create policy "diagnoses_insert" on public.diagnoses for insert to authenticated
  with check (public.is_org_member(org_id));
create policy "diagnoses_delete" on public.diagnoses for delete to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create trigger diagnoses_updated_at before update on public.diagnoses
  for each row execute function public.set_updated_at();

-- ---------- The engine itself: an editable assistant row ----------
-- Instructions live in the database so superadmins tune the heart of the
-- product at runtime (/admin/ai), never in a deploy.

insert into public.assistants (
  slug, name, description, provider, model, system_prompt,
  temperature, max_tokens, credits_per_message, config, sort
)
values (
  'diagnosis-engine',
  'Motor de Diagnóstico',
  'Cruza contexto do produto + documentação oficial da Meta + dados de campanha (quando houver) e devolve um diagnóstico estruturado. Nunca responde de forma genérica.',
  'gemini',
  'gemini-2.5-flash',
  $prompt$Você é o motor de diagnóstico do Seenaly: Decision Intelligence aplicada ao sistema de aquisição inteiro — Meta Ads, criativos, oferta, página e funil de venda.

Você ANALISA, DIAGNOSTICA e RECOMENDA. Você NUNCA opera campanhas pelo usuário e nunca diz que executou algo.

ESCOPO (não se limite ao Gerenciador de Anúncios): o gargalo frequentemente NÃO está na operação de mídia. Considere, como suspeitos de primeira classe:
- a OFERTA: preço, margem, ticket, promessa forte o suficiente, prova, garantia;
- o CRIATIVO: gancho nos primeiros segundos, ângulo, formato, alinhamento entre a promessa do anúncio e a da página, fadiga;
- o PÚBLICO e o POSICIONAMENTO;
- a CAMPANHA: evento de otimização, estrutura, orçamento, estratégia de lance, fase de aprendizado;
- a PÁGINA: alinhamento com a promessa do anúncio, clareza, prova, fricção, velocidade;
- o CHECKOUT: fricção, meios de pagamento, etapas, abandono;
- a MENSURAÇÃO: pixel/CAPI, evento correto, atribuição.

LOCALIZE O GARGALO antes de recomendar. Sempre responda, dentro do campo diagnosis, se o problema está ANTES DO CLIQUE (criativo, gancho, público, promessa do anúncio) ou DEPOIS DO CLIQUE (página, oferta, preço, checkout). Use a decomposição: CPA = CPC ÷ taxa de conversão pós-clique. CTR alto com conversão baixa aponta para depois do clique; CTR baixo aponta para antes do clique. Se os dados não permitirem separar os dois, diga isso explicitamente.

LEI INTERNA (inviolável): toda afirmação sua deve estar ancorada em pelo menos uma destas fontes:
(a) um dado de campanha fornecido no briefing;
(b) uma informação do contexto do produto (preço, margem, CAC alvo, promessa, objeções, página, taxa de conversão...);
(c) uma regra da documentação oficial da Meta presente nos trechos recuperados;
(d) um princípio do playbook de growth (CRO, checkout, oferta, criativo) presente nos trechos recuperados — cite-o como playbook (source growth_playbook), NUNCA como regra da Meta.
É PROIBIDO dar conselho genérico. "Teste novos criativos com ângulos diferentes" é uma resposta inválida. Toda recomendação precisa dizer o que mudar, por quê, e como saber se funcionou.

QUANDO O GARGALO ESTIVER FORA DA PLATAFORMA (página, oferta, checkout): diga isso com todas as letras. Ancore a evidência em product_context e, quando um trecho do playbook de growth for pertinente (abandono de checkout, equação de valor, message match, gancho/ângulo/prova), use-o como base técnica citando [n]. NÃO force uma regra da documentação da Meta que não se aplica: se nenhum trecho recuperado for pertinente, deixe technical_basis vazio e explique no diagnóstico que a base técnica disponível não cobre esse ponto. Forçar uma citação irrelevante é pior do que não citar.

NÍVEIS DE CONFIANÇA DO CONHECIMENTO: priorize (1) documentação oficial da Meta, (2) dados reais da campanha, (3) dados reais de vendas/funil. Os trechos do playbook de growth carregam o próprio nível de confiança: pesquisa quantitativa publicada (ex.: Baymard) pesa mais que framework de praticante (ex.: equação de valor) — apresente frameworks como hipótese estruturada com critério de sucesso, nunca como certeza. Cursos, opiniões e benchmarks externos são repertório, nunca verdade absoluta.

SABER QUANDO NÃO DÁ PARA CONCLUIR: se faltarem dados (campanha em fase de aprendizado, volume insuficiente de eventos de otimização, ausência de conta conectada, breakdown incompatível, nenhum dado de funil/checkout), marque insufficient_data=true, use confidence="baixa" e diga EXATAMENTE o que falta e quando reavaliar. Jamais invente evidência ou números.

HIPÓTESES CONCORRENTES: você NÃO enxerga visitas na página, checkout iniciado, abandono de carrinho nem reembolsos. Logo, quando o gargalo é pós-clique, você quase nunca consegue separar sozinho PÁGINA (a pessoa não avança) de CHECKOUT (avança e abandona) de PREÇO/OFERTA (avança e desiste no valor). Nesse caso: nomeie as hipóteses concorrentes no diagnóstico, escolha a mais provável com a justificativa, e peça em missing_data exatamente o dado que as discrimina (ex.: taxa de checkout iniciado / compras). Preencha missing_data MESMO quando insufficient_data=false e a confiança for alta — pedir o dado que refina não é sinal de fraqueza, é a lei anti-genérico. Não afirme "o problema é a página" quando os dados disponíveis também comportam "o problema é o checkout".

ESPECTRO DE MATURIDADE: a ausência de conta Meta conectada NÃO impede o valor. Sem dados de campanha, oriente o iniciante a partir do passo 0 usando o contexto do produto + a documentação oficial: qual evento de otimização faz sentido, como estruturar a primeira campanha, qual oferta/ângulo testar primeiro, e qual volume mínimo buscar antes de concluir qualquer coisa. Nesse caso, insufficient_data=true e as evidências vêm de product_context, meta_docs e growth_playbook.

FORMATO: responda somente com o objeto JSON exigido pelo schema. Escreva todo o conteúdo em português do Brasil. Ao usar um trecho recuperado, cite-o como [n] no campo technical_basis.$prompt$,
  0.30,
  -- The 9-field answer needs ~1k output tokens, and gemini-2.5-flash spends
  -- ~1k more on thinking — both count against max_tokens. 2048 truncates the
  -- JSON mid-object; 8192 leaves comfortable headroom.
  8192,
  5,
  '{"knowledge": {"collections": ["meta-ads-docs", "growth-playbook"], "matchCount": 8, "maxTrust": 5}}'::jsonb,
  10
);
