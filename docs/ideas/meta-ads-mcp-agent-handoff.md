# Ideia futura — Handoff para o MCP de anúncios da Meta ("Seenaly é o cérebro, o agente do usuário são as mãos")

> **Status:** parking lot / não priorizado. Não está no roadmap comprometido (`docs/PRODUCT.md`).
> Documentado para estudo futuro. **NÃO implementar sem antes reunir os materiais listados no fim deste doc.**
> Registrado em 2026-07-22.

## Resumo em uma frase

O Seenaly continua sendo o motor de **decisão** (analisa, diagnostica, recomenda — nunca opera).
Um dia, *como enriquecimento opcional*, ele pode **recomendar que o próprio usuário conecte o servidor
MCP oficial de anúncios da Meta no cliente de IA dele** (Claude, ChatGPT, Perplexity…) e **execute lá** as
ações que o Seenaly diagnosticou. O Seenaly nunca chama esse MCP como camada de conexão do produto.

## O que é o MCP oficial de anúncios da Meta

- Servidor MCP **remoto** da Meta: `https://mcp.facebook.com/ads`.
- Modelo **"traga seu próprio cliente de IA"**: o usuário adiciona essa URL como *conector remoto* dentro do
  agente de IA dele e autentica na **própria** conta de anúncios. O agente passa a ler **e agir** sobre a conta.
- Clientes de IA suportados no lançamento: **ChatGPT, Claude, Claude Code, Perplexity** (cada um com seu
  próprio fluxo de adicionar conector remoto).
- Capacidades (via linguagem natural): relatórios/insights, **criação e gestão de anúncios/conjuntos/campanhas**,
  **criação e gestão de catálogos**, diagnóstico de sinais (pixel/CAPI), busca na Central de Ajuda,
  **testes A/B e conversion lift**, registro de atividades. Tem **capacidade de escrita** — cada ação exige
  autorização do usuário pelo agente.
- Recurso **novo e em rollout limitado** ("talvez você ainda não tenha acesso"); posts do dev blog de abr/2026.

## Por que isto NÃO é a camada de conexão do Seenaly (decisão já tomada)

Resumo — a análise completa foi feita na conversa de 2026-07-22. Ver também [[maturity-spectrum-invariant]].

1. **Modelo de auth errado.** O MCP autentica *um usuário, interativamente, no cliente de IA dele*. O Seenaly é
   SaaS multi-tenant com UI própria; não há (comprovadamente) fluxo OAuth server-side por tenant para
   `mcp.facebook.com/ads`. O caminho multi-tenant real continua sendo **Facebook Login for Business + `ads_read`
   + App Review + Business Verification** (a "trilha B" do roadmap).
2. **Conflito com a tese do produto.** O MCP é a superfície de "IA dentro do Gerenciador" da própria Meta, com
   ferramentas de **escrita**. O `docs/PRODUCT.md` crava: *"analisa… não opera"* e *"não competimos com a
   automação da Meta"*. Apoiar o produto nele apagaria o diferencial (contexto do produto + `growth-playbook`
   + memória de experimentos + RAG por coleção + formato fixo de 9 campos + "lei do nada genérico").
3. **Modelo de dados errado.** O motor precisa de **sync histórico em background** (cron → `meta_insights_daily`,
   janelas de 30 dias, tendência). MCP é request-time/conversacional, não um ETL em lote para centenas de contas.
4. **Invariante de maturidade.** Conectar via MCP trancaria todo o valor atrás do OAuth da Meta — viola
   *"o valor nunca fica atrás da conexão Meta"*. O desenho atual (contexto + conhecimento sempre; Meta enriquece)
   é o correto.

## Por que a ideia de *handoff* ainda pode valer

- **Separação limpa de papéis:** Seenaly = cérebro (diagnóstico grounded, formato fixo, memória); MCP da Meta =
  mãos (execução na conta), operado **pelo usuário**, no cliente de IA **dele**. O Seenaly nunca opera — o
  princípio central fica intacto.
- **Fecha o loop sem virar operador:** hoje o loop é diagnóstico → registrar experimento (manual). O handoff
  daria um caminho opcional "leve isto para o seu agente executar" sem o Seenaly assumir responsabilidade de
  operação/erro na conta do cliente.
- **Sinal competitivo:** confirma que a Meta investe em "IA + anúncios"; reforça cravar o valor do Seenaly na
  *qualidade da decisão* (o que a Meta não tem: contexto de produto, funil real, margem, memória).

## Como poderia ser (esboço, não compromisso)

- **Formato:** o Seenaly gera, junto do diagnóstico, um **"prompt de execução"** copiável — instrução em
  linguagem natural, ancorada na `recommended_action` + `success_criterion`, pronta para o usuário colar no
  agente de IA dele já conectado ao `mcp.facebook.com/ads`.
- **Onboarding do handoff:** um guia curto "conecte o MCP da Meta no seu Claude/ChatGPT" (links do artigo abaixo),
  claramente marcado como **opcional** e **fora do Seenaly** (o Seenaly não vê nem guarda esse token).
- **Guarda-corpos:** deixar explícito que a execução e o risco são do usuário; o Seenaly só recomenda. Nunca
  embutir o token do MCP no backend nem chamar o MCP server-side em nome do cliente.
- **Escopo:** começar só por ações de **baixo risco / reversíveis** (ex.: duplicar um anúncio para teste A/B),
  nunca mudanças de orçamento/estrutura em massa.

## Pré-condições / critérios antes de priorizar

- A "trilha B" (Marketing API, `ads_read`, App Review) estar **entregue e validada** — o handoff é enriquecimento,
  não substituto.
- Demanda real de usuários pedindo "executar", não só "diagnosticar".
- Confirmar que o recurso da Meta saiu do rollout limitado e é acessível ao público-alvo (produtos digitais BR).

## ⚠️ Materiais a solicitar ao usuário quando retomarmos (docs inacessíveis pela IA)

Muitos documentos da Meta são renderizados por JS / ficam atrás de login e o `WebFetch` só retorna o "casco".
**Se decidirmos implementar, o agente deve PEDIR ao usuário para colar o conteúdo destes materiais** (como foi
feito com o artigo da Central de Ajuda em 2026-07-22):

1. **Auth do `mcp.facebook.com/ads`** — é OAuth interativo por usuário ou existe fluxo server-side/por-tenant?
   Há escopo somente-leitura? (decisivo para saber se o handoff é a única forma ou se algo mais é possível).
2. **Dev blog + docs de desenvolvedor da Meta** (conteúdo completo, colado):
   - `https://developers.facebook.com/blog/post/2026/04/29/introducing-ads-cli`
   - `https://developers.facebook.com/documentation/ads-commerce/ads-ai-connectors/ads-cli/ads-cli-overview`
3. **Fluxo de adicionar conector remoto em cada cliente de IA** (para escrever o guia de onboarding):
   - Claude: `https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp`
   - Claude Code: `https://code.claude.com/docs/en/mcp#option-1-add-a-remote-http-server`
   - ChatGPT: `https://developers.openai.com/api/docs/guides/developer-mode`
   - Perplexity: `https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors`
4. **Termos/limitações de uso** do MCP de anúncios da Meta (o que é permitido a integradores terceiros).
5. Lista de **ferramentas expostas** pelo MCP (o artigo diz "pergunte ao agente quais ferramentas há") — útil para
   escolher só as de baixo risco.

## Fonte

- Central de Ajuda da Meta para Empresas, artigo `1456422242197840` — *"Como gerenciar anúncios de um agente de IA
  com os conectores de IA de anúncios da Meta"* (conteúdo colado pelo usuário em 2026-07-22;
  `https://www.facebook.com/business/help/1456422242197840`).
