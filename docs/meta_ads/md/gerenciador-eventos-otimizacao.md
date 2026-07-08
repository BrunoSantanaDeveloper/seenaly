---
title: "Eventos de otimização"
description: "Métrica Eventos de otimização: o que é o evento de otimização escolhido no conjunto de anúncios, relação com estratégia de lance e janela de conversão, e a referência de ~50 eventos desde a última edição significativa para veiculação estável."
tags: [ads-manager, optimization-event, metrics, bidding, attribution-window]
related: [gerenciador-fase-aprendizado, gerenciador-edicoes-significativas, estrategias-de-lance]
captured: 2026-06-23
---

# Eventos de otimização

## Como essa métrica é usada

Essa métrica mostra como uma estratégia de lance está atingindo as metas com base nos critérios de otimização atuais.

O evento de otimização é escolhido nos conjuntos de anúncios. Ele é o resultado dos lances que nosso sistema faz no leilão de anúncios e pode ser diferente do objetivo da campanha. Por exemplo, você pode escolher vendas como o objetivo da campanha, mas optar por otimizar para cliques no link em um conjunto de anúncios. É importante que você escolha sua estratégia de lances considerando o evento de otimização. Isso ajuda nosso sistema a mostrar anúncios para as pessoas com maior probabilidade de proporcionar o resultado para o qual você está otimizando na janela de conversão selecionada.

Pode ser útil avaliar o número de eventos de otimização recebidos desde a última edição significativa. Por exemplo, se você estiver usando o custo por evento de otimização para determinar a estratégia de lances de custo-alvo, verifique se há eventos de otimização suficientes desde a última edição significativa para indicar uma veiculação estável. Recomendamos cerca de 50 eventos de otimização, mas alguns conjuntos de anúncios se estabilizam mais cedo.

## Como o cálculo é feito

Essa métrica é calculada como o número de eventos otimizados que ocorreram durante a janela de conversão escolhida.

Para resultados em que o tempo pode passar entre quando alguém vê o anúncio e quando o evento ocorre, aMetausa uma janela de atribuição que corresponde à janela de conversão escolhida durante a criação do conjunto de anúncios. Por exemplo, se você escolher uma janela de conversão de cliques de um dia e de visualização de sete dias ao criar um conjunto de anúncios, essa métrica usará uma janela de atribuição de cliques de um dia e de visualização de sete dias para contar os resultados.

## Métricas relacionadas

- Custo por evento de otimização

- Última edição significativa
