---
title: "Testes e Experimentos da Meta"
description: "Testes e experimentos da Meta: metodologias (A/B, holdout), validação de relevância estatística, construção de hipóteses e medição de lift incremental de vendas."
tags: [ab-testing, conversion-lift, incrementality, experiments, measurement]
related: [meta-performance-5-resultados, advantage-plus-shopping-course, amostragem-dados]
---

[← Voltar ao índice](INDEX.md)

# Testes e Experimentos da Meta

Compreenda a metodologia científica de testes da Meta. Aprenda a estruturar hipóteses corretas, validar relevância estatística e medir o lift incremental de vendas.

## Metodologias de Teste

O Gerenciador de Anúncios disponibiliza três estruturas formais de experimentação no hub **Experimentos**. Elas dividem o público de forma aleatória para garantir que os resultados sejam cientificamente válidos e livres de sobreposição.

Hub Metodológico: Escolha o Teste Ideal

#### O que faz

Compara até cinco versões de um anúncio variando uma única variável (criativo, texto, público ou posicionamento) para determinar qual é mais eficiente.

#### O que mensura

Custo por resultado (CPA) ou custo por conversion lift com base na principal métrica selecionada.

#### Requisitos mínimos

Disponível para qualquer conta de anúncios, sem limite de investimento diário.

#### Estratégia de Orçamento

Recomenda-se orçamento idêntico para ambas as versões. Se duplicar uma campanha ativa, a verba total será duplicada.

Roteamento de Audiência (Divisão 50/50)

Público Alvo ➞ Grupo A (50%)<br>Vê Criativo A Grupo B (50%)<br>Vê Criativo B ➞ Comparação de CPA

#### O que faz

Mede o impacto de conversões adicionais diretas causadas pela veiculação de anúncios da Meta, isolando compras que ocorreriam organicamente.

#### O que mensura

Vendas incrementais de conversão causadas diretamente pelos anúncios (conversion lift).

#### Requisitos mínimos

Integração de alta qualidade ativa de Pixel e/ou **API de Conversões** com sinal estável de dados.

#### Observação de CPM

Como mantém um grupo de controle impedido de ver anúncios, o CPM médio das campanhas pode sofrer oscilações técnicas durante o período.

Roteamento de Audiência (Grupo de Controle)

Público Alvo ➞ Grupo Teste (90%)<br>Vê os anúncios da Meta Grupo Controle (10%)<br>Bloqueado de ver os anúncios ➞ Cálculo de Conversão Incremental

#### O que faz

Mensura o impacto que a sua publicidade gera no reconhecimento de marca, recordação do anúncio ou na intenção de compra da sua marca no mercado.

#### O que mensura

Respostas obtidas a partir de enquetes e pesquisas integradas nativamente nos aplicativos da Meta.

#### Requisitos mínimos

Investimento mínimo cumulativo de **US$ 120.000** nos últimos 90 dias na conta de anúncios.

#### Metodologia

Assim como no Conversion Lift, o público é dividido em grupo de teste (vê anúncios) e controle (bloqueado). Ambos recebem enquetes após o leilão.

Roteamento de Pesquisa por Enquete

Público Alvo ➞ Grupo Teste (Exposto)<br>Responde enquete no app Grupo Controle (Não exposto)<br>Responde enquete no app ➞ Cálculo de Brand Lift

## Validador de Relevância Estatística

O rigor matemático determina se a diferença de performance entre as variações é resultado da eficácia estratégica ou de oscilações casuais.

Análise de Relevância Estatística

Selecione o tipo de teste e ajuste a porcentagem de confiança reportada no Gerenciador de Anúncios para validar os resultados:

Tipo de Teste Teste A/B Tradicional Teste de Lift (Conversion/Brand) Confiança Estatística (%) 70%

**Veredicto estatístico:** Confiável.

#### O Perigo dos Testes Informais (Ajustes Manuais)

**Nunca realize testes desligando ou ligando conjuntos de anúncios manualmente de forma livre.** Fazer testes informais causa sobreposição de públicos no leilão (os conjuntos concorrem entre si pelos mesmos usuários), distorce a curva de entrega da fase de aprendizado e invalida qualquer leitura de CPA.

Use sempre a ferramenta oficial de *Experimentos* ou as opções de duplicação com Teste A/B ativo para blindar as audiências contra sobreposição.

## Construtor de Hipóteses Científicas

Um bom experimento começa com uma hipótese clara, específica e acionável. Use nosso construtor para formular a sua:

Variável de Teste Formato do Criativo Público Alvo Posicionamento de Entrega Versão Vencedora Presumida Vídeo Vertical (Reels) Público de Interesse Amplo Posicionamentos Advantage+ Versão de Controle Imagem Estática Lista de Lookalike (1%) Posicionamentos de Feed Manual

Hipótese: O uso de Vídeo Vertical (Reels) gerará um menor custo por resultado comparado a Imagem Estática ao promover novos produtos.
