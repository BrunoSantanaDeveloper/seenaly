# Corpus de Growth (CRO, checkout, oferta, funil)

Corpus **autoral** que dá base técnica citável ao motor de diagnóstico para tudo que está
**fora da plataforma Meta**: conversão pós-clique, checkout, estrutura de oferta, pricing,
página de vendas e funil. Complementa `docs/meta_ads/` (que é capturado da documentação
oficial da Meta); este aqui é **sintetizado e escrito por nós**, com atribuição de fontes.

Ingestão: `npm run knowledge:ingest` (ou `-- --corpus=growth-playbook`) carrega `md/*.md`
na coleção global `growth-playbook` da knowledge base. O nível de confiança é **por
documento**, via campo `trust:` no frontmatter (default 4).

## Por que autoral, e não capturado

Diferente do Meta Ads, não existe "documentação oficial" de CRO/oferta — o conhecimento
está em pesquisa publicada (Baymard, Nielsen Norman Group), livros e frameworks de
praticantes, quase tudo protegido por direito autoral. **Nunca ingerir texto de terceiros
verbatim.** Cada card sintetiza o princípio com as nossas palavras e cita a fonte de
origem: princípios e fatos não são protegidos; a expressão deles é.

## Mapa de trust levels (escala 1–5 da knowledge base)

| Trust | Uso neste corpus |
|---|---|
| 1 | Documentação oficial de plataforma (gateways, Google, web.dev) — capturável, cite a página |
| 2 | Pesquisa quantitativa publicada (Baymard, NN/g, estudos com N grande) — sintetizada com números e atribuição |
| 3 | Estudos de caso documentados com resultado verificável |
| 4 | Playbook sintetizado de frameworks de praticantes (livros, metodologias consolidadas) — **default** |
| 5 | Opinião/curso sem evidência verificável — evitar; só se o valor prático justificar |

## Domínios e prioridade

1. **Checkout e pagamento** — foco inicial em **checkout próprio** (páginas e
   desenvolvimento proprietário, o recorte de lançamento): princípios de fricção,
   confiança, meios de pagamento BR (PIX, parcelamento). Documentação de plataformas
   (Hotmart, Kiwify, Eduzz — trust 1, capturável) fica **adiada** até o público que
   depende delas entrar no escopo — a estrutura já comporta, é só adicionar cards.
2. **Oferta e pricing** — equação de valor, garantias, ancoragem, offer stack.
3. **Página de vendas e funil** — message match, estrutura de página, prova, CTA.
4. **Criação de conteúdo e criativos** — gancho/ângulo/prova, roteiro de VSL/UGC,
   taxonomia de etiquetagem da biblioteca de criativos (pilar 4), creative testing.
   As recomendações **oficiais** da Meta sobre criativos continuam no corpus
   `meta-ads-docs` (trust 1); aqui entra o ofício (craft) que a Meta não documenta.
5. **Arquitetura de funil e escala** — tipos de funil (VSL, quiz, webinário, lançamento),
   tetos de ticket/nicho para público frio, esteira (order bump/upsell/downsell/
   recuperação) e heurísticas de teste→escala. Fortemente baseado em praticantes BR
   (trust 4–5): sempre com atribuição nominal e nunca apresentado como regra da Meta.
6. **SaaS, trial e recorrência** — modelo trial-first (cadastro grátis → uso → contratação),
   ativação/aha moment, régua de e-mail do trial e economia unitária de assinatura
   (churn, LTV/CAC, payback). É o **segundo modelo de negócio** do corpus: os itens 1–5
   assumem compra imediata em checkout único; aqui a venda acontece depois do uso, e a
   alavanca principal deixa de ser página/oferta e passa a ser ativação. Cards de checkout
   e criativo continuam válidos para o topo do funil.

## Formato dos cards

Um card = um princípio diagnóstico, curto (1–3 mil palavras), otimizado para chunking e
para o formato estruturado de recomendação do produto (`docs/PRODUCT.md`). Seções fixas:

1. **Princípio** — a afirmação central em 2–3 frases.
2. **Evidência** — números/achados com atribuição explícita ("pesquisa do Baymard Institute…").
3. **Quando se aplica** — recorte (tipo de produto, etapa do funil, maturidade de dados).
4. **Como diagnosticar** — sinais nos dados (Meta + funil) que apontam para este princípio.
5. **Ação recomendada** — o que mudar, em ordem de alavancagem.
6. **Riscos e limites** — onde o princípio falha ou não se transfere (ex.: dados US/EU vs. BR).

Frontmatter (o parser de `scripts/ingest-knowledge.mts` lê YAML flat + listas inline;
**não usar vírgula dentro de itens de lista**):

```yaml
---
title: "Título do card"
description: "Resumo de uma frase para o INDEX e para o retrieval."
tags: [checkout, cro]
related: [outro-card, mais-um-card]
sources: ["Baymard Institute — Checkout Usability", "NN/g — Information Scent"]
trust: 2
captured: 2026-07-10
---
```

## Fluxo de produção

1. Liste os diagnósticos que o motor precisa emitir (trabalhe de trás para frente a partir
   de `apps/web/src/lib/diagnosis/`); escreva primeiro os cards que eles citarão.
2. Rascunhe com deep research (sempre exigindo as fontes); **revisão humana obrigatória**
   antes de commitar — a revisão é o que transforma rascunho de IA em playbook confiável.
3. Adicione o card em `md/`, registre no `md/INDEX.md`, rode
   `npm run knowledge:ingest -- --dry-run` para validar o frontmatter e depois a ingestão real.
