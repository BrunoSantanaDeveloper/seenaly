---
title: "Estratégia: Meta de Custo por Resultado"
description: "Estratégia de Meta de Custo por Resultado: como definir o CPA-alvo, playbook de otimização, diretrizes de escala e maturação, e comparativo com Volume Mais Alto."
tags: [cost-cap, bidding, cpa, scaling, strategy]
related: [estrategias-de-lance, boas-praticas-roas, meta-desempenho]
---

[← Voltar ao índice](INDEX.md)

# Estratégia: Meta de Custo por Resultado

Controle seus custos de aquisição médios mantendo a escala com lances flexíveis calibrados por inteligência artificial.

## Sobre a Estratégia de Meta de Custo

A **Meta de Custo por Resultado** (antiga estratégia de limite de custo) ajuda você a obter o maior volume de conversões possível mantendo o custo por resultado (CPA) médio semanal próximo ao valor que você definiu como meta.

Ao contrário dos limites rígidos de lances individuais, a Meta de Custo permite oscilações positivas no leilão. O algoritmo dará lances um pouco maiores quando as conversões tiverem alta chance de fechamento, compensando com lances menores em oportunidades baratas para manter a média de CPA sob controle.

Simulador de Meta de Custo Insira suas configurações de campanha e veja a estimativa de entrega e o comportamento dos lances dinâmicos nos leilões.

Meta de CPA Desejada (R$) Orçamento Diário (R$) Competitividade do Mercado Baixa Competição (Mercado Estável) Alta Competição (Mercado Inflacionado)

Lance Máximo Dinâmico R$ 48,00

Previsão de Gastos 100%

Conversões Semanais 35

**Comportamento dos Lances:** Em mercados altamente competitivos, o algoritmo dará lances de até R$ 48,00 (1.2x a meta) para vencer leilões mais difíceis, buscando manter a média geral em torno de R$ 40,00. O orçamento diário de R$ 200,00 é suficiente para cobrir os leilões necessários.

#### Requisito de Maturidade de Eventos (Fase de Aprendizado)

O algoritmo da Meta exige pelo menos **50 a 100 conversões semanais** por conjunto de anúncios para calibrar os lances dinâmicos com precisão. Se a sua campanha gerar menos de 50 eventos, os custos oscilarão excessivamente e a entrega poderá ser travada.

*Como resolver:* Se a entrega travar por falta de dados, amplie os públicos de direcionamento, aumente o orçamento diário ou aumente a sua meta de custo por resultado temporariamente.

## Como Definir o Valor da Sua Meta de CPA

O sucesso desta estratégia depende da precisão da meta inicial definida. Veja como calcular este valor de partida:

### Com Histórico de Dados

Comece configurando uma meta de CPA **10% a 20% maior** do que o seu custo médio histórico dos últimos 30 dias. Isso dá ao sistema de veiculação espaço suficiente para testar leilões antes de otimizar a escala.

*Exemplo:* Se o seu CPA histórico de compras é de R$ 20,00, defina a meta inicial em R$ 22,00 a R$ 24,00.

### Sem Histórico ou Em Transição

**Sem Histórico:** Rode uma campanha com a estratégia de *Volume Mais Alto* por 2 semanas. Use o CPA médio desse período como meta inicial.

**Migrando de Limite de Lance:** Limites de lance travam o lance máximo. Para a meta de custo, use o CPA médio real dos relatórios como partida, não o valor do antigo limite de lance.

## Playbook Estratégico: Otimização de Performance

Selecione um cenário abaixo para ver as recomendações da equipe de engenharia de anúncios da Meta:

Lance Limitado (Orçamento Sobrando)

Se seu conjunto de anúncios está gastando muito pouco e deixando saldo diário, isso indica que o algoritmo está travado para proteger sua meta de CPA:

- **Aumente a meta de CPA em 5% a 10%** para dar flexibilidade ao sistema nos leilões competitivos.

- Se o volume semanal for inferior a 50 conversões, **consolide conjuntos de anúncios** para unificar os sinais de conversão del Pixel.

## Diretrizes de Escala e Maturação

Antes de fazer ajustes de orçamento, siga o cronograma de segurança recomendado pela Meta:

Etapa 1: 3 Semanas

### Estabilização da Campanha

Mantenha a meta de custo ativa por pelo menos 3 semanas sem alterar orçamentos para que a veiculação atinja o estágio ideal de aprendizado.

Etapa 2: Gradual

### Escala de Orçamento

Aumente as verbas progressivamente para evitar reinícios bruscos na fase de aprendizado. Faça aumentos graduais.

Etapa 3: Janela Semanal

### Avaliação Pós-Mudança

Sempre aguarde pelo menos 7 dias após qualquer ajuste na meta de custo para reavaliar a performance geral.

## Comparativo: Meta de Custo vs. Volume Mais Alto

### Meta de Custo por Resultado

**Prioridade:** Eficiência de custo e garantia de CPA médio.

O sistema ajustará os lances visando a meta. Se o mercado ficar excessivamente competitivo e as oportunidades ultrapassarem muito a meta, o sistema reduzirá os gastos, preservando seu ROI.

### Volume Mais Alto (Sem Limite)

**Prioridade:** Escala máxima e consumo completo da verba.

Gasta 100% da verba contratada no período selecionado, adquirindo as conversões mais baratas disponíveis primeiro. Se o mercado inflacionar, o CPA geral aumentará sem teto.
