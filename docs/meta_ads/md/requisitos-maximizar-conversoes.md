---
title: "Otimização e Maximização de Valor"
description: "Otimização e maximização do valor das conversões: como funciona a otimização de valor, requisitos oficiais para web e app, estratégia valor vs volume e passagem de parâmetros dinâmicos de valor."
tags: [value-optimization, bidding, requirements, custom-data]
related: [boas-praticas-roas, configurar-maximizacao-conversoes, parameters]
---

[← Voltar ao índice](INDEX.md)

# Otimização e Maximização de Valor

Aprenda a configurar a meta de desempenho de "Maximizar o valor das conversões". Descubra os requisitos oficiais para Web e App, e aprenda a passar parâmetros dinâmicos de valor.

## Como funciona a Otimização de Valor

Em vez de focar no menor custo por conversão bruta (volume), a otimização de valor direciona o orçamento aos usuários com propensão a gerar **carrinhos maiores, assinaturas caras ou maior Lifetime Value (LTV)**. Isso aumenta o ticket médio e otimiza o ROAS.

Verificador de Qualificação Técnica

Plataforma Website: Compras (Pixel/CAPI) Website: Eventos Personalizados App: Compras no App (SDK) App: Impressão de Anúncios Conversões (Período) Valores Distintos

Elegível Pronto para Otimização

Sua conta de anúncios atende perfeitamente aos requisitos recomendados para maximizar o valor das conversões.

## Simulador de Estratégia: Valor vs. Volume

Veja como o algoritmo da Meta altera a entrega do orçamento e o perfil do público conforme você move a barra entre a busca por quantidade de vendas e qualidade de ticket:

Seletor de Prioridade de Campanha

Foco em Valor (70%)

R$ 48,00 Custo por Aquisição (CPA)

R$ 290,00 Ticket Médio (AOV)

6.0x ROAS Estimado

## Guia de Implementação de Parâmetros

Para otimizar o valor, você deve enviar os valores de compra (`value`) e a respectiva moeda (`currency`) em cada evento. Veja como estruturar o código:

Insira os parâmetros dinâmicos no disparador do evento de compra do Pixel na sua página de obrigado:

fbq('track', 'Purchase', { value: 129.90, // Passar valor dinâmico do checkout currency: 'BRL', // ISO Currency Code content_name: 'Curso Avançado de Tráfego', content_type: 'product' });

Para assinaturas (SaaS ou clubes), envie o valor estimado do Lifetime Value (LTV) ou a primeira mensalidade no evento standard:

fbq('track', 'Subscribe', { value: 490.00, // LTV modelado ou valor do plano anual currency: 'BRL', predicted_ltv: true // Sinalizador técnico de valor estimado });

No SDK de Aplicativos, configure os eventos de `AppEventName.PURCHASE` mapeados nas configurações do painel:

// iOS Swift Example AppEvents.shared.logEvent(.purchased, parameters: [ AppEvents.ParameterName.rawValue: 19.99, AppEvents.ParameterName.currency: "USD" ])

#### Requisitos para Contas Novas

Para prevenir fraudes e proteger a estabilidade do leilão, a Meta concede o acesso à meta de desempenho de "Valor" apenas a contas de anúncios que cumprem os requisitos de integridade e histórico de veiculação. Contas novas devem primeiro gerar histórico otimizando campanhas para "Volume de Conversões" antes que a otimização de valor seja desbloqueada.
