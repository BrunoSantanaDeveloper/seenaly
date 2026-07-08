---
title: "Entendendo o Relatório de CBO (Orçamento Advantage+)"
description: "Como ler o relatório de campanhas com orçamento Advantage+ (CBO): por que comparar custo médio por evento entre conjuntos é erro de análise, e como a distribuição maximiza o volume total (estudo de caso dos US$ 30)."
tags: [cbo, campaign-budget, reporting, analysis]
related: [configurar-orcamento-advantage, meta-advantage-plus-budget, gerenciador-relatorios]
---

[← Voltar ao índice](INDEX.md)

# Entendendo o Relatório de CBO (Orçamento Advantage+)

Por que comparar o custo médio por evento de otimização entre conjuntos de anúncios é um erro de análise, e como a distribuição inteligente maximiza o volume total de conversões.

## Resumo da Regra de Análise

**Nunca avalie a distribuição de orçamento comparando CPAs individuais de conjuntos de anúncios.** Ao utilizar o Orçamento de Campanha Advantage+ com lances de *Volume Mais Alto*, a Meta busca o menor custo por conversão no nível consolidado da campanha, e não para cada conjunto isoladamente.

**O Erro Clássico:** Desativar um conjunto de anúncios porque o custo médio dele parece alto. Fazer isso quase sempre força a campanha a comprar conversões ainda mais caras em outros conjuntos, elevando o custo final.

### O Algoritmo de Volume

A estratégia de Volume Mais Alto busca as conversões mais baratas primeiro. À medida que essas oportunidades baratas se esgotam em um público, o sistema passa a comprar conversões um pouco mais caras para continuar gastando o orçamento.

### Disparidade de Públicos

Cada público (conjunto de anúncios) possui curvas de custo de conversão diferentes. Um público pode conter apenas 2 conversões baratas, enquanto outro público pode conter 10 conversões de preço médio porém muito mais estáveis.

## Simulador de Oportunidades (O Estudo de Caso de US$ 30)

Para entender a lógica bayesiana da Meta, analise esta simulação interativa baseada no exemplo oficial da Central de Ajuda. Suponha que temos **US$ 30** de orçamento e **15 oportunidades de conversão** distribuídas entre três conjuntos de anúncios:

*Nota: Nos relatórios reais do Gerenciador de Anúncios, dados de oportunidades perdidas e custos individuais por leilão não são exibidos (o sistema exibe apenas o CPA médio final).*

- **Conjunto A:** 4 oportunidades estáveis de US$ 5 cada.

- **Conjunto B:** 6 oportunidades baratas de US$ 2 cada.

- **Conjunto C:** 3 oportunidades de US$ 1, uma de US$ 7 e outra de US$ 8.

Selecione uma Estrutura de Distribuição de Verba:

Mapeamento de Compras (Verde: Comprado / Vermelho: Rejeitado por custo / Cinza: Não comprado)

Conjunto A

Conjunto B

Conjunto C

Total de Conversões 12

Gasto Total US$ 30

CPA Médio da Campanha US$ 2.50

Performance CBO: 12 Conversões a um custo médio geral de US$ 2.50 por resultado. **Análise CBO:** A inteligência artificial da Meta adquire todas as conversões de US$ 1 (C), US$ 2 (B) e US$ 5 (A). Ela decide gastar US$ 15 no Conjunto A (CPA de US$ 5), mas isso evita a necessidade de comprar as conversões de US$ 7 e US$ 8 que restavam no Conjunto C. O resultado final são 12 conversões.

## Conclusões Fundamentais

Ao analisar os resultados acima, note duas lições importantes:

1. **O Custo por Conjunto não reflete Eficiência:** No Cenário 1, o Conjunto C gastou apenas US$ 3 e teve CPA de US$ 1. Já o Conjunto A gastou US$ 15 e teve CPA de US$ 5. Um analista inexperiente desligaria o Conjunto A. Porém, se fizermos isso (Cenário 2), o custo geral sobe para US$ 2.73 e geramos uma conversão a menos, pois somos obrigados a comprar as oportunidades inflacionadas de US$ 7 e US$ 8 no Conjunto C.

2. **Orçamentos Fixos Reduzem Conversões:** Dividir o orçamento igualmente (Cenário 3) impossibilita a transferência de saldo. O Conjunto B bate o teto de US$ 10 e deixa uma conversão de US$ 2 de fora, enquanto o Conjunto C é forçado a comprar conversões caras de US$ 7 apenas para bater sua cota de US$ 10.
