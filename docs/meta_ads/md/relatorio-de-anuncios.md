---
title: "Mensagens no produto nos relatórios (SKAdNetwork e modelagem estatística)"
description: "Explicação das notas exibidas nos relatórios do Gerenciador de Anúncios: conversões recebidas via API SKAdNetwork da Apple (campanhas iOS 14+) e uso de modelagem estatística quando dados de conversão são parciais ou ausentes."
tags: [ads-reporting, skadnetwork, ios, statistical-modeling, attribution]
related: [gerenciador-relatorios, diferenca-entre-contagem-eventos]
captured: 2026-06-23
---

[← Voltar ao Índice](INDEX.md)

Ao visualizar seus relatórios no Gerenciador de Anúncios da Meta ou nos Relatórios de Anúncios , às vezes você pode ver mensagens no produto. Passe o ponteiro do mouse sobre uma mensagem no produto para ver uma breve explicação ou confira o conteúdo a seguir para saber mais.

## Como funcionam os relatórios da API SKAdNetwork

> [1] Nota: as tecnologias da Meta recebem essas conversões por meio da API SKAdNetwork da Apple.

Usamos essa nota para informar que tais resultados não são registrados diretamente pela Meta. Em campanhas de promoção do app no iOS 14 ou versão posterior, podemos usar dados da API SKAdNetwork da Apple para enviar informações sobre instalações de apps para celular e outros eventos de apps.

### Limitações dos dados da API SKAdNetwork

- Os resultados são baseados no momento em que a API SKAdNetwork da Apple envia as conversões para as tecnologias da Meta.

- Os dados da API SKAdNetwork da Apple serão limitados. Saiba mais sobre essas limitações.

- A modelagem estatística pode ser usada para contabilizar algumas conversões após a instalação.

## Como entender a modelagem estatística

> [2] Para oferecer uma visão mais completa do seu desempenho, podemos usar modelos estatísticos em que os dados de conversão podem ser parciais ou estar ausentes, provavelmente devido a mudanças regulatórias ou do setor. Saiba mais .

Usamos esta nota para informar que, em alguns casos em que faltam dados do evento ou eles são parciais, a modelagem estatística pode ser usada para fornecer uma visão mais abrangente dos resultados.

A modelagem usa dados de várias fontes diferentes para mensurar a atividade que pode estar faltando ou estar parcial. Nos casos em que a modelagem estatística não é usada, os resultados podem não incluir todas as conversões.
