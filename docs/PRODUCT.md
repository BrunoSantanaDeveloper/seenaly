# Seenaly — Definição de produto

> **AI Growth Copilot / Plataforma de Inteligência de Aquisição para negócios que vendem com tráfego pago.**
> Internamente: **Decision Intelligence aplicada a Meta Ads, criativos e funis de venda.**

Comunicação com usuários: *"Seu copiloto de growth para transformar dados de tráfego pago em decisões, criativos e próximos testes."*

## A pergunta que o produto responde

Um Ads Manager responde "onde eu configuro, publico e gerencio campanhas?". O Seenaly responde:

> "Considerando este produto, esta oferta, este funil, estes criativos, estes dados de campanha e este histórico de testes, qual é o diagnóstico e o próximo experimento mais inteligente?"

O sistema **analisa, diagnostica e sugere** — não opera as campanhas pelo usuário. Ações semi-automatizadas só entram em pauta depois que a camada de decisão estiver madura. Não competimos com a automação da Meta (Advantage+): ajudamos o usuário a alimentá-la melhor com criativos, estrutura, dados e decisões.

### O que o Seenaly NÃO é

Ads Manager · automação de tráfego pago · dashboard de marketing · ferramenta de criativos com IA · ferramenta de atribuição · CRM/CDP. Ele toca essas áreas, mas a categoria é definida pelo problema central: **melhorar a qualidade da decisão**.

## Princípios de produto

1. **O coração não é a IA — é o modelo de contexto do produto.** Antes de analisar qualquer campanha, o sistema precisa saber: produto, preço, margem, CAC máximo aceitável, ticket médio, LTV, tipo de conversão desejada, etapa do funil, público-alvo, promessa principal, objeções, provas disponíveis, criativos já testados e seus resultados, página usada e sua taxa de conversão, evento de otimização, orçamento, tempo e estágio da campanha. Sem isso, qualquer resposta é genérica.
2. **Lei interna: nada genérico.** Toda recomendação deve estar vinculada a pelo menos um dado da campanha, uma informação do produto ou uma regra/documentação da plataforma. "Teste novos criativos com ângulos diferentes" é resposta proibida.
3. **Níveis de confiança do conhecimento.** Nível 1: documentação oficial da Meta. Nível 2: dados reais das campanhas. Nível 3: dados reais de vendas/funil. Nível 4: playbooks internos validados. Nível 5: cursos, opiniões e benchmarks externos. Decisões priorizam níveis 1–3; cursos são repertório, não verdade. (Mapeia 1:1 nos `trust_level` de `packages/knowledge`.)
4. **Saber quando não dá para concluir.** Volume insuficiente de eventos, fase de aprendizado, breakdowns incompatíveis da Insights API: o sistema declara a limitação em vez de inventar conclusão.
5. **Formato fixo de toda recomendação** (via saída estruturada, JSON Schema):
   - **Diagnóstico** — o que está acontecendo
   - **Evidências** — quais dados sustentam
   - **Base técnica** — regra/documentação aplicável
   - **Hipótese** — por que isso pode estar acontecendo
   - **Ação recomendada** — o que fazer agora
   - **Risco** — o que pode dar errado
   - **Confiança** — baixa / média / alta
   - **Critério de sucesso** — como saber se funcionou
   - **Próxima leitura** — quando reavaliar
6. **Espectro de maturidade — o valor nunca fica atrás da conexão Meta.** O sistema serve desde o iniciante sem nenhuma campanha (nem conta Meta) até a empresa com histórico rico, degradando graciosamente. É a forma extrema do princípio nº 4:
   - **Zero dados**: guia do passo 0 usando **contexto do produto + conhecimento**. O artefato concreto é o **Diagnóstico de Prontidão** (a estrutura está pronta para converter tráfego pago? — oferta, página, checkout, mensuração, funil, descoberta orgânica), além de que evento otimizar, como estruturar a 1ª campanha e que criativo/oferta testar primeiro. Nenhum dado de campanha necessário.
   - **Campanha nova (conta conectada)**: "ainda não há base para concluir" — fase de aprendizado, volume mínimo.
   - **Histórico rico**: diagnóstico completo com evidências, rankings de relevância, fadiga, memória de experimentos.

   Consequência de arquitetura: o **contexto do produto (o coração) é o passo 0 e independe de dados**; a conexão Meta é enriquecimento opcional, não pré-requisito. O motor de diagnóstico recebe o que existir (contexto sempre; conhecimento sempre; dados Meta se houver) e nunca exige a conexão.

## Os cinco pilares + memória

1. **Base de conhecimento Meta Ads** (nível 1): documentação oficial, políticas, cursos Blueprint, glossário, regras de aprendizado, pixel/CAPI, Advantage+, diagnósticos de relevância, limitações da API. O corpus vive em `docs/meta_ads/` (pipeline próprio em `docs/meta_ads/_tools/`) e é ingerido na coleção global `meta-ads-docs` da knowledge base (`scripts/ingest-knowledge.mts`). Para o conhecimento **fora da Meta** (CRO, checkout, oferta, funil) existe o corpus autoral `docs/growth/` → coleção `growth-playbook`, sintetizado com atribuição de fontes e trust por documento (modelo editorial em `docs/growth/README.md`).
2. **Camada de dados das campanhas**: sync via Marketing/Ads Insights API por campanha/conjunto/anúncio/criativo/período/posicionamento — gasto, impressões, alcance, frequência, CPM, CTR, CPC, conversões, CPA, valor, ROAS, eventos de pixel/CAPI. Respeitando restrições de compatibilidade entre métricas e breakdowns.
3. **Camada de funil e vendas reais** (o que a Meta não vê): visitas, taxa de conversão da página, checkout iniciado, compra, Pix/boleto pendente, reembolso, upsell, receita líquida, margem, origem real da venda.
4. **Biblioteca de criativos etiquetada**: cada criativo com ângulo, promessa, dor, desejo, objeção, formato, gancho, CTA, estilo visual, duração, primeira cena, tipo de prova, emoção, público presumido, etapa do funil e resultado. O objetivo é saber **por que** um criativo performou, não só qual performou.
5. **Motor de diagnóstico** (o módulo mais valioso): o problema está no criativo ou na oferta? Antes ou depois do clique? Há dados suficientes? Fadiga? CPA alto por CPC caro ou por baixa conversão? Fase de aprendizado? Evento de otimização adequado? Cruza diagnósticos de relevância da Meta com dados do funil.

**Diferencial máximo — memória de experimentos**: todo teste registrado como hipótese → mudança → motivo → período → orçamento → criativos → métricas → resultado → conclusão → próximo passo. Com o tempo a IA deixa de ser só "especialista em Meta Ads" e vira especialista **nos produtos, criativos, públicos e ofertas do cliente**.

## Prontidão antes do tráfego pago — a estrutura é o CAC mais barato

Um iniciante não descobre se vai vender ligando a Meta; descobre se a **estrutura que recebe o tráfego** converte. Tráfego pago barato não vem de clique barato — vem de estrutura que converte: como `CPA = CPC ÷ taxa de conversão pós-clique`, cada ponto de conversão, cada atrito removido no checkout e cada evento de otimização bem instalado derrubam o custo por resultado e encurtam a fase de aprendizado do algoritmo. A pior experiência possível — a que este produto existe para evitar — é queimar orçamento de mídia para **descobrir** uma falha estrutural que o sistema poderia ter apontado de graça, antes do primeiro real gasto.

Por isso o **Diagnóstico de Prontidão** é a porta de entrada da jornada, **antes** da conexão Meta e antes do diagnóstico de campanha. Ele é o próprio motor de diagnóstico apontado para a **estrutura**, não para os dados de mídia: roda com contexto do produto + conhecimento (é a forma concreta do "zero dados" do princípio nº 6), na mesma saída estruturada e com a mesma honestidade (`insufficient_data` / `missing_data`). Não opera nada e não promete ranquear — audita e recomenda **o que consertar, em ordem de alavancagem, antes de gastar**.

Dimensões auditadas (aterradas no `growth-playbook` trust 2–4 e nas docs oficiais trust 1 — nunca genérico):

- **Oferta e preço** — clareza da promessa, equação de valor, garantia, ancoragem, ticket vs. teto do público frio (reusa o modelo de cobrança já capturado no cadastro).
- **Página e message match** — existe página; a promessa da página bate com a do anúncio; prova, estrutura, CTA.
- **Checkout** — fricção, número de etapas, meios de pagamento BR (PIX; parcelamento é percepção, não economia).
- **Mensuração** — pixel/CAPI instalados e evento de otimização definido; **sem sinal, o algoritmo não aprende e o tráfego fica caro** — é o item de maior alavancagem e custo zero.
- **Funil** — as etapas existem e estão conectadas; vazamentos estruturais conhecidos.
- **Descoberta (orgânico + busca)** — o produto é encontrável: fundamentos técnicos de SEO (title, meta, canonical, OG, sitemap, dados estruturados, Core Web Vitals) e presença mínima nas redes/Google. Aqui o módulo **Organic Growth** entra como **pré-condição da aquisição paga**, não como app à parte; métricas de redes diferentes nunca são ranqueadas como equivalentes.
- **Prontidão de mídia** — criativos mínimos por ângulo e a estrutura da 1ª campanha.

O resultado é um **veredito explicável** (checklist e sinais relativos antes de qualquer score proprietário, conforme o invariante de scores do Organic Growth): "pronto para tráfego pago" ou "conserte X, Y, Z antes", cada item com esforço, impacto e a base técnica citada.

**Maturidade, como em todo o resto:**

- **Declarado (padrão, sem scan)** — o veredito sai do contexto do produto e de um intake estrutural leve; nada é pré-requisito além do produto.
- **Enriquecido (scan opcional)** — um scanner técnico da URL (title/meta/OG/canonical/sitemap/robots/dados estruturados, presença de pixel no HTML, peso e tempo de resposta) vira **evidência observada**; é enriquecimento no mesmo padrão do conector Meta — valor nunca fica atrás do scan. O scan **não escreve no checklist**: onde declarado e observado divergem, a divergência é o achado mais valioso do veredito. Três limites são declarados ao motor e ao usuário, porque cada um viraria achado falso se escondido: página renderizada no cliente esconde tags de um fetch de HTML; **CAPI é server-side e invisível a qualquer scan**; a leitura do robots.txt é aproximada. O tempo medido é da nossa requisição, não Core Web Vitals — a API oficial de performance fica para depois.

**O laço se fecha nos experimentos.** Cada achado do veredito vira, sob demanda, um experimento rastreado no journal existente — por **achado**, não por veredito, porque um veredito carrega até sete correções independentes e juntá-las destruiria justamente o aprendizado que a memória existe para guardar. A idempotência usa `(diagnosis_id, change_made)`: a ação recomendada já identifica o achado, então clicar duas vezes reaproveita o experimento. Como todo experimento concluído volta ao briefing, uma correção estrutural feita hoje deixa de ser re-recomendada amanhã.

**Presença orgânica entra como contexto da descoberta.** O motor recebe o conteúdo orgânico realmente vinculado ao produto (quantidade, plataformas, publicação mais recente) e se existe um Organic Growth Review — é assim que o módulo deixa de ser um app à parte e vira, na prática, pré-condição da aquisição paga. Dois invariantes do módulo valem aqui sem exceção: **métricas de redes diferentes nunca são ranqueadas como equivalentes** e presença **nunca** é atribuição (não se afirma que um conteúdo gerou venda). Ausência de conteúdo importado é dado ausente, não prova de que o negócio não publica.

Invariante reforçado: a Prontidão **não é um portão** que trava a conta. É a recomendação de fazer primeiro o que é barato e decisivo. O usuário pode ignorá-la e ir direto ao tráfego pago — mas terá sido avisado, com evidência, de onde o dinheiro vazaria.

## Recorte inicial

**Copiloto especialista em Meta Ads para produtos digitais e ofertas self-service.** Não competir de frente com Madgicx/Smartly/Motion. Foco: leitura da conta Meta Ads, cadastro profundo do produto/oferta, análise de criativos, diagnóstico de gargalo, recomendação com evidências, geração de experimentos, memória do que foi testado, base de conhecimento oficial, saída sempre contextual.

Recorte de funil no lançamento: **páginas e checkout próprios** (desenvolvimento proprietário do cliente), não plataformas de infoproduto. Plataformas como Hotmart/Kiwify/Eduzz entram depois — há público que depende delas — e o corpus `docs/growth/` já reserva o espaço (cards de trust 1 a partir da documentação oficial de cada plataforma quando chegar a hora).

> **Meta Ads é a porta de entrada, não a fronteira do diagnóstico.** A recomendação nunca se limita a operar o Gerenciador de Anúncios. O motor localiza o gargalo **antes do clique** (criativo, gancho, público, promessa do anúncio) ou **depois do clique** (página, oferta, preço, checkout) — usando a decomposição `CPA = CPC ÷ taxa de conversão pós-clique` — e recomenda a mudança onde ela de fato está: na oferta, na página, no checkout, no criativo ou na campanha. Quando o gargalo está fora da plataforma, o motor diz isso com todas as letras, ancora a evidência em `product_context` e **não força** uma regra da documentação da Meta que não se aplica (`technical_basis` fica vazio). O que ele *não enxerga* hoje (visitas, checkout iniciado, reembolso, abandono) ele **pede** via `missing_data` em vez de supor — esses dados chegam na Fase 6.

### Mercado (benchmarks, não concorrentes diretos)

| Área | Ferramentas próximas |
|---|---|
| Gestão/otimização de Meta Ads com IA | Madgicx, Good Morning |
| Enterprise creative + media | Smartly.io |
| Creative analytics | Motion, Segwise, Foreplay |
| Atribuição e dados de negócio | Triple Whale, Northbeam, Wicked Reports |
| Automação por regras | Birch/Revealbot |

O espaço é fragmentado; nenhuma entrega a combinação: conhecimento técnico da plataforma + dados reais da campanha + contexto do produto + histórico de experimentos + regras de decisão. A visão é a junção de *Madgicx + Motion + Triple Whale + base de conhecimento + memória de experimentos + contexto proprietário do produto*.

## Roadmap por fases

As fases **não** são um funil sequencial onde tudo espera a conexão Meta. O contexto do produto (2) e o motor de diagnóstico (3) entregam valor a um iniciante sem nenhum dado; a conexão Meta (1) enriquece quando existe (ver princípio nº 6). O conector foi construído cedo por causa do app review da Meta (semanas), não porque o resto depende dele.

| Fase | Entrega | Status |
|---|---|---|
| 0 | Base de conhecimento: corpus `docs/meta_ads/` + ingestão em `meta-ads-docs` (trust 1) | **concluída** — 108 documentos / 424 chunks ingeridos; busca semântica verificada (`gemini-embedding-001`, 768 dims) |
| 1 | Conector Meta Ads: schema `meta_*` (`0009`), cliente Graph API, sync incremental + cron, gate de assinatura. **Opcional para o usuário** (enriquecimento, não portão) | núcleo implementado (trilha A: system-user token); falta validar com token real, OAuth/app review (trilha B) e tela de conferência |
| 2 | **Modelo de contexto do produto** (o coração; independe de dados): schema de produto/oferta/economia/funil + UI de cadastro guiado (`SetupWizard`) | schema + UI prontos |
| 2.5 | **Home do Seenaly** (`/home`, o `appRoot` pós-login): tela goal-first que responde "o que faço agora?" — checklist de ativação, saúde do contexto do produto, estado dos dados da Meta e o destino (diagnóstico). Substitui o dashboard demo do template como landing | em andamento |
| 3 | Motor de diagnóstico: assistente grounded que **degrada graciosamente** (contexto sempre; conhecimento sempre; dados Meta se houver) com `generateStructured` no formato fixo — primeiro produto vendável, já para quem tem zero campanhas | **implementado** (Gemini `gemini-2.5-flash`, nível de produto, 5 créditos); migration `0012` pendente de aplicação |
| 4 | Biblioteca de criativos etiquetada + análise de padrões vencedores (reusa `meta_creatives`; iniciante pode cadastrar criativos planejados) | **biblioteca implementada** (migration `0013`, UI `/creatives` agrupada por etapa do teste, taxonomia **slug-canônica** gancho/ângulo/prova, integrada ao briefing do diagnóstico). O briefing profundo (2026-07-19) já **liga o anúncio Meta ao criativo etiquetado** (`connection_id`+`meta_creative_id`) e leva suas tags para o motor; a análise agregada tag×performance ainda depende de dados Meta reais |
| 5 | Memória de experimentos (iniciante registra o 1º teste planejado) | **implementada** (migration `0014`, UI `/experiments` journal por status, "registrar diagnóstico como experimento", experimentos concluídos injetados no briefing do motor — loop de aprendizado verificado: não re-testa o refutado) |
| 6 | Camada de funil/vendas reais | **implementada** (migration `0015`, snapshots manuais por produto/período, UI `/funnel` com breakdown por estágio, injetada no briefing do motor — verificado que discrimina página × checkout × oferta pelas taxas). Integrações de plataforma (Hotmart/Kiwify/webhooks) ficam como enriquecimento futuro na mesma tabela |
| 7 | **Camada de Prontidão (pré-tráfego)**: modo "prontidão" do motor (mesma engine + formato fixo, grounding no `growth-playbook`), intake estrutural leve reusando o contexto do produto, veredito explicável na Home / pós-cadastro; scanner técnico da URL como enriquecimento opcional (fase B) | **fase A implementada** (2026-07-21) — migration `0028` (tabela `product_readiness` + `diagnoses.scope = 'readiness'` + assistente `readiness-engine`), UI `/readiness` (checklist declarado → veredito priorizado por alavancagem, com esforço × impacto e critério de sucesso por achado), **bloqueadores determinísticos calculados localmente** (grátis, sem LLM, visíveis enquanto o usuário marca) e sequenciamento da jornada (prontidão antes do diagnóstico no card pós-cadastro e no checklist de ativação). É **zero-data** e reusa motor + `growth-playbook` + modelo de cobrança — nenhum domínio novo. **Fase B também implementada** (2026-07-21): migration `0029` (`product_scans`, série temporal — scans que falharam são preservados, pois "sua página não respondeu" é um achado), `lib/readiness/scan.ts` (fetch com **guarda SSRF**: só http/https, só portas padrão, resolução DNS com rejeição de loopback/privado/link-local/CGNAT/IPv4-mapped, redirecionamentos seguidos manualmente e revalidados a cada salto, timeout e teto de bytes) + `scan-analyze.ts` puro, bloco de scan no briefing e card `/readiness` que exibe observado ao lado de declarado. Suíte `npm run test:readiness` (72 asserções) cobre avaliador, guarda SSRF e analisador. **Fase C também implementada**: laço fechado (achado → experimento rastreado, por achado, idempotente por `(diagnosis_id, change_made)` — sem migration nova) e presença orgânica real no briefing (conteúdos vinculados + Review), como contexto da descoberta e nunca como atribuição. **Migrations `0028`–`0029` pendentes de aplicação** (`0027` já aplicada); Core Web Vitals via API oficial fica para depois |

### Mapa produto → infraestrutura do template

- Base de conhecimento em níveis de confiança → `packages/knowledge` (pgvector + Gemini embeddings, trust levels 1–5)
- Integração Meta Ads → `packages/connectors` (+ tabelas novas em `packages/db`) com sync via `packages/jobs` (Inngest)
- Assistente e formato fixo → `packages/ai` (`generateStructured` com JSON Schema; grounding via `config.knowledge`)
- Monetização por uso → `packages/billing` (créditos por mensagem)

### Estudos futuros (parking lot)

- **Handoff para o MCP de anúncios da Meta** (`docs/ideas/meta-ads-mcp-agent-handoff.md`): a Meta lançou um
  servidor MCP oficial (`https://mcp.facebook.com/ads`) que o **usuário** conecta no cliente de IA dele
  (Claude/ChatGPT/Perplexity) para operar a própria conta. **Decidido: NÃO usar como camada de conexão do
  Seenaly** (auth per-usuário, capacidade de escrita que conflita com "analisa, não opera", sem sync histórico,
  e trancaria o valor atrás do OAuth — contra o invariante de maturidade). Fica registrado como possível
  enriquecimento *opcional* futuro — "Seenaly é o cérebro, o agente do usuário são as mãos" — **depois** da
  trilha B (Marketing API). O doc lista os materiais a solicitar ao usuário antes de qualquer implementação.

## Multi-plataforma de mídia paga (direção de escala)

Meta Ads é a **primeira** plataforma, não a única. O produto foi construído para
crescer para Google Ads, TikTok Ads e outras — cada uma como fase própria,
**somente depois** de o copiloto Meta estar maduro. Invariantes de arquitetura
(espelham o modelo do Organic Growth, para não repetir seus erros):

- Cada plataforma traz um `Connector` registrado no framework existente
  (`packages/connectors` + `apps/web/src/lib/connectors.ts`), tabelas próprias
  `<provider>_*` em `packages/db` (métricas de redes diferentes têm semânticas
  diferentes — **nunca normalizar cru**), um corpus de conhecimento oficial
  próprio (trust 1, coleção própria na knowledge base) e uma implementação de
  `CampaignBriefProvider` em `apps/web/src/lib/campaign-data/` (hoje só `meta.ts`).
- **Métricas de plataformas distintas nunca são comparadas como equivalentes.** O
  motor diagnostica por plataforma; o **contexto do produto** é o denominador
  comum entre elas. Uma conexão → um provider de briefing → um bloco no briefing.
- O motor de diagnóstico **não muda** quando uma plataforma nova chega: ele pede
  o briefing ao registry pela `connections.provider` e recebe texto pronto.
- `products.connection_id` é 1:1 hoje; vira uma tabela de junção
  `product_connections` (N:M) quando a segunda plataforma entrar — migração
  conhecida e adiada de propósito (não custa nada agora e evita over-engineering).
- O campo `evidence.source` do schema ganha um valor por plataforma (`meta_docs`
  hoje; `google_docs`/`tiktok_docs` no futuro) — nunca um genérico que apague a
  origem da regra citada.

## Organic Growth — inteligência de conteúdo orgânico

O **Organic Growth** é um add-on opcional, nativo do Seenaly, que transforma
conteúdo orgânico e seus sinais de desempenho em diagnóstico, recomendação e
experimento. Ele amplia a camada de Decision Intelligence; não é uma segunda
aplicação nem uma ferramenta de operação de redes sociais.

O módulo compartilha produtos, ofertas, públicos, funis, biblioteca criativa,
conversões, recomendações, conhecimento e memória de experimentos com o núcleo
de mídia paga. Seu primeiro recorte continua sendo negócios de produtos digitais
e ofertas self-service, com Instagram como porta de entrada e a ponte
**orgânico → pago** como principal diferenciação.

Não fazem parte do MVP: agendamento, publicação, inbox, resposta automática,
edição de mídia, social listening amplo, scraping não autorizado, atribuição
causal de vendas ou comparação bruta entre redes.

### Decisões arquiteturais

- `creatives` continua sendo a biblioteca canônica do ativo e de sua taxonomia;
  uma publicação orgânica é uma colocação específica, vinculada ao criativo,
  com plataforma, conta, URL/ID externo, legenda, formato e data de publicação.
- Importações são lotes idempotentes e auditáveis. Métricas são snapshots com
  origem explícita (`manual` ou `connector`) e o payload recebido é preservado.
- `products`, `diagnoses` e `experiments` são reutilizados. O Organic Growth não
  cria cópias desses domínios; Reviews apenas agregam e congelam as evidências e
  recomendações do período analisado.
- Conectores enriquecem o módulo, mas nunca são portão de valor. No Concierge,
  plataforma e conta são declaradas pelo usuário; OAuth só entra na Etapa 1.
- O contexto mínimo para uma análise completa é produto, público, objetivo,
  oferta ou ação desejada, plataforma/conta de origem e período. Sem ele, o
  produto orienta o preenchimento em vez de inventar uma análise.
- Dados do negócio, da conta e de experimentos são evidências da decisão, não
  uma nova numeração de confiança. Os `trust_level` 1–5 de `packages/knowledge`
  permanecem canônicos: documentação oficial no topo, opiniões e benchmarks na
  base.

### Etapa 0 — Concierge Beta

O primeiro recorte vertical valida a proposta antes das integrações completas:
**um workspace, um produto, uma conta Instagram declarada, um período e uma
planilha/CSV padronizada**. Ele implementa a fundação do módulo, mas não deve ser
apresentado como o MVP Instagram completo.

Fluxo:

1. O usuário ativa o beta e seleciona um produto existente.
2. Confirma o contexto mínimo e informa conta e período da análise.
3. Importa um CSV; o sistema valida, deduplica e mostra erros por linha.
4. A IA classifica texto e metadados por etapa do funil, intenção estratégica,
   tipo narrativo, tema, gancho e CTA, sempre com confiança declarada.
5. O usuário revisa as classificações; a correção humana prevalece e alimenta
   imediatamente as análises seguintes.
6. O sistema compara apenas coortes compatíveis e gera o Organic Growth Review
   sob demanda.
7. Recomendações suficientemente fundamentadas podem virar experimentos no
   journal existente; uma oportunidade orgânico → pago mantém o vínculo com a
   peça de origem.
8. O usuário exporta o Review e avalia cada recomendação como útil, não útil ou
   incorreta.

O CSV aceita um ID externo ou URL, data de publicação, formato e legenda/título,
além das métricas que estiverem disponíveis — por exemplo impressões, alcance ou
plays, curtidas, comentários, compartilhamentos, salvamentos, visitas ao perfil,
cliques, leads e conversões assistidas. A ausência de uma métrica não vira zero:
ela permanece ausente e reduz o que pode ser concluído.

### Invariantes de análise

1. **Crescimento antes de engajamento.** Alcance e curtidas não equivalem a
   resultado comercial; intenção, avanço no funil e aprendizado têm precedência.
2. **Evidência antes de recomendação.** Toda recomendação aprovada cita produto,
   período, conteúdos e dados observados. Orientação sem dados é orientação de
   coleta, não recomendação orgânica aprovada.
3. **Contexto antes de benchmark.** A referência primária é a própria conta em
   coorte equivalente: mesma rede, conta, produto, formato, objetivo, idade e,
   quando aplicável, duração e etapa do funil.
4. **Hipótese antes de produção.** Toda sugestão de conteúdo ou reaproveitamento
   declara uma hipótese falsificável e um critério de sucesso.
5. **Insuficiência é uma resposta válida.** Baixo volume, denominadores ausentes
   ou coortes incompatíveis produzem `insufficient_data` e `missing_data`, nunca
   preenchimento imaginado.
6. **Sem causalidade indevida.** O módulo usa “associação observada”, “sinal de
   influência”, “contribuição provável” ou “conversão assistida”; não afirma que
   um post causou uma venda sem evidência direta.
7. **Scores são explicáveis.** Percentis e sinais relativos precedem qualquer
   score proprietário 0–100; todo score futuro expõe entradas, versão, ausências
   e confiança.
8. **Humano no controle.** Classificações podem ser corrigidas, recomendações
   recebem feedback e nenhuma ação é executada na rede pelo Seenaly.

### Schema superset de recomendação

Organic Growth estende — e não substitui — o formato fixo do motor de diagnóstico:

```text
diagnosis: string
evidence: Array<{
  statement, source,
  content_id?, metric?, value?, period?
}>
context: { product, audience, platform, account, funnel_stage?, period }
technical_basis: Array<{ rule, citation }>
hypothesis: string
recommended_action: string
priority: critical | high | medium | low
estimated_effort: low | medium | high
expected_impact: low | medium | high
risk: string
confidence: low | medium | high
success_criterion: string
next_review: string
sources: Array<{ type, reference, version? }>
insufficient_data: boolean
missing_data: string
```

`technical_basis` pode ser vazio quando não existe regra oficial aplicável; não
se força documentação da Meta em um problema orgânico. Evidências não podem ser
vazias em uma recomendação aprovada. Fato observado, inferência e hipótese devem
ser distinguíveis. Versões de taxonomia, prompt, modelo, regra de score e base de
conhecimento são persistidas com a análise.

### Roadmap do módulo

| Etapa | Entrega |
|---|---|
| 0 — Concierge Beta | Modelo compartilhado, taxonomia, importação manual, classificação assistida e corrigível, Review, recomendação estruturada, feedback e integração com experimentos |
| 1 — MVP Instagram | OAuth para contas profissionais, ingestão e sync de posts/Reels/métricas, histórico, Review recorrente e ponte orgânico → Meta Ads |
| 2 — TikTok | Conector autorizado, vídeos e métricas básicas, importação complementar, ganchos e reaproveitamento para anúncios |
| 3 — YouTube | Vídeos e Shorts, retenção, CTR, fontes de tráfego, títulos e thumbnails |
| 4 — LinkedIn | Páginas e perfis quando permitidos, intenção B2B e conexão posterior com leads/pipeline |
| 5 — Multicanal | Comparação de mensagens normalizada, jornada de conteúdo, atribuição assistida e recomendações cross-channel |
| 6 — Opcionais validados | Calendário estratégico, aprovações, respostas assistidas, publicação e análise competitiva autorizada — somente após evidência de demanda |

### Critérios de aceite e suficiência

O Concierge Beta é aceito quando o usuário consegue ativá-lo, escolher um produto,
importar 30 conteúdos **ou todo o histórico disponível**, revisar classificações,
ver a distribuição por funil, gerar um Review, converter uma recomendação em
experimento, exportar o relatório e registrar feedback de utilidade. Importações
menores continuam válidas e devem conduzir a uma experiência útil de coleta.

Com dados suficientes, o Review deve mostrar conteúdos com maior sinal comercial,
ao menos três recomendações contextualizadas e, quando sustentada pelos dados, uma
oportunidade orgânico → pago. Com dados insuficientes, esses mínimos quantitativos
não se aplicam: o aceite é declarar a limitação, mostrar as evidências disponíveis,
listar os dados ausentes e recomendar o próximo passo de coleta. Nunca se fabrica
uma recomendação ou um candidato a anúncio para cumprir uma contagem.

Nenhuma recomendação passa pelo gate de qualidade se não mencionar o produto, não
usar dados observados, não apresentar hipótese, risco, confiança e critério de
sucesso, ou não separar fato de inferência. Comparações relativas só são exibidas
quando existe uma coorte comparável; o limiar é versionado e transparente.

O MVP Instagram completo acrescenta conexão autorizada, ingestão e sincronização
periódica. Segurança multi-tenant, RLS, auditoria, exclusão de dados importados,
tratamento de falhas e idempotência são obrigatórios desde a Etapa 0.
