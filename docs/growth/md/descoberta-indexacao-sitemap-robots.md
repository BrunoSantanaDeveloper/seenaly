---
title: "Indexabilidade: noindex, robots.txt e sitemap"
description: "Como uma página deixa de existir para a busca sem ninguém perceber — noindex herdado do ambiente de teste, robots.txt bloqueando tudo, conteúdo só renderizado no cliente — e por que a decisão de ser indexável é deliberada e não um checkbox universal."
tags: [seo, discovery, indexing, robots, sitemap]
related: [descoberta-title-meta-description, descoberta-dados-estruturados]
sources: ["Google Search Central — bloqueio de indexação com noindex", "Google Search Central — introdução ao robots.txt", "Google Search Central — sitemaps"]
trust: 2
captured: 2026-08-04
---

[← Voltar ao índice](INDEX.md)

# Indexabilidade: noindex, robots.txt e sitemap

## Princípio

Existem duas perguntas distintas que costumam ser tratadas como uma só: **o buscador pode
rastrear esta página?** (robots.txt) e **o buscador pode listá-la?** (noindex). Elas têm
mecanismos diferentes, falham de formas diferentes, e a combinação errada produz o pior
resultado possível — uma página que o negócio acha que está publicada e que, para a busca,
não existe.

O achado que importa aqui quase nunca é "faltou fazer SEO". É **configuração de ambiente
de teste que vazou para produção**: o `noindex` que protegia o site em construção, o
`Disallow: /` que ficou do staging. Nenhum dos dois emite erro, nenhum aparece na tela, e
os dois são invisíveis para quem só olha a página no navegador.

## Evidência

A documentação do Google Search Central descreve os dois mecanismos e é explícita sobre a
interação entre eles:

- **`noindex`** (meta tag ou cabeçalho HTTP) instrui o buscador a não listar a página nos
  resultados. É a forma correta de manter uma página fora da busca.
- **`robots.txt`** controla **rastreamento**, não indexação. Uma `Disallow` impede o
  buscador de buscar a página.
- A armadilha documentada: se a página está bloqueada no robots.txt, o buscador **não
  consegue ler** a meta `noindex` que está dentro dela. Bloquear e marcar noindex ao mesmo
  tempo é contraditório — o bloqueio impede a leitura da instrução.

O **sitemap.xml** é descrito como um mecanismo de _descoberta_ de URLs, não de garantia de
indexação: ele ajuda o buscador a encontrar páginas, especialmente em sites novos, com
poucos links externos ou com navegação pobre — exatamente o perfil de quem está montando a
primeira estrutura de aquisição.

Há ainda um modo de falha que não é configuração: quando o conteúdo é montado inteiramente
no cliente, o HTML servido pode chegar praticamente vazio. A página funciona para quem
abre no navegador e é pobre para qualquer leitor automático — buscador, prévia de link,
scanner.

## Quando se aplica

Aplica-se a qualquer negócio com site próprio, **e a decisão é deliberada**: nem toda
página deve ser indexável.

- **Deve ser indexável:** site institucional, blog, páginas de produto, qualquer página que
  o negócio queira que seja reencontrada pelo nome.
- **Pode legitimamente ser noindex:** página de oferta exclusiva, funil de lançamento com
  link restrito, VSL de campanha que o negócio não quer listada publicamente, página de
  obrigado, área logada.

O item vira problema quando o estado **não corresponde à intenção** — e a intenção quem
declara é o negócio, nunca o diagnóstico.

## Como diagnosticar

O scan mede tudo isto sem depender de declaração:

- **`noindex` verdadeiro** — a página pede para não ser listada. Não é defeito por si só:
  confronte com a intenção declarada. É achado grave quando o negócio afirma querer
  descoberta orgânica.
- **`robotsDisallowsAll` verdadeiro** — o robots.txt bloqueia todos os rastreadores. É o
  achado mais grave do grupo inteiro e o mais fácil de passar despercebido.
- **`robotsTxt: "missing"`** — ausência não é bloqueio; sem robots.txt o rastreamento é
  livre. Trate como oportunidade menor, nunca como falha crítica.
- **`sitemapXml: "missing"`** e **`sitemapReferencedInRobots` falso** — o buscador depende
  inteiramente de links para descobrir páginas. Relevante em site novo, irrelevante em
  página única.
- **`canonical` ausente** — sem URL canônica, variações do endereço (com e sem `www`, com
  parâmetros de campanha) podem ser tratadas como páginas distintas. Isso interage com
  tráfego pago: parâmetros de rastreamento criam variações da mesma URL.
- **`jsRenderedLikely` verdadeiro** com **`visibleTextLength` baixo** — o HTML servido tem
  pouco texto. Investigue antes de recomendar: pode ser arquitetura deliberada.

A regra de leitura: **`robotsDisallowsAll` e `noindex` contra uma intenção declarada de
descoberta orgânica são contradição de primeira classe** — o observado desmente o
declarado, e essa divergência é o achado, não um dos dois lados isolado.

## Ação recomendada

Em ordem de alavancagem:

1. **Se `robotsDisallowsAll` for verdadeiro e o negócio quiser ser encontrado**, remova a
   regra. É a correção de maior impacto e menor custo de todo o grupo.
2. **Confronte o `noindex` com a intenção.** Se a página deve ser pública, remova a tag.
   Se é oferta restrita, registre que é deliberado para o diagnóstico parar de apontar.
3. **Publique um sitemap.xml e referencie-o no robots.txt** quando o site tiver mais de
   um punhado de páginas ou for recente.
4. **Declare a URL canônica**, principalmente se a página recebe tráfego com parâmetros.
5. **Se o conteúdo depende de JavaScript**, garanta que o essencial (título, promessa,
   oferta) esteja no HTML servido.

## Riscos e limites

**Indexabilidade não é um checkbox universal.** Recomendar "remova o noindex" para uma
página de funil deliberadamente restrita é uma recomendação errada apresentada com
confiança — o custo é a confiança do usuário no resto do diagnóstico. Sempre confronte com
a intenção declarada antes de concluir.

**Nada aqui é pré-requisito para anunciar.** Uma página com `noindex` recebe tráfego pago
normalmente e converte igual. O argumento para tratar antes é outro: demanda orgânica é a
única que não tem CAC, e uma configuração de teste vazada costuma vir acompanhada de
outras.

**robots.txt não protege conteúdo.** Não é mecanismo de segurança nem de privacidade;
área sensível se protege com autenticação.

**Sitemap não garante indexação.** Ele ajuda a descoberta. Prometer indexação a partir de
um sitemap publicado é exagero.
