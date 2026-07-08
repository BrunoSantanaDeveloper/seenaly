---
title: "Sobre conversões personalizadas para a web"
description: "Conversões personalizadas para web: regras sobre eventos ou URLs para medir ações específicas (ex.: compras acima de US$ 40), uso como meta de desempenho em campanhas e compartilhamento seletivo com parceiros. Não disponível para eventos de app."
tags: [custom-conversions, web-events, rules, performance-goal]
related: [conversion-traking, eventos-padrao-site, gerenciador-eventos]
captured: 2026-06-23
---

# Sobre conversões personalizadas para a web

> Este artigo aborda conversões personalizadas para eventos do site. No momento, conversões personalizadas não estão disponíveis para eventos do app.

Com conversões personalizadas, você cria regras para eventos e mede ações mais específicas dos clientes. Por exemplo, em vez de mensurar todas as compras, é possível filtrar apenas compras de calçados femininos acima de US$ 40.

Depois de criadas, as conversões personalizadas podem ser usadas como metas de desempenho para ajudar a Meta a alcançar pessoas com maior probabilidade de realizar as ações importantes para o negócio.

## Benefícios

- **Filtrar eventos.** Adicione regras a eventos padrão, eventos personalizados ou a todo o tráfego do URL para entender ações dos clientes com mais detalhe, como compras de uma cor, categoria ou faixa de preço específica.

- **Configurar eventos padrão sem código adicional.** Se o código base do [Pixel da Meta](meta-pixel.md) já estiver instalado, você pode usar regras de URL para registrar eventos padrão sem adicionar novos trechos de código ao site.

- **Usar como meta de desempenho.** No Gerenciador de Anúncios da Meta, você pode selecionar uma conversão personalizada como meta de desempenho ao criar campanhas.

- **Controlar o compartilhamento com parceiros.** Em vez de compartilhar toda a fonte de dados, você pode compartilhar conversões personalizadas individuais com parceiros de negócio.

## Exemplo

Uma loja online de roupas quer acompanhar vendas de vestuário masculino acima de US$ 50. Para isso, ela cria uma conversão personalizada acionada quando alguém compra esse tipo de item.

1. **Regra de URL:** o URL em que a compra ocorre contém a palavra-chave "masculino".

2. **Regra baseada em parâmetro:** o parâmetro de valor é maior que US$ 50.

Depois que essa conversão personalizada receber eventos suficientes, ela poderá ser usada como meta de desempenho. Assim, a Meta pode mostrar anúncios para pessoas com maior probabilidade de comprar itens de vestuário masculino acima de US$ 50.

## Como criar

Antes de criar conversões personalizadas, revise quais eventos e parâmetros estão sendo enviados pelo site. A configuração pode ser usada para dois objetivos principais:

- Filtrar eventos do site com regras mais específicas.

- Configurar eventos padrão usando regras de URL, sem adicionar código extra ao site.

## Como gerenciar

Para editar, excluir ou compartilhar conversões personalizadas, use o [Gerenciador de Eventos da Meta](gerenciador-eventos.md).

> **Observação:** se você criar uma conversão personalizada usando uma conta de anúncios que faz parte de um portfólio empresarial, pessoas com acesso ao portfólio podem ver ou gerenciar conversões personalizadas na conta de anúncios e no portfólio. Pessoas com acesso apenas à conta de anúncios só podem ver ou gerenciar conversões criadas por essa conta.

## Saiba mais

- [Eventos padrão e personalizados do site](eventos-padrao-site.md)

- [Eventos padrão do Pixel da Meta](eventos-padrao-pixel.md)

- [Rastreamento de conversão](conversion-traking.md)
