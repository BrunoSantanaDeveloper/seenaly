# Plano de Implementação — Prontidão (gaps e melhorias)

> **STATUS (2026-07-30): IMPLEMENTADO.** Todas as fases (0–5) entregues e verificadas — 738 asserções
> em `npm run test:readiness`, `npm run typecheck` e `npm run lint:fix` limpos. Restam apenas:
> (a) **operacional**: aplicar as migrações `0037`–`0040` no banco vivo (`npm run db:migrate`) e conferir
> o `max_tokens` dos assistentes (a antiga 0035 nunca foi aplicada); (b) **deferido de propósito**:
> o rework visual do radio do modelo de funil (P4 — os aria-labels/controls/nomes únicos foram
> entregues; o RadioGroup nativo muda o visual e merece olhar de design), os erros inline de
> how-to/registro dentro do card + indicador de salvamento na visão do veredito (U8 parcial — os erros
> continuam no alerta do topo), e a adoção do `record_diagnosis_and_charge` nos motores de campanha e
> plano criativo (decisão 2 — PR próprio após o B1 estabilizar); (c) **conteúdo**: artigo no Help
> Center ensinando Test Events + Meta Pixel Helper (decisão 7). Recomenda-se rodar o skill
> `product-verify` na jornada completa antes do deploy.

> Gerado em 2026-07-29 a partir da análise completa da feature (auditoria de código + 6 especificações
> de design aterradas no repositório). **Como usar**: cada item é uma spec implementável — abordagem
> decidida, arquivos, migração, i18n, testes e critério de aceite. Os números de linha citados foram
> verificados na data acima e **devem ser re-conferidos ao implementar** (o código anda).
>
> Convenções obrigatórias (violar = PR rejeitado):
> 1. Toda string visível via next-intl, nos **5 catálogos** (`de,en,es,fr,pt-BR`), namespace `readiness`.
> 2. Server actions retornam **códigos estáveis** de erro; nunca novas strings pt-BR hardcoded.
> 3. Prompts de assistente são ajustáveis pelo operador — comportamento novo vai no **brief gerado**
>    (padrão da migração 0034), nunca sobrescrevendo prompt.
> 4. Migração precisa de **marcador derivável** por `scripts/apply-migrations.mjs` (table/function/bucket/column).
> 5. Créditos: nunca cobrar por falha; idempotência é garantia de billing; `recordAudit` em toda mutação.
> 6. Invariante do espectro de maturidade: valor nunca é bloqueado; scan/enriquecimento sempre opcionais.
> 7. Compatibilidade com vereditos já gravados (padrão `related_items`).
> 8. Componentes compartilhados (`setup-wizard.tsx` etc.): API só aditiva; conferir todos os consumidores.

## Numeração de migrações (conflito resolvido)

A mais alta hoje é `0036_plan_change_credits.sql` (há duas `0035_*`, um dos problemas a corrigir).
Numeração canônica deste plano — **re-conferir a pasta antes de criar cada arquivo**:

| Nº | Arquivo | Item |
|---|---|---|
| 0037 | `0037_readiness_token_budget.sql` (rename da 0035 duplicada) | S6 |
| 0038 | `0038_readiness_billing_rpc.sql` (RPC veredito+cobrança + policy rollback) | B1 |
| 0039 | `0039_readiness_howto_rpc.sql` (RPC how-to+cobrança) | B2 |
| 0040 | `0040_readiness_run_lock.sql` (lock de geração) | B3 |

## Fases e ordem de execução

| Fase | Itens | Tema | Esforço |
|---|---|---|---|
| 0 | S6, P2, B4 | Fundações: higiene de migração, contrato de erros, cooldown | 1 S + 2 M |
| 1 | V1, B1, B2, B3, P1 | Bugs de confiança, cobrança e multi-org | 5 M |
| 2 | V2, V3 | Honestidade da verificação (SPA) + PageSpeed | 1 M + 1 L |
| 3 | R1, R2, S1, S3, S4, S2 | Fechamento do contrato de produto | 2 M + 1 S + 1 M + 2 S |
| 4 | R3, U1–U8, P3, P4, P5 | UX da jornada + polimento + a11y | 1 L + 6 M + 4 S |
| 5 | S5 | Documentação (PRODUCT.md) — **último** | 1 S |

Esforços: S < 1h, M ≈ meio dia, L ≈ 1–2 dias. Total estimado: **12–15 dias-dev**.

Dependências entre itens: V2←V1; V3←V1,V2; B3←B4; S4←S3; S5←S1..S4,S6; U1←R3; U3←U2;
U7←U2,U5; U8←U4; P5←P2,P1,U8.

---

# FASE 0 — Fundações

## S6 — Higiene de migração: renomear 0035 do token budget, torná-la aplicável e endurecer o script

**Problema.** `0035_readiness_token_budget.sql` é UPDATE puro — `deriveMarker` (scripts/apply-migrations.mjs:63-79)
só reconhece `create table` / `create function` / bucket / `add column`, então o arquivo é **pulado em
silêncio** (`SKIP … verify manually`, linhas 124-126) e duplica o prefixo `0035` com `0035_admin_controls.sql`.
O fix de truncamento do Gemini pode nunca ter chegado ao banco.

**Abordagem.** Padrão já provado pela `0030_welcome_credits_backfill.sql`: embrulhar o UPDATE numa
função que fica como marcador.
- **`packages/db/migrations/0037_readiness_token_budget.sql`** (git mv + reescrita):
  - Header: `Marker for scripts/apply-migrations.mjs = create function public.apply_readiness_token_budget`
    (nada de `create function public.` antes dela no texto; jamais escrever a frase `create table public.X`
    em comentário — o regex de tabela tem prioridade e lê comentários).
  - Corpo: `create function public.apply_readiness_token_budget() returns integer language plpgsql
    set search_path = public` — roda os UPDATEs guardados (`set max_tokens = 16384 where slug in
    ('readiness-engine','diagnosis-engine') and max_tokens = 8192` — linhas ajustadas pelo operador ficam
    intactas; re-execução é no-op), `get diagnostics` retorna row_count. Depois:
    `revoke execute … from public, anon, authenticated;` e `select public.apply_readiness_token_budget();`
- **Apagar** `0035_readiness_token_budget.sql` no mesmo commit (o script nunca a aplicou; se o operador
  rodou manualmente, o WHERE guardado torna a re-execução inócua).
- **`scripts/apply-migrations.mjs`**: transformar o SKIP silencioso em **falha dura** — coletar arquivos
  sem marcador e `process.exit(1)` com mensagem ensinando o padrão function-wrap (0030/0037), em dry-run
  e apply. Verificado: nenhum outro arquivo da árvore atual cai nesse caso.

**Passo operacional primeiro**: rodar `select slug, max_tokens from assistants where slug in
('readiness-engine','diagnosis-engine')` no banco vivo (via /admin/insights ou psql) — decide se a 0037
é aplicação real (8192) ou no-op registrado (16384/ajustado).

**Testes**: dry-run deve listar 0037 com `marker: function apply_readiness_token_budget` e **zero** linhas
SKIP. **Aceite**: 0035 duplicada não existe mais; assistants lêem 16384 (ou valor ajustado). **Esforço S.**

## P2 — Contrato de códigos de erro em todas as actions de prontidão (item que define o padrão)

**Problema.** As actions retornam strings pt-BR hardcoded ("Sessão expirada.", `error.message` cru do
Postgres…) renderizadas verbatim em 5 idiomas.

**Abordagem.** Estender o padrão `code` já existente (`insufficient_credits`/`no_subscription`) para um
**enum fechado obrigatório** em todo `{ok:false}`: shape `{ ok:false; code: ReadinessErrorCode;
detail?: string; balance?; cost? }` — o campo `error: string` é **substituído** (todos os consumidores
estão em `experience.tsx`, atualizados no mesmo PR).
- **NOVO `apps/web/src/lib/readiness/errors.ts`** (puro, zero imports): `READINESS_ERROR_CODES` com 18
  códigos: `session_expired, product_not_found, no_landing_page, invalid_item, assist_unavailable,
  no_subscription, subscription_suspended, insufficient_credits, assistant_unavailable, verdict_not_found,
  not_readiness_verdict, verdict_malformed, finding_not_found, knowledge_failed, engine_failed,
  engine_malformed, save_failed, load_failed` + fallback client-only `unknown`. Tipo compartilhado
  `ReadinessActionFailure`.
- **`readiness/actions.ts`**: os ~34 sites de retorno inventariados na spec (um código por site; o caso
  suspenso do `org_entitlements` vira código próprio `subscription_suspended`; mensagens upstream viram
  `detail`). As literais pt-BR são **apagadas**.
- **`experience.tsx`**: estado `error` vira `{ code, detail? }`; o Alert renderiza `t('error-'+code)` como
  título e `t('error-detail', {detail})` como linha secundária. Ações de outros domínios renderizadas
  nesta tela (`recordDiagnosisFeedback`, `registerExperimentFromReadinessFinding`) embrulhadas como
  `{ code:'unknown', detail }` até migrarem.
- **i18n**: 20 chaves `readiness.error-*` + `error-unknown` + `error-detail` nos 5 catálogos.

**Testes** (`scripts/test-readiness.mts`): para cada catálogo, `readiness['error-'+code]` não-vazio para
todo código do enum; códigos únicos e `/^[a-z][a-z_]+$/`. **Aceite**: `grep 'ok: false, error:'` nas
actions = zero; forçar falha mostra cópia localizada em cada idioma. **Esforço M.**

## B4 — Cooldown por produto no scan (60s), sem migração

**Problema.** `scanProductSite` é grátis e dispara fetch de até 8s contra URL arbitrária — martelável.

**Abordagem.** Checagem server-side do último `product_scans.created_at` antes do `scanSite`.
- **`lib/readiness/scan.ts`**: `SCAN_MIN_INTERVAL_MS = 60_000` + helper puro
  `scanCooldownRemainingSeconds(lastScanIso, nowMs)` (0 para null/inparseável — fail-open).
- **`actions.ts`**: `ScanProductResult` ganha `code?: 'scan_cooldown'; retryAfterSeconds?`. Query do
  último scan; se `remaining > 0`, retorna sem insert e sem audit. Erro na leitura do cooldown = fail-open.
- **`experience.tsx`**: novo estado `notice` (Alert `severity="info"` — cooldown é orientação, nunca erro
  vermelho; regra error≠empty). `runScan` trata o código antes do `setError`. O estado `notice` é
  reutilizado pelo B3.
- **i18n**: `readiness.scan-cooldown` (com `{seconds}`) nos 5 catálogos.

**Testes**: matriz do helper (null→0; 30s atrás→30; 61s→0; inválido→0; skew futuro→limitado).
**Aceite**: 2º scan em <60s não insere linha e mostra o aviso info traduzido. **Esforço S.**
**Questão aberta**: intervalo fixo 60s ou por plano (`limits` jsonb de `org_entitlements`)? Teto por org?

---

# FASE 1 — Confiança, cobrança e multi-org

## V1 — Pixel via GTM nunca mais "contestado" (auditoria de caminhos de lavagem)

**Problema.** Página server-rendered com Pixel dentro do GTM: HTML tem GTM mas não `fbq` →
`observeItem('pixelInstalled')` retorna `false` → `verifyItem` **recusa um tick verdadeiro** e pode
disparar a oferta de concierge por `contradicted-after-retry`. Segundo caminho descoberto e **verificado**:
os dois pontos de recusa da UI usam `observeItem === false` cru em vez do `verifyItem` (que respeita
tiers) — `readiness-checklist.tsx:157` e `experience.tsx:500` — hoje recusando até itens tier *weak*
(`pageMobileTested` sem viewport), violando o contrato documentado em `checklist.ts` ("weak … never refuse").

**Abordagem.**
- **`lib/readiness/checklist.ts` → `observeItem`**: `pixelInstalled`: metaPixel→true; senão gtm→**null**;
  senão false. `structuredData`: types>0→true; senão gtm→null; senão false. (`analyticsInstalled` é imune —
  gtm já conta como presença; `seoBasics`/`indexable` não têm entrega via GTM que importe para crawler;
  `sitemapRobots` é probe.) Comentário nomeando a regra: "GTM presente ⇒ ausência de tag não é prova".
- **UI**: `readiness-checklist.tsx:157` e `experience.tsx:500` trocam para
  `verifyItem(key, true, signals) === 'contradicted'` — autoridade de recusa em UMA função ciente de tier.
- **`brief.ts` → `readinessScanBlock`**: linha condicional nos LIMITES quando `gtm && !metaPixel`: o Pixel
  pode viver no contêiner; nunca contestar Pixel declarado.
- **`readiness-scan.tsx`**: nota `t('scan-gtm-pixel-note')` na seção de tracking (padrão da nota de CAPI).
- **i18n**: `readiness.scan-gtm-pixel-note` (5 catálogos).

**Testes**: GTM-only + pixel marcado ⇒ `unverifiable` (não contradicted); `fbq` presente ⇒ verified;
sem GTM + sem fbq + marcado ⇒ contradicted (existente, deve continuar verde); GTM-only nunca auto-confirma;
regra do structuredData; imunidade do analytics; presença/ausência do caveat no brief.
**Riscos**: usuário de GTM passa a ser confiado (declarado) — direção pretendida; a troca para `verifyItem`
remove a recusa (contra-contrato) de itens weak — deliberado, documentar no commit.
**Aceite**: página com GTM sem fbq permite marcar Pixel sem recusa; concierge nunca mostra
`contradicted-after-retry` para esse caso. **Esforço M.**

## B1 — Persistência e cobrança do veredito atômicas via RPC (+ conserto do rollback do requestAssist)

**Problema.** `generateReadiness` cobra (consume_credits) **antes** do insert em `diagnoses`; insert
falhou = pagou por nada. E o "insert primeiro, delete no rollback" não funciona aqui:
`0012_diagnoses.sql` dá DELETE só a owner/admin e **não tem UPDATE** — para membro comum o delete
silenciosamente afeta 0 linhas. **Bug extra descoberto**: o rollback do `requestAssist`
(`actions.ts:351`, delete da linha) também é no-op — `0032` não define policy de DELETE em
`readiness_assists`.

**Abordagem.** Migração **0038**: RPC `SECURITY DEFINER public.record_diagnosis_and_charge(target_org,
target_product, p_scope, p_assistant_slug, p_model, p_output, p_confidence, p_insufficient_data,
p_had_campaign_data, p_knowledge_refs, p_reason) returns jsonb` — insert em `diagnoses` + `consume_credits`
em UMA transação; bloco `EXCEPTION when raise_exception` (P0001 do consume_credits) desfaz o insert e
retorna `{ok:false, code:'insufficient_credits', balance, cost}`. Regras internas: re-checar
`is_org_member(target_org)` + produto pertence à org (DEFINER bypassa RLS); **preço lido dentro da função**
de `assistants.credits_per_message` por slug (caller nunca dita preço); `created_by = auth.uid()`.
Assinatura scope-agnóstica de propósito: `diagnosis/actions.ts` e `creatives/plan-actions.ts` têm o
mesmo defeito e devem adotar depois (questão aberta).
Mesma migração (DECIDIDO 2026-07-29, questão 3): em vez de policy de DELETE (que permitiria a um
cliente buggy apagar uma linha JÁ PAGA sem estorno), o `requestAssist` adota o mesmo padrão atômico —
RPC `record_assist_and_charge(target_product, p_item_key, p_request_reason, p_credit_reason,
p_contact_note)`: checa membership + offering ativa (slug `readiness-item-session` hardcoded — caller
nunca dita preço), retorna pedido aberto existente como `already_open`, insere + cobra na MESMA
transação (exceção `unique_violation` da corrida ⇒ retorna o vencedor sem cobrar; P0001 do
consume_credits ⇒ desfaz o insert). Nenhum direito de DELETE é concedido a usuários.
- **Marcador**: primeira ocorrência de `create function public.` deve nomear
  `record_diagnosis_and_charge`; nunca escrever `create table public.X` em comentário.
- **`actions.ts`**: substituir o bloco cobra+insere+getUser por uma chamada ao RPC; mapear o jsonb
  defensivamente; `recordAudit` continua na action após sucesso (ganha `metadata.credits`).

**Testes**: cenário psql documentado no header da migração (saldo insuficiente ⇒ zero linhas novas em
`diagnoses` e `credit_transactions`; sucesso ⇒ exatamente 1+1; produto de outra org ⇒ raise).
**Risco**: janela deploy-antes-de-migrar (PGRST202) — aplicar 0038 junto do deploy.
**Aceite**: os 3 cenários acima + policy de rollback existe e o requestAssist com débito falho não deixa
linha. **Esforço M.**

## B2 — How-to: cache-insert + cobrança atômicos, cobrança única sob corrida

**Problema.** O insert do cache (`actions.ts:517`) roda **depois** da cobrança e o resultado é ignorado —
falha (inclusive corrida 23505 no unique `(diagnosis_id, finding_index)`) = cobrou e perdeu o cache; o
próximo clique cobra de novo.

**Abordagem.** Migração **0039**: RPC `record_readiness_howto_and_charge(p_diagnosis, p_finding_index,
p_steps, p_sources, p_reason)` — `insert … on conflict do nothing returning id`; se null (perdeu a
corrida), seleciona a linha vencedora e retorna `{ok:true, raced:true, steps, sources}` **sem cobrar**;
senão cobra e retorna `{raced:false, charged}`; exceção do consume_credits desfaz o insert. Slug
`readiness-howto` hardcoded na função. Ordem verificada sob READ COMMITTED: o perdedor espera o commit
do vencedor — exatamente uma cobrança.
- **`lib/readiness/howto.ts`**: extrair `normalizeStoredHowTo(stored)` puro (lógica hoje inline em
  `actions.ts:414-424`), reutilizado no cache-read e no retorno raced.
- **`actions.ts`**: substituir cobrança+insert pelo RPC; `raced:true` retorna como `cached:true` sem audit.
- A regra de honestidade fica intacta: RPC só é chamado quando `raw.steps.length > 0`.

**Testes**: `normalizeStoredHowTo` (null, round-trip, filtro de não-strings, needs_specialist truthy≠true).
**Aceite**: duas invocações paralelas ⇒ UMA linha, UMA cobrança, os dois recebem o mesmo conteúdo; débito
falho ⇒ zero linhas (retry após top-up cobra uma vez). **Esforço M.**

## B3 — Lock de geração por produto (claim/release com TTL) — depende de B4 (estado `notice`)

**Problema.** Duas abas/duplo-clique = duas gerações LLM e duas cobranças (flag `busy` só protege uma aba).

**Abordagem.** Rejeitados: advisory lock (cada RPC do supabase-js é transação própria via pooler — o lock
solta antes do LLM) e janela por `created_at` (a corrida começa antes de qualquer insert). Migração
**0040**: tabela `readiness_run_locks (product_id pk → products cascade, locked_at, locked_by)` com RLS
**ligada e sem policies** (acesso só via RPC) + `claim_readiness_run(target_product, ttl_seconds=180)`
(upsert condicional `where locked_at < now() - ttl` — atômico; TTL 180s auto-cura crash) e
`release_readiness_run(target_product)`; ambos SECURITY DEFINER com checagem de membership.
Marcador: `create table public.readiness_run_locks`.
- **`actions.ts`**: claim **depois** dos pre-checks grátis e **antes** do RAG; claim false ⇒ código
  `generation_in_progress` (sem cobrança, sem LLM); release em try/finally. **Fail-open** em erro de
  RPC (ex.: migração ainda não aplicada) — lock é controle de custo, nunca portão de valor.
- **`experience.tsx`**: código vira `notice` info (`t('verify-in-progress')`), não erro vermelho.
- **i18n**: `readiness.verify-in-progress` (5 catálogos).

**Aceite**: duas chamadas concorrentes ⇒ 1 linha, 1 cobrança, 1 resposta `generation_in_progress`; crash
simulado destrava em 180s; sem a migração aplicada, tudo funciona como hoje. **Esforço M.**

## P1 — Org derivada do produto resolvido (multi-org) + beco sem saída do workspace

**Problema (verificado).** `useOrganization` fixa `orgs[0]`; produto de org #2 forçado pela URL não está
na lista carregada → fallback seleciona **outro produto** silenciosamente; `getReadinessCreditInfo` lê a
org errada enquanto a cobrança cai na org do produto; `submitFeedback` grava `org_id` errado. E o alerta
"Selecione um produto acima" aparece no modo workspace onde o seletor está oculto.

**Abordagem** (escopo prontidão; **não tocar** `use-organization.ts` — 25 consumidores).
- **`experience.tsx`**: no fluxo forçado, resolver PRIMEIRO a linha do produto por id sob RLS
  (`select id, name, org_id, landing_page_url, price`); null ⇒ novo estado `productNotFound` com
  `EmptyState` (CTA → `/products`) — nunca produto substituído em silêncio; achado ⇒ `productOrgId`,
  lista de irmãos por essa org, seleção forçada incondicional (sem fallback de localStorage).
  `effectiveOrgId = productOrgId ?? currentOrg?.id` para `loadCredit`; `submitFeedback` usa `productOrgId`.
  Gate `!workspace &&` no alerta select-product-guidance.
- **`actions.ts`**: `getAssistInfo(orgId, productId)` → `getAssistInfo(productId)` (parâmetro morto,
  verificado: nenhuma query o usa).
- **i18n**: `readiness.product-not-found-{title,body,cta}`.

**Aceite**: usuário em 2 orgs abre produto da org #2 ⇒ produto certo, saldo da org certa, feedback com
org certa; workspace nunca mostra o alerta órfão. **Esforço M.**
**Questão aberta (plataforma)**: org switcher global persistido — fora deste plano.

---

# FASE 2 — Honestidade da verificação

## V2 — Fim da prisão perpétua "aguardando prova" em SPA — depende de V1

**Problema.** `jsRenderedLikely` anula toda observação ⇒ item provável marcado nunca vira `verified` e
`findingResolution` o mantém pendente para sempre (o `canVerify=false` só cobre "sem página").

**Abordagem** (3 partes, domínio puro primeiro):
1. **Canais de evidência honestos em `observeItem`**: içar `sitemapRobots` acima do guard de SPA (probes
   independem do JS da página); `indexable` retorna false com noindex/robots-block mesmo em SPA
   (definitivos); içar **presença positiva** de tag acima do guard para pixel/analytics/seoBasics/
   structuredData (tag no HTML inicial é prova real mesmo em SPA — só a AUSÊNCIA é indecidível).
2. **NOVO helper `unprovableItems(signals): ReadinessItemKey[]`**: itens tier proved cuja prova positiva é
   **estruturalmente inatingível** no último scan bem-sucedido ([] sem scan — ainda dá para escanear;
   em SPA, os itens de tag ainda não provados; + casos GTM da V1). Condições explícitas, não
   `observeItem===null` — erro transitório de probe continua `awaiting-proof` (retry pode resolver).
   Exposto como campo novo `unprovable` em `ReadinessEvaluation`.
3. **`findingResolution`**: evidência ganha `unprovable?`; novo valor **`declared-unverifiable`** (chip
   próprio — o usuário merece o PORQUÊ, não confiança silenciosa) quando todo provável ainda-não-verificado
   é improvável; `isFindingPending` o exclui. Resolução é computada em render — vereditos antigos intactos;
   `RESOLUTION_COLOR` é `Record<FindingResolution,…>` — o compilador força a atualização da UI.
- **UI**: chip+corpo em `readiness-verdict.tsx`; em `readiness-checklist.tsx` o botão "Verificar agora"
  some para itens improváveis (substituído por nota honesta `t('item-unprovable-note')`).
- **Brief**: marca pt-BR "declarado e IMPOSSÍVEL de verificar pela nossa leitura" em vez de
  "declarado, NÃO verificado".
- **i18n**: `resolution-declared-unverifiable`, `resolution-declared-unverifiable-body`,
  `item-unprovable-note` (5 catálogos).

**Testes**: tabela de decisão completa (matriz SPA de `observeItem`; `unprovableItems`; `findingResolution`
com/sem o campo novo — guarda de retrocompatibilidade; `isFindingPending`). **Reescrever** o teste
existente "a client-rendered page confirms nothing" em duas metades (presença em SPA confirma; ausência
nunca confirma). **Riscos**: celebração passa a disparar em SPA com tags server-rendered — mudança real,
mas estritamente baseada em evidência. **Aceite**: em SPA, finding de pixel marcado mostra o chip novo e
sai do mapa de pendências; sitemap/robots na mesma página continuam verificáveis. **Esforço M.**

## V3 — Evidência real de performance via Google PageSpeed Insights — depende de V1, V2

**Problema.** `pageFast` é o único sinal inverificável de performance; PRODUCT.md adia "CWV via API
oficial". Fecha esse adiamento como enriquecimento opcional e grátis.

**Abordagem** (decisões todas tomadas na spec):
- **Módulos**: `lib/readiness/pagespeed-analyze.ts` (PURO: tipos `PsiSnapshot`/`PsiState`,
  `extractPsiSnapshot` defensivo do PSI v5, `classifyPageFast` com limiares oficiais do Google —
  LCP campo-p75 preferido, lab fallback; ≤2500ms→true, >4000ms→false, zona cinza→null) e
  `lib/readiness/pagespeed.ts` (server-only: `isPageSpeedConfigured()`, `runPageSpeed(url)` GET v5
  strategy=mobile, 25s AbortController, nunca lança).
- **Env**: `GOOGLE_PAGESPEED_API_KEY` em `apps/web/.env.example` — sem chave, feature **invisível**
  (scan byte-idêntico a hoje).
- **Execução**: primário via Inngest — evento `readiness/pagespeed.requested {scanId}` em
  `packages/jobs`, função `readinessPageSpeed` em NOVO `lib/readiness/jobs.ts` (espelho de
  `lib/diagnosis/jobs.ts`; retries 2, concurrency 2, idempotente por `result.psi.status==='ok'`),
  registrada em `api/inngest/route.ts`. Fallback: sem Inngest ⇒ inline ANTES do insert (um único INSERT
  da sessão do usuário — `product_scans` não tem policy de UPDATE; enriquecimento posterior só via
  service role no job).
- **Persistência**: dentro de `product_scans.result.psi` (design declarado da 0029: novo check não exige
  migração) — **sem migração**.
- **Tier**: `pageFast` weak → **proved**; `observeItem('pageFast')` = `classifyPageFast(signals.psi)`
  acima do guard de SPA; `unprovableItems` inclui pageFast quando `psi.status !== 'ok'` (instalações sem
  chave degradam para `declared-unverifiable`, nunca nova prisão perpétua).
- **Brief**: linha de velocidade oficial quando ok (LCP + fonte campo/lab + cortes 2500/4000 + score);
  o caveat "NÃO é Core Web Vitals" atual permanece verbatim quando ausente.
- **UI** (`readiness-scan.tsx`): seção Velocidade (score/LCP/CLS com tons ok/warn/bad), estado pending
  com refresh, estado failed; sem `psi` ⇒ nada. `experience.tsx`: `refreshScan({countAttempt:false})`
  para o auto-refetch (~25s) **não inflar** `scanAttempts` (alimenta o assistReason); após refresh,
  re-rodar o fold `autoConfirmProven`.
- **i18n**: 7 chaves `scan-group-speed`, `scan-fact-psi-{score,lcp,cls}`, `scan-psi-{pending,refresh,failed}`.

**Testes**: extractor sobre fixture v5; matriz do classificador; tier flip; interação com unprovable;
linhas do brief; loop weak-never-refused atualizado (pageFast sai da lista weak). **Aceite**: com chave,
página rápida auto-confirma `pageFast` e pode chegar a `verified`; página lenta recusa o tick com
evidência oficial; sem chave, pixel-idêntico a hoje. **Esforço L.**
**Questões abertas**: página comprovadamente lenta vira BLOQUEADOR determinístico grátis? Medir desktop também?

---

# FASE 3 — Fechamento do contrato de produto

## R1 — `next_review_at` no veredito + cron ciente de escopo

**Problema (verificado).** Veredito de prontidão nunca grava `next_review_at`; e o cron
`diagnosisReviewReminders` agrupa por `product_id` **sem scope** (jobs.ts:35-51) — um diagnóstico de
campanha mais novo suprime o lembrete de prontidão como "superseded" (e vice-versa); a cópia/href são de
diagnóstico.

**Abordagem.**
- **`lib/readiness/schema.ts`**: `next_review` (string) e `next_review_days` (int 1–60) adicionados ao
  JSON Schema **e ao required** (provider passa a emitir), mas `isReadinessOutput` os trata como
  opcionais (precedente exato do diagnosis; retrocompat regra 7). Novo puro
  `readinessNextReviewDays(output)`: clamp [1,60] + fallback por veredito — `nao_pronto`→7,
  `quase`→14, `pronto`→30. Diferente do diagnosis: prontidão **sempre** grava `next_review_at`
  (o LLM propõe, o servidor garante — o lembrete é o motor do loop).
- **`actions.ts`**: computar e incluir `next_review_at` no insert (via RPC do B1 — adicionar o campo lá);
  audit ganha `next_review_days`. *(Sem migração: `next_review_at`/índice já existem da 0026 para todos
  os escopos.)*
- **NOVO puro `lib/diagnosis/review-select.ts`**: `selectDueReviewTargets(due, latest)` — chave
  `${product_id}::${scope}`, supressão só dentro do mesmo produto+escopo (lógica atual corrigida).
- **`lib/diagnosis/jobs.ts`**: adicionar `scope` aos dois selects; usar o helper; cópia/href por escopo
  (readiness: "Hora de reconferir a prontidão", href `/products/<id>/readiness`); demais escopos
  intactos. Notificações seguem pt-BR hardcoded (precedente da plataforma — questão aberta).
- **UI**: linha "Próxima leitura: {when}" no rodapé do veredito quando o campo existir.
- **i18n**: `readiness.next-review-label`.

**Testes**: fallbacks/clamp; retrocompat de `isReadinessOutput`; `selectDueReviewTargets` — linha de
prontidão vencida + diagnóstico de campanha mais novo no mesmo produto ⇒ prontidão AINDA selecionada
(o bug), supressão mesmo-escopo funciona. **Aceite**: veredito novo tem `next_review_at` ≈ agora+dias;
dry-run do seletor mira a linha certa com href certo. **Esforço M.**
**Questões abertas**: números 7/14/30 e cap 60 (política de produto).

## R2 — Memória de experimentos no brief de prontidão

**Problema.** Brief não vê experimentos ⇒ correção concluída pode ser re-recomendada, contra o PRODUCT.md.

**Abordagem.** Extrair — extração é **obrigatória**: `experimentsBlock` vive num arquivo `"use server"`
(só exporta async) — para NOVO módulo puro `apps/web/src/lib/experiments/brief.ts`
(`ExperimentSummaryRow`, `EXPERIMENT_BRIEF_LIMIT=15`, `experimentsBlock` **verbatim** — o brief de
campanha não pode mudar um byte). `diagnosis/actions.ts` passa a importar. `generateReadiness`: query
idêntica à do diagnosis (15 mais recentes por produto, **sem** filtro de origem — correções estruturais
também nascem de campanha/manual); bloco `## Memória de experimentos` entre presença orgânica e o
conhecimento; instrução na Tarefa (padrão 0034): "NÃO recomende de novo correção cujo experimento está
CONCLUÍDO — parta da conclusão registrada; conclusão contradizendo o checklist é divergência a apontar."
Como `registerExperimentFromReadinessFinding` grava `change_made = recommended_action`, a correção volta
ao motor com a redação literal da recomendação antiga — sinal anti-repetição máximo.

**Testes**: `experimentsBlock` puro (vazio; ordenação concluded→running→planned→abandoned; conclusão
presente; status desconhecido por último). **Risco**: refactor toca o motor de campanha — mitigado por
mover verbatim + testes de ordem; o módulo novo não pode importar nada server-only (quebra o tsx).
**Aceite**: brief contém o bloco na posição certa; brief do diagnosis byte-idêntico ao anterior. **Esforço S.**

## S1 — Dimensão `ativacao` no modelo do veredito

**Abordagem.** Extensão aditiva de enum, **sem migração de prompt** (o JSON Schema passado ao
`generateStructured` é a superfície real de enforcement; o brief governa o uso — padrão 0034).
- `schema.ts`: `ativacao` no union `ReadinessDimension`, no enum do JSON Schema e no array `DIMENSIONS`.
- `checklist.ts`: `DIMENSION_GROUP.ativacao = 'ativacao'` ⇒ `itemsForDimension('ativacao')` devolve os 4
  itens de ativação — findings trial→paid finalmente resolvíveis pelo fallback.
- `brief.ts` (bloco trial_first): consequência 9 — achados pós-login usam `ativacao`, nunca `checkout`/
  `funil`; fora de trial-first NUNCA usar; ajustar a linha de related_items.
- **i18n**: `readiness.dimension-ativacao` ("Ativação do trial") nos 5 catálogos.

**Testes**: output com `ativacao` passa; dimensão inventada falha; `itemsForDimension`/`resolvableItems`;
brief menciona a dimensão só em trial-first. **Retrocompat**: limpa — vereditos antigos não podem conter
`ativacao` (schema rejeitava). **Aceite**: verdict trial-first renderiza o título traduzido e oferece os
4 checkboxes. **Esforço M.**

## S3 — Biblioteca de criativos no brief (presença, nunca desempenho)

**Abordagem.** Reutilizar a máquina existente: extrair `loadCreativeEvidence` (privada em
`creatives/plan-actions.ts:53-83`) para NOVO `lib/creative-plan/evidence.ts` (server-only, SEM
`"use server"` — recebe o client como argumento). NOVO puro `readinessCreativesBlock(creatives)` em
`brief.ts`, moldado no `readinessOrganicBlock`: vazio ⇒ "DADO AUSENTE, não prova de ausência; porta é o
Plano de Teste Criativo; peça em missing_data"; senão ⇒ só contagens (total, por status/fonte, ângulos/
ganchos/provas distintos, quantos têm publicação orgânica) + invariantes (nunca comparar métricas entre
redes; nunca atribuição). `generateReadiness`: carregar após o Promise.all (2 queries dependentes) e
inserir seção `## Evidência criativa deste produto` entre orgânico e conhecimento; estender
`readinessRetrievalQuery` com "criativos mínimos por ângulo antes da primeira campanha".

**Testes**: bloco vazio contém "DADO AUSENTE"/"Plano de Teste Criativo"; fixture 3 criativos/2 ângulos;
frase anti-atribuição presente; nunca palavras de métrica crua. **Aceite**: brief contém a seção nos dois
casos; plano criativo e diagnosis intactos (typecheck). **Esforço M.**

## S4 — Message match sem novo intake — depende de S3

**Abordagem.** Nenhum campo novo: os três lados já existem — oferta em `products.main_promise`, página no
title/H1 do scan, anúncio em `creatives.promise/angle/hook` (entregues pelo S3). Dentro do
`readinessCreativesBlock`: quando ≥1 criativo tem promise/hook ⇒ parágrafo MESSAGE MATCH listando até 10
promessas distintas + instrução "compare com o H1/title observado e a promessa principal; divergência é
achado da dimensão pagina, citando os dois lados"; quando nenhum ⇒ "a promessa do anúncio ainda não
existe registrada — não conclua nada; aponte o Plano de Teste Criativo em missing_data". PRODUCT.md ganha
a frase de deferimento (via S5).

**Testes**: fixture com promise ⇒ seção presente com o texto; all-null ⇒ frase de ausência; biblioteca
vazia ⇒ sem seção. **Aceite**: idem. **Esforço S.**

## S2 — `oferta`: contexto-por-design + porta concreta

**Abordagem.** Opção A + porta (NÃO criar grupo novo; NÃO mover `hasGuarantee` — mover quebraria a
resolução de findings de checkout de vereditos antigos via fallback de grupo; razão documentada em
comentário no `DIMENSION_GROUP`). Espelhar o padrão `midia`→plano criativo: prop opcional
`productContextHref` em `readiness-verdict.tsx`; findings `oferta` ganham botão
`t('offer-context-cta')` → **reusar o plumbing do U3** (DECIDIDO, questão 14):
`/products/<id>?focus=<campo>` apontando para a seção de oferta/economia (ex.: `?focus=price`; usar o
campo de completude mais relevante que existir em `COMPLETENESS_FIELDS`), com fallback para
`/products/<id>` puro. Nova dependência: S2 ← U3.
PRODUCT.md: frase "auditada a partir do modelo de contexto, por desenho sem grupo próprio" (via S5).
**i18n**: `offer-context-{cta,hint}`. **Testes**: `resolvableItems('oferta') === []` mantém; pino de
regressão `itemsForDimension('checkout')` contém `hasGuarantee`. **Esforço S.**

---

# FASE 4 — UX da jornada

## R3 — Histórico com diff "o que mudou", âncoras e menor tendência honesta de scan

**Abordagem.**
- **NOVO puro `lib/readiness/compare.ts`**: `VERDICT_RANK`/`STATUS_RANK`, `worstStatusByDimension`,
  `compareVerdicts(previous, next)` ⇒ transição de veredito, contagem de bloqueadores (NUNCA set-diff das
  strings — prosa de LLM fabrica pares fantasmas), transições por dimensão (pior status), dimensões
  não-mais-sinalizadas (rotuladas neutras — cap de 7 findings torna silêncio ambíguo) e novas.
- **`checklist.ts`**: `PROVABLE_ITEM_KEYS` + `scanProvedCount(signals)` (null sem scan/SPA — "ilegível"
  nunca vira 0/6; senão contagem de proved observados true) — a única série honesta: o número inforjável.
- **NOVO `readiness-history.tsx`**: até 5 Accordions, âncora `id="verdict-<id>"` (a âncora que o backlink
  do experimento precisa), resumo = data · chip de veredito · chips de delta vs predecessor; expandido =
  summary, blocking, chips por dimensão. Props `expandedId`/`onExpandedChange` prontos para o U1.
  Subcomponente `DeltaChips` reutilizado.
- **`experience.tsx`**: fetch de vereditos limit(5)→limit(6) (o 6º é só predecessor do 5º); query de
  trend `product_scans` (6 últimos); linha "O que mudou desde a última verificação" sob o veredito quando
  ≥2 rows (chip `delta-none` quando nada mudou); trend passado por prop opcional wizard→scan (≥2 entradas;
  chip por scan "dd/MM · n/6", "—" com tooltip para SPA, rótulo próprio para falha).
- **i18n**: 13 chaves `delta-*`, `history-*`, `scan-trend-*`.

**Testes**: fixtures completos do `compareVerdicts` (melhora/regressão/pior-status/cleared/new/idêntico);
`scanProvedCount` (null/SPA/completo/parcial). **Riscos**: falha das queries novas cai no `dataLoadError`
existente (error≠empty); chips informacionais, nunca botões (não competir com a ação primária única).
**Aceite**: com 2 vereditos diferentes, chips exatos; âncora resolve; trend só com ≥2 scans. **Esforço L.**

## U1 — Deep links: `?verdict=<id>#finding-<n>` e `new=1` sobrevivendo ao redirect — depende de R3

**Abordagem.** No redirect `/readiness` → `/products/<id>/readiness`: preservar TODOS os query params
(exceto `product`) + hash (`router.replace(...suffix)`) — `new=1` volta a funcionar. Hash lido em efeito
de mount (App Router não expõe hash em searchParams); `?verdict=` seleciona o veredito (plumbing do R3);
se o id não está nas 6 rows carregadas, fetch único por id (validado scope+product) — miss ⇒ notice info
`deep-link-verdict-missing`, nunca erro-como-vazio. Novo prop aditivo `focusRequest {index, nonce}` no
`ReadinessVerdict` chama o `focusFinding(index)` existente após o load assíncrono. How-tos e mapa do U6
passam a carregar pelo **veredito exibido**, não `list[0]` hardcoded. **i18n**: 1 chave.
**Aceite**: backlink do experimento abre a finding certa expandida e centrada; criação de produto mostra
a saudação de boas-vindas. **Esforço M.**

## U2 — Wizard: rail clicável + retomar posição (API aditiva; localStorage)

**Abordagem.** Props aditivas em `components/product/setup-wizard.tsx` — `initialStep` (clamped),
`onStepChange`, `navigableRail` (default false), `jumpLabel` — os outros 2 consumidores (product-form,
organic setup) não passam nada e ficam byte-idênticos. Rail vira `<button>` por item quando opt-in
(nome acessível = shortLabel + aria-label do template traduzido); guarda `steps[min(index, len-1)]`
(o array encolhe quando o funnelModel muda). Armazenamento: localStorage
`seenaly:readiness-step:<productId>` (convenção `seenaly:last-product:<orgId>`) — rejeitados
@flyee/onboarding (modela passos concluídos, não cursor; exigiria mudança de package + roundtrip para
estado efêmero de dispositivo) e URL param (o wizard também vive no Dialog de revisão). `onComplete`
limpa a chave. **i18n**: `wizard-jump-to`. **Risco documentado**: pulo pelo rail não passa por
`onBeforeAdvance` — ok para prontidão (autosave 750ms), documentar na prop.
**Aceite**: reload retoma o passo; rail navegável só na prontidão; verdito gerado limpa a posição. **Esforço M.**

## U3 — Portas nos bloqueadores (no-page / no-price / scan sem URL) — depende de U2

**Abordagem.** Expor o plumbing de foco existente do editor de contexto como URL:
`/products/<id>?focus=<CompletenessField>` (efeito one-shot em `products/[id]/page.tsx` validando contra
`COMPLETENESS_FIELDS` — URL forjada é ignorada em silêncio). `readiness-signals.tsx`: botões outlined
sob o Alert de bloqueadores — `no-page` → `?focus=landingPageUrl`, `no-price` → `?focus=price`.
`readiness-scan.tsx`: mesmo link no aviso sem-URL. Threading do `productId` via wizard (já existe do U2).
**i18n**: `blocker-fix-page-cta`, `blocker-fix-price-cta`, `scan-no-url-cta`.
**Aceite**: botões abrem o contexto com a seção certa expandida e rolada. **Esforço S.**

## U4 — Gating de créditos uniforme + CTA de billing no modal + caminho no_subscription

**Abordagem.** Um derivado único `canGenerate` em `experience.tsx` (permissivo quando `credit` é null ou
custo 0 — jamais portão fantasma); wizard recebe `canGenerate` e apaga o `short` interno — finish-early e
passo final nunca mais discordam; quando `!canGenerate`, linha explicativa + botão `/settings/billing`
**no header do wizard** (visível em todo passo, inclusive dentro do Dialog). `no_subscription` vira
estado guiado (Alert warning + CTA `/settings/billing`) em `verify()`, `requestAssistFor` e
`requestHowTo` — este último precisa do código no servidor (`HowToResult.code` ganha `no_subscription`).
**i18n**: `no-subscription-{title,body,cta}`.
**Aceite**: sem saldo, nenhum passo oferece gerar e o CTA de billing é alcançável dentro do modal; sem
assinatura, os três fluxos mostram a mesma orientação traduzida. **Esforço M.**

## U5 — Persistir sinais de resistência do concierge em `product_readiness.extra`

**Abordagem.** A coluna `extra` jsonb (inutilizada desde a 0028) recebe `{journey:{skippedItems,
helpOpenedItems}}`. NOVO em `lib/readiness/assist.ts`: `ReadinessJourneySignals` +
`sanitizeJourneySignals(unknown)` (filtra por `READINESS_ITEM_KEYS`, dedup, cap) — cliente nunca é
confiado (disciplina do `sanitizeProfile`). `saveReadiness(productId, input, journey?)` inclui `extra`
**só quando o parâmetro veio** (upsert nunca apaga sinais). Semântica corrigida: `helpOpened` =
"já abriu alguma vez" (acumulativo, one-way — remoção tornaria `stuck-on-specialist` burlável);
`skipped` sai do estado local que morre no unmount. `assistReason` **não muda** — só a durabilidade dos
insumos. `experience.tsx` sementa do row, estende o memo de dirty para `{profile, journey}` (viaja no
autosave), handler `recordJourneySignal`.
**Testes**: sanitizador (null/lixo/dedup/round-trip); seção earned-not-always-on estendida — sinal
persistido sozinho em item DIY continua null; skipped+specialist persistido ⇒ oferta.
**Aceite**: pular item especialista, recarregar ⇒ oferta continua; `extra.journey` só com chaves válidas.
**Esforço M.**

## U6 — `registeredByIndex` derivado do banco no load

**Abordagem.** Origem do experimento é `(diagnosis_id, change_made)` — a âncora de idempotência do
`registerExperimentFromReadinessFinding` (`change_made = recommended_action`). NOVO puro
`mapRegisteredExperiments(findings, rows)` em `checklist.ts` (primeiro índice casado vence). Query em
`loadReadiness` (`experiments` por `diagnosis_id` do veredito exibido); falha ⇒ mapa vazio (ação é
idempotente e grátis — re-clique não duplica nem cobra). Otimismo do `registerFinding` mantido.
**Testes**: casamento exato; ação duplicada mapeia só o primeiro; null/inconciliável ⇒ sem entrada.
**Aceite**: registrar, recarregar ⇒ card mostra "experimento planejado" com link, não o botão. **Esforço S.**

## U7 — Linha "precisa de especialista" → painel de ensino do item (concierge merecido, nunca venda direta) — depende de U2, U5

**Abordagem.** O botão abre o **modal de revisão** saltado ao passo da dimensão com o painel de ajuda do
item aberto — a ÚNICA superfície onde o `AssistOffer` legitimamente aparece, e só se `assistReason`
mereceu; senão o destino é o painel de ensino honesto (o destino decide, não o link). Clique conta como
`helpOpened` (U5) — pedido explícito de ajuda naquele item. Plumbing: NOVO puro `groupForItem(key)`;
`reviewFocus {groupKey, itemKey, nonce}` em experience; wizard mapeia grupo→índice
(`2 + posição em groupsForModel`; guarda -1) e passa `focusItemKey` ao checklist, que expande o painel e
rola (`id="readiness-item-<key>"`, delay ~60ms — padrão do focusFinding; se instável, usar
`TransitionProps.onEntered` do Dialog). Findings `oferta`/`midia` (sem itens): texto puro, **sem porta falsa**.
**i18n**: `howto-specialist-cta`. **Testes**: loop total do `groupForItem`; invariantes do U5 já provam
que o link não fabrica venda. **Aceite**: fluxo completo abre o painel certo; AssistOffer só quando
merecido. **Esforço M.**

## U8 — Lote de polimento — depende de U4

Seis correções independentes num batch:
1. **`resolveRefused` estagnado**: limpar ao abrir o modal de revisão e após re-scan bem-sucedido.
2. **Falha de `loadCredit` visível**: estado `creditLoadFailed` + Alert warning com retry (página e passo
   de revisão do wizard — falha nunca imita "carregando"); some o `outOfBalance=false` fantasma.
3. **Erros de how-to inline**: variante `{error}` em `HowToState`, Alert com retry DENTRO do accordion
   (cuidado: o consumo atual distingue por typeof — adicionar guard `'error' in x` ou o branch de objeto
   quebra lendo `howTo.steps`).
4. **Erros de registro inline**: `registerErrorByIndex` sob o botão do card, não no topo da página.
5. **Indicador de salvamento na visão do veredito**: cluster `aria-live` `save-*` na action bar sticky
   (o mesmo do header do wizard) — tick de "já resolvi" mostra Salvando…/Salvo.
6. **Clipboard**: estado `copyFailed` + dica ("o texto está na tela e é selecionável"); swap
   Copiado/falha anunciado em região `aria-live` visually-hidden. **Celebração**: `useMediaQuery` ≤640px
   ⇒ Snackbar bottom-center (top-center fica sob o header fixo).
**i18n**: `copy-failed`, `credit-load-failed`. **Aceite**: os seis comportamentos observáveis (ver spec).
**Esforço M.**

## P3 — Datas no locale do app (não do browser)

**Abordagem.** 4 call sites verificados (`experience.tsx:1103`, `readiness-verdict.tsx:696,823`,
`readiness-scan.tsx:228`). Copiar o precedente comprometido de
`organic-growth/import/components/import-history.tsx:38-46`: `useLocale()` + `Intl.DateTimeFormat`
memoizado. **NÃO** usar `useFormatter` do next-intl: o app pina `timeZone:"UTC"` globalmente
(`i18n/request.ts`) — mostraria hora UTC (3h de erro para pt-BR); zero usos de useFormatter hoje
(verificado). Sem risco de hidratação (todos renderizam pós-load client-side).
**Aceite**: `grep toLocale` sob readiness = zero; com locale `en` e SO pt-BR, datas em formato inglês.
**Esforço S.**

## P4 — Lote de a11y

1. **Modelo de funil** (`funnel-model-step.tsx`): trocar `Box[role=radiogroup]`+`CardActionArea[role=radio]`
   (3 tab stops, setas mortas) por `RadioGroup` + `Card` + `FormControlLabel` + `Radio` **visível** —
   roving tabindex e setas grátis do browser, zero código de teclado custom (`control={<Radio/>}` é o
   shape aceito pelo product-lint). Delta visual: bolinha de rádio aparece — questão aberta.
2. **Toggle "Não sei o que é isso" ×25**: `aria-controls` condicional (o Collapse é unmountOnExit — só
   referenciar id existente) + `aria-label` por item ("Não sei o que é isso: {item}").
3. **AccordionSummary do finding**: `aria-label` computado "{posição}. {dimensão} — {estado}" (o nome
   atual é a concatenação do card inteiro).
4. **Chips de pendência**: `aria-label` com posição no plano + dimensão.
**i18n**: `dont-know-item`, `hide-explanation-item`, `finding-summary-aria`, `pending-chip-aria`.
**Aceite**: teclado opera o grupo como radio nativo; nomes acessíveis únicos; product-lint verde. **Esforço M.**

## P5 — LoadErrorState inline para falhas de leitura de créditos/concierge — depende de P2, P1, U8

**Abordagem.** `loadCredit` engole `!info.ok` (banner some, `outOfBalance` falso) e o early-return de
`loadAssist` esconde erros reais (o "catálogo ausente" verdadeiro chega como `ok:true, offering:null` —
comentário enganoso a apagar). Estados `creditLoadError`/`assistLoadError` + `LoadErrorState`
(componente existente, suporta `busy`) no stack de alertas, gated em `!dataLoadError` (uma falha total
mostra UM erro, não três). A cópia diz a consequência honesta E que a verificação continua disponível
(servidor re-checa — regra 6). `detail` técnico via `error-detail` do P2.
**i18n**: `credit-load-error-{title,body}`, `assist-load-error-{title,body}`.
**Aceite**: leitura falhando ⇒ erro inline com retry funcional; verify nunca desabilitado pela falha de
leitura. **Esforço S.**

---

# FASE 5 — Documentação

## S5 — PRODUCT.md atualizado — SEMPRE o último item mergeado

Quatro edições (frases completas prontas na spec W4):
1. Três parágrafos novos após o parágrafo de experimentos: **passo a passo sob demanda** (0031, cache por
   finding, honestidade com teto — passos vazios não cobram nem cacheiam); **concierge merecido** (0032 —
   promover o invariante "só após resistência real; nunca DIY/resolvido/já pedido/inaplicável; preço antes
   do clique; insert antes da cobrança com rollback; nunca pedimos senhas" de comentário de código a
   contrato de produto); **modelo de aquisição declarado** (0034 — brief gerado, nunca prompt do operador;
   trial-first ganha ativação + bloqueador trial→pago + dimensão `ativacao`; lead-first remove checkout).
2. Lista de dimensões: bullet **Ativação (somente trial-first)** + frase da oferta (S2) + frase do
   message match (S4).
3. Linha da fase 7 do roadmap: contagem de asserções escrita a partir de `npm run test:readiness` fresco
   (nunca copiada deste plano); status de migrações do dry-run real; enumerar 0028, 0029, 0031, 0032,
   0034 e 0037 (renomeada); frase da fase D.
4. Nada fora da seção de prontidão e da linha da fase 7.

**Aceite**: doc menciona 0031/0032/0034/0037; invariante do concierge presente; contagem de asserções
bate com a saída da suíte no mesmo commit. **Esforço S.**

---

# Decisões fechadas (aprovadas pelo dono do produto em 2026-07-29)

1. **Cooldown do scan (B4)**: 60s fixo, sem teto por org (guarda anti-abuso, não superfície de billing).
2. **Adoção do RPC atômico nos motores de campanha/plano criativo**: PR separado logo após o B1
   estabilizar em produção (~meio dia; o RPC já é scope-agnóstico).
3. **Rollback do `readiness_assists`**: RPC dedicado `record_assist_and_charge` (insert+cobrança
   atômicos); NENHUM direito de DELETE a usuários — a policy de 10min permitiria apagar linha paga sem
   estorno. Incorporado ao item B1.
4. **Cadências do R1**: aprovadas 7/14/30 dias, cap 60 (são fallbacks; o modelo propõe dentro de [1,60]).
5. **Notificações pt-BR hardcoded**: aceito (precedente da plataforma; mercado 100% BR). Débito técnico
   de plataforma registrado.
6. **PSI (V3)**: página lenta NÃO vira bloqueador determinístico (bloqueador deve ser computável para
   todos — chave é opcional); vira finding `critico` com evidência oficial. Mobile-only.
7. **Pixel via GTM (V1)**: caminho "prove você mesmo" como CONTEÚDO — artigo no Help Center
   (/admin/help) ensinando Test Events + Meta Pixel Helper, linkado ao item; `conversionEventTested` é
   a superfície de prova. Sem fluxo in-product neste ciclo. (Tarefa de conteúdo anexada à Fase 1/V1.)
8. **Histórico (R3)**: 5 visíveis bastam; delta fica só na tela de prontidão (home/workspace ficam
   próximo-passo). Reavaliar pós-ship.
9. **U1**: fetch do veredito antigo (como spec'd) — mostrar o veredito errado minaria o loop de
   experimentos.
10. **U2**: localStorage basta (posição de wizard é UX efêmera de dispositivo; o durável é o perfil).
11. **P4**: bolinha de rádio visível (semântica nativa, zero código de teclado custom).
12. **P2**: `detail` técnico inline como linha secundária discreta (o usuário tira print para o suporte).
13. **Org switcher global**: fora deste plano; abrir item próprio no backlog de plataforma.
14. **S2**: reusar `?focus=` do U3 apontando para a seção de oferta/economia; S2 ← U3.
15. **S6 (operacional)**: rodar antes do merge da Fase 0, via /admin/insights ou psql:
    `select slug, max_tokens from assistants where slug in ('readiness-engine','diagnosis-engine')` —
    esperado 8192 (a 0037 será aplicação real).

# Nota de verificação

As 6 specs de design foram produzidas por agentes com leitura direta do repositório. A rodada de
verificação adversarial automatizada falhou por limite de sessão; em compensação foram **verificados
manualmente** os fatos estruturais: pontos de recusa da UI com `observeItem === false`
(experience.tsx:500, readiness-checklist.tsx:157), cron sem `scope` (lib/diagnosis/jobs.ts:35-51),
`deriveMarker` sem suporte a UPDATE puro (scripts/apply-migrations.mjs:63-79 + SKIP em 124-126),
policies de `diagnoses` na `0012_diagnoses.sql` (insert/delete apenas), `0036` como migração mais alta e
o conflito de numeração 0037 (resolvido acima). Ao implementar cada item, re-conferir números de linha e
a pasta de migrações antes de criar arquivos.
