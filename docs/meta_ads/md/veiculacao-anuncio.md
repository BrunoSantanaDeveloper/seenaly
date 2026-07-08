---
title: "O Mecanismo de Veiculação de Anúncios"
description: "Mecanismo de veiculação de anúncios: leilão (lance total = lance × taxa de ação estimada + valor para o usuário), loop de aprendizado de máquina e diagnóstico de problemas de veiculação."
tags: [ad-auction, delivery, machine-learning, diagnostics]
related: [estrategias-de-lance, gerenciador-fase-aprendizado, dicas-anuncios]
---

[← Voltar ao índice](INDEX.md)

# O Mecanismo de Veiculação de Anúncios

Descubra como o sistema de leilão bayesiano e as redes neurais de aprendizado de máquina da Meta decidem quando, onde e para quem exibir seus anúncios.

## Como Funciona o Leilão?

Sempre que há uma oportunidade de mostrar um anúncio para um usuário no ecossistema da Meta (Facebook, Instagram, Messenger, Audience Network), ocorre um **leilão instantâneo em milissegundos** para determinar qual campanha vencerá a inserção.

Diferente de leilões convencionais baseados apenas em quem paga mais, o leilão da Meta prioriza a **experiência do usuário** e a **relevância da oferta**. A fórmula básica do valor total considera:

1

### Lance

O lance financeiro configurado pelo anunciante (manual ou automatizado de menor custo).

2

### Ação Estimada

A probabilidade de o usuário realizar a ação desejada (clique, lead ou compra).

3

### Valor do Usuário

Qualidade do criativo, histórico de feedback negativo e relevância do pós-clique.

4

### Entrega

O anúncio vencedor do leilão é veiculado pelo menor custo necessário para superar o segundo colocado.

## O Loop de Aprendizado de Máquina (Feedback Loop)

O sistema de veiculação utiliza aprendizado de máquina contínuo. **A cada nova impressão de anúncio, o algoritmo refina sua estimativa de relevância.** Quanto mais dados a inteligência artificial coleta, mais precisa se torna a segmentação de compradores de alto valor pelo menor CPA.

### Simulador da Fase de Aprendizado

Clique no botão abaixo para simular a veiculação de novas impressões de anúncio e observe como o algoritmo calibra a precisão do CPA em tempo real.

Impressões Simuladas: 1 Precisão da IA: 4%

CPA Estável Estimado: R$ 95,00 Fase de Aprendizado (Instável)

## Diagnóstico e Solução de Problemas de Veiculação

Se suas campanhas não estiverem veiculando ou apresentando variações indesejadas de custo, avalie estes diagnósticos fundamentais do sistema:

Ad Sets com Múltiplos Criativos

Ao inserir vários anúncios em um mesmo conjunto, o sistema distribui a verba de forma desigual, focando quase que inteiramente na peça que o algoritmo prevê que gerará o menor custo inicial por conversão. Evite forçar a entrega igualitária.

CPA do Conjunto vs. Volume Geral

Às vezes, o conjunto de anúncios com maior volume de vendas não é o que apresenta o menor CPA isolado. Isso ocorre porque o sistema esgotou as oportunidades fáceis e continuou escalando para obter o maior volume agregado viável.

Fase de Aprendizado Limitado

Caso um conjunto de anúncios não alcance 50 eventos de conversão no intervalo de 7 dias, a veiculação entrará em estado de aprendizado limitado, exigindo que você amplie os públicos, mude a otimização de conversão ou una conjuntos semelhantes.

Diagnóstico de Relevância

Filtre relatórios pela classificação de qualidade, taxa de engajamento e taxa de conversão em relação aos concorrentes. Peças abaixo da média aumentam o custo do leilão artificialmente.
