---
title: "Congruência anúncio → página (message match)"
description: "Princípio de message match: a página de destino deve repetir a promessa, a linguagem e o visual do anúncio que gerou o clique. Como a quebra de cheiro de informação explica CTR alto com conversão baixa e o que alinhar primeiro."
tags: [landing-page, message-match, cro, creative, funnel]
related: [oferta-value-equation, checkout-abandono-causas]
sources: ["Nielsen Norman Group — information scent / information foraging", "prática consolidada de CRO — message match (Unbounce/CXL)"]
trust: 4
captured: 2026-07-10
---

[← Voltar ao índice](INDEX.md)

# Congruência anúncio → página (message match)

## Princípio

O clique no anúncio cria uma expectativa; a página de destino tem poucos segundos para
confirmar que o visitante chegou ao lugar certo. **Message match** é a regra de que a
headline, a promessa e o estilo visual da página devem ecoar o criativo que gerou o
clique. Quando a página quebra essa continuidade — outra promessa, outro tom, outra
estética — o visitante sai antes de avaliar a oferta, e o diagnóstico aparece como
"página ruim" quando na verdade é **desalinhamento entre anúncio e página**.

## Evidência

A base conceitual é a pesquisa de *information foraging* do Nielsen Norman Group: usuários
seguem o "cheiro de informação" (*information scent*) — pistas de que o caminho leva ao
que procuram — e abandonam a trilha assim que o cheiro se perde. O message match é a
aplicação disso à transição anúncio→página, consolidada como prática padrão de CRO
(Unbounce, CXL). Cite como "princípio de information scent (NN/g) aplicado como message
match"; não há um percentual universal de ganho — o efeito é direcional e depende do
tamanho da quebra.

Há também um efeito colateral dentro da plataforma: experiência pós-clique ruim degrada os
sinais de qualidade do anúncio na Meta (classificações de qualidade e de taxa de
conversão — ver corpus `meta-ads-docs`), encarecendo a entrega. O desalinhamento cobra
duas vezes: na conversão e no leilão.

## Quando se aplica

- Qualquer funil pago com página de destino própria — inclusive no passo 0, como regra de
  construção da primeira campanha (escreva o anúncio e a headline da página **juntos**).
- Ganha força quando a biblioteca de criativos etiquetada existe: cada ângulo/promessa
  etiquetado no criativo deve ter correspondência explícita na página que o recebe.

## Como diagnosticar

A assinatura clássica: **CTR bom + conversão da página baixa + saída rápida** (bounce
alto, pouca rolagem, quase nenhum checkout iniciado). O clique provou que a promessa do
anúncio atrai; a queda imediata indica que a página não confirma a promessa. Checklist de
congruência, cruzando as etiquetas do criativo com a página:

1. A **headline** da página repete (ou parafraseia de perto) a promessa do anúncio?
2. O **ângulo/dor** do criativo aparece no primeiro bloco da página, ou a página abre
   genérica ("bem-vindo ao curso X")?
3. **Visual**: quem clicou num vídeo com determinada estética reconhece a página como
   continuação (cores, rosto, produto)?
4. **Oferta e preço** citados no anúncio são os mesmos da página (inclusive moeda,
   desconto e condição)?
5. Vários criativos com ângulos **diferentes** apontam para a **mesma** página genérica?
   — cada ângulo forte merece uma variação de página (ou ao menos de headline).

Diferencial contra oferta fraca (ver [oferta-value-equation](oferta-value-equation.md)):
se o visitante **permanece**, rola a página e ainda assim não converte, o problema tende à
oferta; se ele **sai em segundos**, tende ao message match.

## Ação recomendada

1. **Alinhe a headline primeiro** — repetir a promessa do anúncio vencedor na primeira
   dobra é a mudança de maior alavancagem e a mais barata.
2. Traga o **ângulo do criativo vencedor** para o topo da página (dor/desejo nas mesmas
   palavras do anúncio).
3. Padronize a **continuidade visual** entre criativo e primeira dobra.
4. Se há múltiplos ângulos rodando, crie **variações de página por ângulo** antes de
   descartar criativos que "não convertem".
5. Formule como experimento: hipótese ("a queda pós-clique vem da quebra de promessa"),
   mudança única, período, critério de sucesso (taxa página→checkout) — registrado na
   memória de experimentos.

## Riscos e limites

- Trust 4: princípio direcional bem estabelecido, **sem percentual garantido** — nunca
  prometer ganho numérico; o critério de sucesso vem do experimento do próprio cliente.
- Congruência não conserta **promessa fraca**: alinhar a página a um anúncio cuja oferta
  não sustenta a promessa só move o problema (e pode configurar expectativa enganosa —
  atenção às políticas da Meta sobre práticas enganosas no corpus `meta-ads-docs`).
- Diagnóstico depende de dados de comportamento na página (bounce/rolagem/checkout
  iniciado); sem eles, o motor deve pedir esses dados via `missing_data` em vez de supor.
