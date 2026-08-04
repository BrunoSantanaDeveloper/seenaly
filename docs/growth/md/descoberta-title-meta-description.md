---
title: "Fundamentos de descoberta: title, meta description e hierarquia da página"
description: "O que title, meta description, H1 e lang fazem — na busca e no compartilhamento — por que são a alavanca mais barata de descoberta antes do tráfego pago, e como diagnosticar ausência ou duplicidade pelos sinais do scan."
tags: [seo, discovery, landing-page, metadata]
related: [descoberta-indexacao-sitemap-robots, descoberta-dados-estruturados, congruencia-anuncio-pagina]
sources: ["Google Search Central — títulos de links e snippets de resultado", "Google Search Central — fundamentos de SEO", "prática consolidada de CRO — message match"]
trust: 2
captured: 2026-08-04
---

[← Voltar ao índice](INDEX.md)

# Fundamentos de descoberta: title, meta description e hierarquia da página

## Princípio

O `<title>` e a meta description são o texto que representa a página **fora** dela: no
resultado de busca, na aba do navegador, no link colado em WhatsApp e Instagram. São a
primeira promessa que o negócio faz, e quase sempre a única coisa que alguém lê antes de
decidir clicar. Uma página sem título próprio, ou com o título padrão do construtor
("Home", "Página inicial", o nome do tema), gasta essa vitrine dizendo nada.

Isso não é uma tarefa de SEO no sentido de "ranquear". É higiene de identidade: a mesma
página que vai receber tráfego pago também é compartilhada, salva e reencontrada, e em
todos esses caminhos o title é o rótulo.

## Evidência

O Google documenta em seu Search Central que o texto do título exibido no resultado é
gerado a partir do conteúdo da página, com o elemento `<title>` como a fonte principal, e
que a meta description é uma das entradas usadas para compor o snippet — nenhum dos dois
é garantia de exibição literal, mas ambos são o sinal declarado pelo dono da página. A
documentação também é explícita ao dizer que títulos duplicados ou genéricos em muitas
páginas dificultam a diferenciação entre elas.

Duas consequências que não dependem de ranqueamento e por isso valem mesmo para quem só
pretende anunciar:

- **Compartilhamento.** Quando a página não declara Open Graph, redes sociais e
  mensageiros recorrem ao title e à description para montar o preview do link. Sem eles,
  o link aparece como URL crua — o formato que menos convence a abrir.
- **Reencontro.** Quem viu o anúncio, não comprou e depois procura pelo nome da marca
  precisa reconhecer a página na lista de resultados. Um título genérico quebra esse
  reencontro, que é demanda já paga uma vez.

Não há um percentual universal de ganho a citar aqui, e desconfie de quem oferece um: o
efeito depende de quanto o título atual já comunica.

## Quando se aplica

Vale para qualquer negócio que tenha uma página pública, em qualquer maturidade — é o
item de descoberta com menor custo de correção e o único do grupo classificado como
tarefa própria (`diy`): não exige desenvolvedor, exige decidir a frase.

Aplica-se **antes** do primeiro anúncio porque o custo de corrigir é praticamente zero e o
custo de descobrir depois é ter pago por cliques cuja página não conseguia ser reencontrada
nem compartilhada com o rótulo certo.

Não se aplica a páginas que existem apenas como destino técnico (obrigado, confirmação,
callback de pagamento) — ali o título é irrelevante para descoberta.

## Como diagnosticar

O scan da página lê estes sinais diretamente do HTML e eles não dependem de nenhuma
declaração do usuário:

- **`title` ausente ou vazio** — a página não tem rótulo próprio. É o achado mais grave do
  grupo e o mais barato de resolver.
- **`titleLength` muito curto** (poucos caracteres) — normalmente indica título herdado do
  template, não escrito para a oferta.
- **`metaDescription` ausente** — o snippet passa a ser montado a partir de trechos
  arbitrários do corpo, e o preview de compartilhamento perde a frase de venda.
- **`h1Count` igual a zero ou maior que um** — sem H1, a página não declara seu assunto
  principal; com vários, declara vários e nenhum. Um único H1 coerente com o title é o
  estado saudável.
- **`lang` ausente** — a página não declara o idioma, o que afeta leitores de tela e a
  interpretação do conteúdo.
- **`hasViewport` falso** — sem a meta viewport a página não se comporta como responsiva
  no celular, onde está a maior parte do tráfego social pago.

Um cruzamento vale mais que qualquer um desses isolados: **o title deve conter a mesma
promessa do anúncio**. Título e criativo desalinhados são a mesma quebra de continuidade
descrita em [Congruência anúncio → página](congruencia-anuncio-pagina.md), só que na
superfície que aparece antes do clique orgânico.

## Ação recomendada

Em ordem de alavancagem:

1. **Escreva um title específico da oferta**, não do negócio: o que a pessoa consegue,
   para quem. Se o anúncio promete uma coisa e o title promete outra, alinhe ao anúncio.
2. **Escreva a meta description como chamada**, não como resumo institucional — ela
   compete com outros resultados e com outros links compartilhados.
3. **Garanta um único H1** que repita a promessa central da página.
4. **Declare `lang`** e a **meta viewport** — duas linhas no `<head>`, efeito permanente.
5. **Declare Open Graph** (título, descrição e imagem) para controlar o preview do link
   compartilhado em vez de deixá-lo por conta do que o mensageiro adivinhar.

## Riscos e limites

**Isto não faz a página ranquear.** Title e description bem escritos são condição de
apresentação, não de posicionamento — atribuir ganho de tráfego orgânico a essa mudança
isolada é exagero, e prometer isso ao usuário queima a credibilidade do diagnóstico.

**Nada aqui bloqueia o tráfego pago.** Uma página sem meta description recebe e converte
anúncios normalmente. O argumento correto para tratar antes de anunciar é o custo: são
minutos de trabalho contra um benefício permanente em todos os caminhos não pagos.

**Título longo é reescrito.** O Google pode substituir o title exibido quando julga que
outro texto representa melhor a página; escrever para o algoritmo em vez de para a pessoa
não tem retorno.

**Não confunda com performance.** `hasViewport` presente não significa boa experiência
mobile — significa apenas que a página declara comportamento responsivo. Velocidade e
layout real são medidos por outro sinal.
