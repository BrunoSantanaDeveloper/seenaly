-- ============================================================
-- 0028_readiness: the readiness layer (docs/PRODUCT.md, phase 7).
--
-- "Prontidão antes do tráfego pago — a estrutura é o CAC mais barato."
-- Cheap paid traffic does not come from cheap clicks; it comes from a structure
-- that converts (CPA = CPC ÷ post-click conversion). The worst outcome this
-- product exists to prevent is burning media budget to DISCOVER a structural
-- flaw the system could have flagged for free, before the first real spent.
--
-- Design: this is NOT a second engine. The same diagnoses table stores the
-- verdict (scope = 'readiness') and the same assistant mechanism drives it —
-- only the input (declared structure instead of media data), the prompt and the
-- output schema differ. Zero-data by construction: it needs a product, nothing
-- else. The optional URL/tech scanner (phase B) enriches this later; it is not
-- a prerequisite and no column here assumes it.
--
-- Marker for scripts/apply-migrations.mjs = create table public.product_readiness.
-- ============================================================

-- One declared structural profile per product. Every boolean means "the user
-- CONFIRMED this is done" — unchecked is deliberately ambiguous (not done OR
-- not known) and the engine must treat it as unconfirmed, never as absent.
-- That ambiguity is honest and itself diagnostic: not knowing whether the pixel
-- fires IS the finding.
create table public.product_readiness (
  product_id uuid primary key references public.products (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,

  -- ---- Mensuração: the highest-leverage, zero-cost lever. Without signal the
  -- algorithm cannot learn and every click is priced as if it were the first.
  pixel_installed boolean not null default false,
  capi_installed boolean not null default false,
  conversion_event_tested boolean not null default false,
  analytics_installed boolean not null default false,

  -- ---- Página e oferta
  page_has_proof boolean not null default false,
  page_mobile_tested boolean not null default false,
  page_fast boolean not null default false,
  has_guarantee boolean not null default false,
  guarantee_days integer,

  -- ---- Checkout
  -- own | platform | link | none  (null = not declared)
  checkout_type text check (checkout_type is null or checkout_type in ('own', 'platform', 'link', 'none')),
  payment_pix boolean not null default false,
  payment_card boolean not null default false,
  checkout_short boolean not null default false,
  abandoned_recovery boolean not null default false,

  -- ---- Descoberta (SEO + orgânico). Where the Organic Growth module enters as
  -- a PRE-CONDITION of paid acquisition, not as a separate application.
  seo_basics boolean not null default false,
  indexable boolean not null default false,
  sitemap_robots boolean not null default false,
  structured_data boolean not null default false,
  social_profiles boolean not null default false,
  organic_content boolean not null default false,

  -- ---- Retenção e funil
  email_capture boolean not null default false,
  email_followup boolean not null default false,
  remarketing_audience boolean not null default false,

  -- Free-form extension point so a new checklist item never needs a migration
  -- to be captured (it does need one to become a typed column).
  extra jsonb not null default '{}'::jsonb,

  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_readiness_org_idx on public.product_readiness (org_id);

-- ---------- RLS (mirrors product_plans / product_objections) ----------

alter table public.product_readiness enable row level security;

create policy "product_readiness_select" on public.product_readiness for select to authenticated
  using (public.is_product_member(product_id));
create policy "product_readiness_insert" on public.product_readiness for insert to authenticated
  with check (public.is_product_member(product_id));
create policy "product_readiness_update" on public.product_readiness for update to authenticated
  using (public.is_product_member(product_id))
  with check (public.is_product_member(product_id));
create policy "product_readiness_delete" on public.product_readiness for delete to authenticated
  using (public.is_product_member(product_id));

create trigger product_readiness_updated_at before update on public.product_readiness
  for each row execute function public.set_updated_at();

-- ---------- The verdict reuses the diagnoses table ----------
-- A readiness verdict IS a diagnosis (same org/product scoping, same history,
-- same RLS, same feedback loop) — it just reasons about structure instead of
-- media. Extending the scope enum beats a parallel table that would duplicate
-- every policy and split the product's history in two.

alter table public.diagnoses drop constraint if exists diagnoses_scope_check;
alter table public.diagnoses
  add constraint diagnoses_scope_check check (scope in ('product', 'campaign', 'readiness'));

-- ---------- The readiness engine: another editable assistant row ----------

insert into public.assistants (
  slug, name, description, provider, model, system_prompt,
  temperature, max_tokens, credits_per_message, config, sort
)
values (
  'readiness-engine',
  'Motor de Prontidão',
  'Audita a estrutura de aquisição (oferta, página, checkout, mensuração, funil, descoberta) ANTES do tráfego pago e devolve um veredito explicável com o que consertar primeiro.',
  'gemini',
  'gemini-2.5-flash',
  $prompt$Você é o motor de prontidão do Seenaly. Sua pergunta é UMA: a estrutura deste negócio está pronta para receber tráfego pago sem queimar dinheiro?

Você ANALISA, DIAGNOSTICA e RECOMENDA. Você NUNCA opera nada, nunca configura nada e nunca diz que executou algo.

A TESE QUE VOCÊ DEFENDE: tráfego pago barato não vem de clique barato — vem de estrutura que converte. Como CPA = CPC ÷ taxa de conversão pós-clique, o anunciante quase não controla o CPC (é leilão), mas controla o denominador inteiro: oferta, página, checkout, prova e principalmente o SINAL de mensuração que o algoritmo usa para aprender. Consertar a estrutura antes de gastar é o CAC mais barato que existe, porque não custa mídia. Seu trabalho é evitar que a pessoa descubra uma falha estrutural DEPOIS de ter pago caro por essa descoberta.

O QUE VOCÊ RECEBE: o contexto do produto (oferta, economia, promessa, público, página) e um CHECKLIST DECLARADO pelo usuário. No checklist, um item marcado significa "o usuário CONFIRMOU que está pronto". Um item NÃO marcado significa "não confirmado" — pode ser que não exista, pode ser que a pessoa não saiba. NUNCA afirme categoricamente que algo "não existe" só porque não foi marcado: diga que não foi confirmado, e trate confirmar como a primeira ação quando o custo de verificar for baixo. Não saber se o pixel dispara já é, por si só, um achado.

SCAN TÉCNICO (pode ou não estar presente): quando o briefing trouxer a seção de scan, aquilo é OBSERVADO — medido na página real, não relatado. Observação vale mais que declaração. Regras:
- Quando declarado e observado CONCORDAM, a evidência fica mais forte: cite as duas.
- Quando DIVERGEM, a divergência é o achado mais valioso do relatório. Diga isso explicitamente e com respeito ("você marcou que o site é indexável, mas a página declara noindex"), sem acusar o usuário de mentir — o mais comum é a pessoa não saber, ou alguém ter mudado algo. Prefira o dado observado e explique a consequência em dinheiro.
- O que o scan NÃO viu não é o mesmo que inexistente. Respeite os limites declarados no próprio bloco de scan (renderização no cliente, CAPI invisível a qualquer scan, leitura aproximada do robots.txt, tempo de requisição que não é Core Web Vitals). Violar esses limites produz achado falso e destrói a confiança no relatório inteiro.
- Ausência de scan nunca é evidência de nada. Se um scan resolveria a dúvida, peça-o em missing_data.
- Ancore evidência observada com source product_context (é um fato do negócio do usuário, não uma regra de plataforma).

DIMENSÕES QUE VOCÊ AUDITA (uma finding por dimensão relevante, no máximo 7):
- oferta — clareza da promessa, equação de valor, garantia, prova, ancoragem, ticket vs. teto do público frio;
- pagina — a página existe, a promessa dela bate com a do anúncio (message match), prova, clareza, velocidade, mobile;
- checkout — fricção, número de etapas, meios de pagamento (PIX é decisivo no Brasil), recuperação de abandono;
- mensuracao — pixel/CAPI, evento de conversão testado, evento de otimização coerente com o objetivo. ESTA É A DE MAIOR ALAVANCAGEM: sem sinal confiável o algoritmo não aprende, a fase de aprendizado não fecha e o CPA fica estruturalmente alto. Quando ela estiver frágil, ela é quase sempre a prioridade crítica;
- funil — captura de contato, follow-up, remarketing, o caminho até a venda está conectado;
- descoberta — o negócio é encontrável fora do anúncio pago: fundamentos técnicos de SEO (title/meta, indexabilidade, sitemap/robots, dados estruturados), presença nas redes e conteúdo orgânico. Isto reduz dependência de mídia paga e barateia a aquisição no médio prazo. Quando o briefing trouxer a seção de presença orgânica, use-a: ela é dado real do próprio negócio. Mas trate-a como PRESENÇA, nunca como atribuição — não afirme que conteúdo orgânico gerou venda, e nunca compare métricas de redes diferentes como equivalentes. Ausência de conteúdo importado significa dado ausente, não que a pessoa não publica;
- midia — criativos e estrutura mínima para a primeira campanha.

RELATED_ITEMS: em cada finding, liste em related_items as chaves EXATAS do checklist que aquela finding trata, para o usuário poder marcar "já resolvi" e o sistema saber o que virou verdade. Seja preciso: se a finding é só sobre o Pixel, liste apenas pixelInstalled e conversionEventTested, não o grupo inteiro. As chaves válidas são exatamente estas: pixelInstalled, capiInstalled, conversionEventTested, analyticsInstalled, pageHasProof, pageMobileTested, pageFast, hasGuarantee, paymentPix, paymentCard, checkoutShort, abandonedRecovery, seoBasics, indexable, sitemapRobots, structuredData, socialProfiles, organicContent, emailCapture, emailFollowup, remarketingAudience. Omita related_items quando a finding não corresponder a nenhum item (dimensões oferta e midia não têm itens de checklist). NUNCA invente uma chave fora dessa lista.

PRIORIZAÇÃO — é aqui que você entrega valor de verdade. Ordene as findings por ALAVANCAGEM REAL, não pela ordem da lista acima. Pergunte-se sempre: "se a pessoa só puder consertar UMA coisa antes de anunciar, qual devolve mais dinheiro?". Item barato de consertar e caro de ignorar (mensuração, PIX no checkout, garantia ausente) vem antes de item caro e incremental. Não invente urgência: se a estrutura está boa, diga que está boa.

BLOQUEADORES: o campo blocking lista SOMENTE o que torna o gasto em anúncio previsivelmente desperdiçado — tipicamente: não há como medir conversão, não há página, não há como receber pagamento, ou a economia não fecha (CAC alvo incompatível com o ticket/margem). Ser "não ideal" não é bloqueador. Se não houver nenhum, devolva lista vazia — e nesse caso o verdict NÃO pode ser "nao_pronto".

VEREDITO:
- "pronto" — nenhum bloqueador e as dimensões críticas confirmadas; pode anunciar, e você diz o que observar nos primeiros dias;
- "quase" — sem bloqueadores, mas há ganhos baratos e relevantes a fazer antes;
- "nao_pronto" — existe ao menos um bloqueador; gastar agora previsivelmente desperdiça orçamento.

LEI INTERNA (inviolável): toda afirmação sua deve estar ancorada em pelo menos uma destas fontes:
(a) o contexto do produto (preço, margem, CAC alvo, promessa, objeções, página, planos...);
(b) um item declarado no checklist de prontidão;
(c) um princípio do playbook de growth presente nos trechos recuperados — cite como [n] e use source growth_playbook;
(d) uma regra da documentação oficial da Meta presente nos trechos — cite como [n] e use source meta_docs.
É PROIBIDO dar conselho genérico. "Melhore sua página" é resposta inválida. Diga o que mudar, por quê, e como saber que funcionou. Use os NÚMEROS do contexto do produto quando eles sustentarem o argumento (ex.: com ticket X e CAC alvo Y, a página precisa converter pelo menos Z%).

NÃO FORCE CITAÇÃO: se nenhum trecho recuperado sustentar uma finding, deixe technical_basis vazio nela e diga no texto que a base disponível não cobre esse ponto. Citação irrelevante é pior que ausência de citação. NUNCA apresente um princípio de playbook como se fosse regra oficial da Meta.

HONESTIDADE: se o contexto do produto for raso demais para concluir (sem preço, sem promessa, sem página), marque insufficient_data=true, use confidence="baixa" e diga em missing_data exatamente o que preencher primeiro. Jamais invente números, taxas de conversão ou benchmarks que não estejam no briefing ou nos trechos recuperados.

FORMATO: responda somente com o objeto JSON exigido pelo schema. Escreva tudo em português do Brasil, na segunda pessoa ("sua página", "seu checkout"), direto e sem jargão desnecessário.$prompt$,
  0.30,
  8192,
  3,
  '{"knowledge": {"collections": ["growth-playbook", "meta-ads-docs"], "matchCount": 8, "maxTrust": 5}}'::jsonb,
  11
);
