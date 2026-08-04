---
title: "Dados estruturados: como a oferta se descreve para máquinas"
description: "O que schema.org Product/Offer/FAQ declara sobre preço, disponibilidade e avaliações, por que dados estruturados incorretos são pior que ausentes, e como diagnosticar pelos tipos JSON-LD encontrados no scan."
tags: [seo, discovery, structured-data, schema-org, rich-results]
related: [descoberta-title-meta-description, descoberta-indexacao-sitemap-robots, prova-social-sinais-confianca]
sources: ["Google Search Central — introdução aos dados estruturados", "Google Search Central — diretrizes gerais de dados estruturados", "schema.org — vocabulário Product e Offer"]
trust: 2
captured: 2026-08-04
---

[← Voltar ao índice](INDEX.md)

# Dados estruturados: como a oferta se descreve para máquinas

## Princípio

Dados estruturados são um bloco declarativo — normalmente JSON-LD no `<head>` — que diz a
qualquer leitor automático **o que a página é**: um produto com preço e disponibilidade,
uma organização com nome e canais, uma lista de perguntas frequentes. É a diferença entre
o buscador inferir que ali há uma oferta e o negócio afirmar isso em vocabulário
padronizado.

O ganho não é ranqueamento. É **como o resultado aparece**: os recursos avançados de
resultado (preço, faixa de avaliação, perguntas expandidas) dependem de dados estruturados
válidos. É espaço na tela do resultado, conquistado por declaração e não por orçamento.

## Evidência

A documentação do Google Search Central descreve dados estruturados como o mecanismo pelo
qual uma página se qualifica para recursos avançados de resultado, e é explícita em dois
pontos que mudam a recomendação:

- **Elegibilidade, não garantia.** Marcar a página corretamente a torna _elegível_; a
  exibição continua sendo decisão do buscador. Prometer o recurso avançado como
  consequência da marcação é incorreto.
- **Marcação incorreta tem penalidade.** As diretrizes exigem que o conteúdo marcado
  corresponda ao conteúdo visível ao usuário. Declarar preço, avaliação ou disponibilidade
  que a página não mostra — ou que não é verdadeiro — é violação explícita, sujeita a ação
  manual que remove os recursos avançados do site.

Essa assimetria é o que torna o item diferente dos outros de descoberta: **ausência é
neutra; presença errada é passivo**. É o único item do grupo onde fazer mal é pior que não
fazer.

O vocabulário em si é do schema.org, adotado por múltiplos buscadores — a marcação não é
específica de um mecanismo.

## Quando se aplica

Aplica-se com força quando a página **vende algo com preço visível**: produto digital,
curso, assinatura, serviço com valor declarado. Nesse caso `Product` + `Offer` descrevem
exatamente o que a página já mostra.

Aplica-se de forma secundária quando a página tem **seção de perguntas frequentes** reais
(`FAQPage`) ou quando o negócio quer declarar identidade (`Organization`).

Não se aplica a página de captura sem oferta explícita, página de obrigado, ou funil
restrito que não deve nem ser indexado — marcar dados estruturados em página `noindex` é
trabalho sem destino.

## Como diagnosticar

O scan extrai os tipos `@type` declarados nos blocos JSON-LD da página:

- **`structuredDataTypes` vazio** em página com preço visível — a oferta existe para
  humanos e não existe para máquinas. É o achado padrão do item.
- **`structuredDataTypes` contém apenas `WebSite` ou `Organization`** — marcação genérica
  do construtor de sites, que não descreve a oferta. Presença sem valor de oferta: trate
  como ausência, não como item resolvido.
- **`structuredDataTypes` contém `Product` ou `Offer`** — a oferta está declarada. O item
  está atendido no que o scan consegue observar.
- **`structuredDataTypes` contém `FAQPage`** — coerente apenas se a página realmente exibe
  as perguntas. Marcação de FAQ sem FAQ visível é o caso clássico de violação das
  diretrizes.

Limite honesto do sinal: o scan vê **quais tipos existem**, não se os campos internos estão
completos nem se correspondem ao que a página mostra. Um `Product` declarado com preço
divergente do preço exibido é invisível para esta verificação — e é exatamente o caso mais
arriscado. Nunca afirme que a marcação está _correta_; afirme que ela _existe_.

## Ação recomendada

Em ordem de alavancagem:

1. **Se a página vende com preço visível, declare `Product` + `Offer`** com preço, moeda e
   disponibilidade **iguais aos exibidos**. Divergência é o que gera penalidade.
2. **Se há FAQ real na página, declare `FAQPage`** com as mesmas perguntas e respostas
   visíveis — nunca perguntas que só existem na marcação.
3. **Declare `Organization`** com nome e canais oficiais quando o negócio quiser
   consolidar identidade.
4. **Valide a marcação** com o teste de resultados avançados do Google antes de considerar
   o item resolvido; o scan não substitui essa validação.
5. **Se as avaliações não forem reais e verificáveis, não marque avaliação.** Nota agregada
   inventada é a violação mais comum e a mais fácil de detectar.

## Riscos e limites

**Não prometa recurso avançado de resultado.** A marcação dá elegibilidade; a exibição é
decisão do buscador e varia por consulta, dispositivo e categoria.

**Marcação incorreta é pior que ausência.** Este é o único item de descoberta onde a
recomendação "faça agora" pode causar dano se executada sem cuidado. Recomende com a
condição de correspondência ao conteúdo visível, sempre explícita.

**Não confunda presença de tipos com item resolvido.** Muitos construtores injetam
`WebSite`/`Organization` por padrão. Se o objetivo é descrever a oferta, esses tipos não
contam.

**Nada aqui é pré-requisito para anunciar.** Dados estruturados não afetam entrega nem
custo de mídia paga. O motivo de tratar antes é que a mesma página, já pronta, passa a
ocupar mais espaço no único canal cujo clique não é comprado.
