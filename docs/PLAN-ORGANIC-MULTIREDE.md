# Plano de Implementação — Organic Growth multi-rede

> Gerado em 2026-07-31 a partir de auditoria do código existente. **Não é um módulo novo**: o
> Organic Growth já existe (`docs/PRODUCT.md` §Organic Growth, `packages/organic-growth`,
> migração `0024_organic_growth.sql`, rotas `/organic-growth`). Este plano leva o módulo do
> Concierge (uma conta declarada, CSV padronizado, Review sob demanda) para **cinco redes com
> dados reais e orientação contínua de próximo passo**.
>
> **Decisões tomadas (2026-07-31):**
> 1. **Fase A primeiro** — as 5 redes via export nativo, sem depender de aprovação de API.
> 2. **X/Twitter é cidadão de primeira classe no domínio, mas só por export** — entra no enum,
>    na taxonomia e no motor; nenhum conector previsto (API paga, analytics de post pobre).
> 3. **A orientação vive fundida ao Creative Test Plan**, não num objeto novo — o plano começa
>    sem dados (hipóteses do contexto) e passa a ser reordenado pela evidência orgânica.
>
> Convenções obrigatórias (violar = PR rejeitado):
> 1. Toda string visível via next-intl, nos **5 catálogos** (`de,en,es,fr,pt-BR`), namespace
>    `organicGrowth` (ou `creatives` quando a superfície for do plano).
> 2. `packages/organic-growth` é **domínio puro**: zero I/O, zero Supabase, zero provider. Toda
>    persistência fica em `apps/web/src/app/(dashboard)/organic-growth/actions.ts`.
> 3. Migração precisa de **marcador derivável** por `scripts/apply-migrations.mjs`
>    (table/function/bucket/column) — enum via `check constraint` não é marcador; embrulhar em função.
> 4. Invariante do espectro de maturidade: valor nunca bloqueado por conexão. Export manual é
>    caminho de primeira classe, permanente — não uma etapa de transição.
> 5. `insufficient_data` / `missing_data` continuam sendo respostas válidas. Ausência de métrica
>    nunca vira zero; **e agora precisa distinguir ausência de inexistência** (ver A2).
> 6. `recordAudit` em toda mutação; importações permanecem idempotentes por `idempotency_key`.

## Estado atual verificado (2026-07-31)

| Camada | Situação |
|---|---|
| Contrato de produto | `docs/PRODUCT.md:193-351` — invariantes, schema superset, roadmap 0–6 |
| Motor de domínio | `packages/organic-growth/src/analysis.ts` (926 linhas) — coortes, percentis, Content Intent, Paid Repurpose, cobertura de funil, suficiência |
| Parser | `packages/organic-growth/src/csv.ts` (594 linhas) — **exige** o cabeçalho canônico do Seenaly |
| Schema | `0024_organic_growth.sql` — 13 tabelas, RLS, enum de plataforma com 4 redes |
| App | `/organic-growth` (setup, import, content, reviews, strategy) — ~3.500 linhas, classificação por IA, feedback, ponte para experimentos |
| Creative Test Plan | `0033_creative_plan.sql` + `lib/creative-plan/*` — hipóteses falsificáveis, materialização em `creatives`, `content_count ≥ MINIMUM_ORGANIC_COHORT_SIZE` |

## As quatro descobertas que definem o desenho

**1. O laço orgânico ↔ criativo já está no schema.** `organic_content_items.creative_id` existe e a
check `organic_content_items_csv_creative_check` **obriga** todo conteúdo importado por CSV a estar
ligado a um criativo. `creative_plan_links` liga hipótese → criativo. `library/plan-signals.tsx` já
conta `published` / `readable` / `awaitingImport` usando o mínimo de coorte. A fusão escolhida não
precisa de arquitetura nova — precisa **fechar o laço** (descoberta 4).

**2. Cinco redes quebram a matemática de coorte do plano — este é o risco central.**
`selectComparableCohort` exige `plataforma + conta + formato` iguais e mínimo de 5 comparáveis.
Uma hipótese com `content_count: 5` publicada "nas redes" vira **cinco coortes de tamanho 1 = zero
leituras**. Hoje o plano não tem onde declarar isso porque o mundo dele é implicitamente
mononetwork. Sem corrigir, a Fase A torna o Creative Test Plan *menos* confiável, não mais.

**3. Falta a matriz de capacidade por plataforma.** `exposureMetrics` (`analysis.ts:26-31`) é uma
lista global: `reach, impressions, views, plays`. Com 5 redes isso colapsa três estados distintos
num só "faltando": métrica **inexistente na rede** (LinkedIn não tem salvamentos), métrica
**existente e não importada** (lacuna real → orientação de coleta), métrica **existente e zero**
(resultado). Sem a matriz, `missing_data` passa a pedir dados que não existem — e o produto perde
credibilidade exatamente onde ele se diferencia.

**4. O laço não fecha: nenhuma hipótese tem veredito.** O plano é gerado do contexto do produto
(pré-dados) e o Review é gerado dos dados (pós-dados), mas nada devolve ao plano *o que aconteceu
com cada hipótese*. É essa peça — e não uma tela nova — que responde "qual o próximo melhor caminho".

## Fases

| Fase | Tema | Esforço |
|---|---|---|
| A | Cinco redes por export: enum, matriz de capacidade, motor, importador multi-dialeto | ~4–6 dias-dev |
| B | Fusão com o Creative Test Plan: rede de teste, veredito por hipótese, reordenação por evidência | ~4–5 dias-dev |
| C | Conectores OAuth (YouTube → Instagram → TikTok) | fora do escopo deste plano |

Dependências: A2←A1; A3←A2; A4←A2; B1←A2; B2←A3,A4; B3←B2; B4←A3,B2.

---

# FASE A — Cinco redes por export

## A1 — X/Twitter no domínio

**Abordagem.** Superfície fechada e pequena (13 arquivos identificados). `twitter` é o slug
canônico interno (estável, sem rebrand); o rótulo visível é "X" via i18n.

- `packages/organic-growth/src/types.ts:1` — `SocialPlatform` ganha `"twitter"`.
- `packages/organic-growth/src/taxonomy.ts:5-10` — `SOCIAL_PLATFORMS`.
- **`packages/db/migrations/0041_organic_twitter.sql`** — recriar as três check constraints
  (`social_accounts_platform_check`, `organic_content_items_platform_check`,
  `organic_reviews_platform_check`). ⚠️ `alter constraint` não é marcador derivável: embrulhar as
  três num `create function public.apply_organic_twitter()` e chamá-la, no padrão da
  `0030_welcome_credits_backfill.sql`.
- `packages/db/src/schema/organic-growth.ts:97,227,445` — espelhar as checks.
- `apps/web/src/app/(dashboard)/organic-growth/types.ts`, `setup/components/setup-form.tsx`,
  `import/page.tsx`, `import/components/csv-import-form.tsx` — opções de plataforma.
- 5 catálogos i18n: rótulo + nome do formato próprio da rede.

**Aceite.** Setup permite escolher X, import aceita conteúdo de X, Review de X é gerado, nenhuma
constraint rejeita a escrita.

## A2 — Matriz de capacidade por plataforma (peça nova, base de tudo)

**Abordagem.** Novo módulo puro `packages/organic-growth/src/platforms.ts`, exportado pelo índice.
Estrutura declarativa por rede:

- `exposureMetrics`: ordem de preferência do denominador **naquela rede** (YouTube: `views`;
  Instagram: `reach → impressions → plays`; X: `impressions`).
- `supported`: quais métricas de `OrganicContentMetrics` a rede expõe de fato.
- `formats`: formatos canônicos da rede (reels/carrossel/estático/story · vídeo/short · post/artigo/newsletter · post/thread).
- `notes`: definição da métrica quando ela difere entre redes (view de 30s vs play de 1s) — texto
  citável na evidência, não decorativo.

Três predicados derivados substituem o teste booleano de hoje:
`isSupported(platform, metric)` · `isMissing(platform, metric, content)` · `exposureFor(platform, content)`.

**Aceite.** Teste de unidade cobrindo as 5 redes: métrica não suportada nunca aparece em
`missing`; métrica suportada e ausente sempre aparece; denominador escolhido respeita a ordem da rede.

## A3 — O motor respeita a matriz

**Abordagem.** Cirurgia localizada em `analysis.ts`, sem mexer nas regras de coorte:

- `targetExposureMetric` (linha 187) passa a receber a plataforma e usar `exposureFor`.
- `metricSignal` (linha 277) pula sinais não suportados **sem penalizar** — a métrica sai do
  `availableWeight`, exatamente como já acontece com sinal ausente, mas **não entra em `missing`**.
- `assessOrganicDataQuality` (linha 555): `performanceMetricCoverage` passa a ser medida contra o
  que a rede *pode* dar, não contra a lista global. Hoje uma conta de LinkedIn completa seria
  julgada incompleta.
- `assessOrganicSufficiency` (linha 608): as frases de `missingData` deixam de pedir o impossível.

⚠️ Isto muda scores de Reviews já gravados. Como `organic_reviews` persiste `score_version`,
gravar a versão nova e **nunca recalcular retroativamente** — Reviews antigos permanecem como
foram lidos no dia.

**Aceite.** Suíte atual (`packages/organic-growth/test/`) verde + casos novos por rede.

## A4 — Importador multi-dialeto (o maior ganho de UX por esforço)

**Problema.** `parseConciergeCsv` (`csv.ts:270`) exige o cabeçalho canônico e trata desconhecido
como warning ignorado. Na prática isso obriga o usuário a reformatar à mão o export do YouTube
Studio — que é justamente o atrito que mata a coleta e, com ela, todo o módulo.

**Abordagem.** Pré-passo puro `packages/organic-growth/src/dialects.ts`, **antes** do parser atual:

1. `detectDialect(headers)` → `{ dialect, platform, mapping, confidence }`, casando assinaturas de
   cabeçalho conhecidas (Meta Business Suite / IG, TikTok Studio, YouTube Studio, LinkedIn, X
   Analytics) + o dialeto `seenaly` canônico.
2. `applyDialect(headers, mapping)` renomeia para o vocabulário canônico; o parser existente segue
   intocado a partir daí (decisão deliberada: toda a validação por linha, dedupe e limite de 500
   continuam num lugar só).
3. Cabeçalho não reconhecido **não é erro**: cai em `mapping: {}` e a UI pede o mapeamento manual.

**Ancoragem obrigatória.** Cada assinatura precisa ser conferida contra um export real antes do
merge — cabeçalhos de export mudam e variam por idioma da conta. Guardar os arquivos de amostra em
`packages/organic-growth/test/fixtures/` como contrato executável. **Bloqueador: preciso de um
export real de cada rede** (pode ser anonimizado, mas com o cabeçalho intacto).

**Aceite.** Um export bruto de cada rede importa sem edição manual; o dialeto detectado e as
colunas ignoradas ficam visíveis antes de confirmar.

## A5 — UI de importação com mapeamento confirmável

**Abordagem.** `import/components/csv-import-form.tsx` ganha um passo intermediário: arquivo →
**detectamos X, mapeamos assim, N colunas ignoradas** → confirmar. Colunas não mapeadas viram
`<Select>` contra os campos canônicos. Plataforma é sugerida pelo dialeto e permanece editável.

Regras da camada de produto: `EmptyState` para zero importações; erros por linha inline (já existe);
o wait de parse é sub-segundo — **sem `ProcessingOverlay`**.

**Aceite.** Fluxo caminhável com export real; mapeamento errado é corrigível antes de gravar;
nada é gravado até a confirmação.

---

# FASE B — Fusão com o Creative Test Plan

> A fusão escolhida: o plano continua sendo **um só objeto** (`diagnoses`, `scope='creative_plan'`),
> que nasce do contexto do produto e **passa a ser reordenado pela evidência orgânica**. Nada de
> tela nova, nada de "plano de conteúdo" paralelo.

## B1 — Rede de teste por hipótese (corrige a matemática de coorte)

**Abordagem.** `CreativePlanHypothesis` (`lib/creative-plan/schema.ts:26`) ganha `test_network`
(slug de rede) e `content_count` passa a significar explicitamente **peças naquela rede**.

- JSON Schema: `test_network` obrigatório, enum = `SOCIAL_PLATFORMS`; `sanitizeCreativePlan`
  aplica fallback para a rede com mais conteúdo importado do produto (ou `instagram` quando não há
  nenhum) — saída de modelo nunca é confiada.
- `volume_note` passa a declarar a conta por rede, não no agregado.
- O brief (`lib/creative-plan/brief.ts`) já carrega `PlanOrganicPresence.platforms`: instruir o
  motor a escolher a rede de teste **onde o produto já publica**, com a regra explícita de que
  dispersar a mesma hipótese entre redes impede qualquer leitura.
- Compatibilidade: planos já gravados não têm o campo — `test_network` ausente lê como "rede não
  declarada" na UI, nunca como erro.

**Aceite.** Plano novo sempre declara rede por hipótese; a soma por rede/formato alcança o mínimo
de coorte; plano antigo continua renderizando.

## B2 — Veredito por hipótese (a peça que fecha o laço)

**Abordagem.** Função pura nova em `packages/organic-growth` —
`readHypothesisCohort(hypothesis, contents, options)` — e leitura no app a partir de
`creative_plan_links` → `creatives` → `organic_content_items` → `organic_content_metric_snapshots`.

Estados possíveis, sem meio-termo inventado:

| Estado | Condição |
|---|---|
| `nao_materializada` | sem criativo ligado à hipótese |
| `nao_publicada` | criativo existe, nenhuma publicação orgânica |
| `coletando` | publicada, coorte abaixo do mínimo → **falta N peças** (número exato) |
| `legivel_sem_sinal` | coorte completa, percentis abaixo do critério declarado |
| `legivel_com_sinal` | coorte completa, critério de sucesso atendido |
| `metricas_pendentes` | publicada e sem snapshot importado → **falta importar** |

O veredito é **derivado, nunca gravado como estado editável** — é recalculado a cada leitura a
partir dos dados, no mesmo espírito de `plan-signals.tsx` (nada asseverado pelo usuário).

**Aceite.** Cada hipótese do plano ativo exibe seu estado e o próximo passo literal; a suíte cobre
os seis estados; nenhum estado depende de o usuário marcar algo como feito.

## B3 — O plano se reordena com a evidência

**Abordagem.** `planCreativesBlock` / brief do plano passam a carregar os vereditos de B2 quando
se gera um plano novo. A instrução ao motor: **não repetir hipótese já refutada, aprofundar a que
teve sinal, e declarar o que aprendeu**. O `transfer_caveat` continua obrigatório — sinal orgânico
ordena hipótese paga, nunca prevê resultado pago.

**Aceite.** Com hipóteses refutadas no histórico, o plano seguinte cita-as na `evidence` e não as
reapresenta. Sem histórico, o comportamento atual é preservado byte a byte.

## B4 — Alocação de esforço entre redes (o "próximo melhor caminho")

**Abordagem.** Bloco no plano, alimentado por função pura
`compareNetworks(contentsByPlatform, options)`. **A regra que não pode ser violada: comparar
percentis intra-rede, jamais valores brutos entre redes.** Cada rede é julgada contra o histórico
da própria conta naquela rede; só as *posições relativas* se comparam.

Saída por rede: cobertura de funil, percentil mediano de intenção comercial, gargalo declarado
(etapa ausente vs sinal fraco vs volume insuficiente para ler) — e `insufficient_data` por rede,
independente das outras. Uma rede sem coorte legível diz isso e sai da comparação; não vira zero.

Copy de referência (o padrão de honestidade esperado):

> No TikTok seus conteúdos de prova estão no p80 do seu próprio histórico; no Instagram, no p30
> com o mesmo tipo narrativo. O gargalo do Instagram não é alcance — é que prova quase não existe
> lá (2 de 40 conteúdos).

**Aceite.** Nenhuma frase compara número absoluto entre redes; rede sem dados suficientes é
declarada, não estimada.

---

# FASE C — Conectores (registrado, fora do escopo)

Ordem por viabilidade real, **não** pela ordem do roadmap atual em `docs/PRODUCT.md:322-324`:

1. **YouTube** — Data API + Analytics API, OAuth Google, sem aprovação especial. O mais rico
   (retenção, CTR de thumbnail, fontes de tráfego).
2. **Instagram** — Graph API, conta profissional; reaproveita a família OAuth do conector Meta Ads
   que já existe em `apps/web/src/lib/meta-ads/connector.ts`.
3. **TikTok** — Display API, exige app aprovado; métricas por vídeo limitadas.
4. **LinkedIn e X** — permanecem em export. Depois da Fase A isso deixa de ser dívida.

Quando chegar a hora: `packages/connectors` + registro em `apps/web/src/lib/connectors.ts`;
`social_accounts.connection_id` já existe para o vínculo.

# O que este plano NÃO constrói

Agendamento, publicação, inbox, resposta automática, edição de mídia, social listening, scraping,
atribuição causal de vendas e ranking bruto entre redes. É o que separa o Seenaly de um
Metricool/Buffer — e o que sustenta o preço de uma ferramenta de decisão.

# Riscos e decisões abertas

1. **Bloqueador da A4**: as assinaturas de cabeçalho precisam de exports reais de IG, TikTok,
   YouTube, LinkedIn e X. Sem eles a detecção é chute e quebra no primeiro arquivo do usuário.
2. **Cabeçalho por idioma**: exports saem no idioma da conta. Decisão sugerida — casar por
   assinatura em pt-BR e en primeiro, e sempre degradar para mapeamento manual.
3. **Limite de 500 conteúdos por Review** (`analysis.ts:823`): com 5 redes e histórico longo, esse
   teto será atingido. Reavaliar depois da Fase A com dados reais de uso.
4. **Custo de classificação por IA**: importar 5 redes de uma vez multiplica as chamadas de
   `classifyOrganicContent`. Verificar débito de créditos e considerar classificação em lote.
