---
title: "Sobre conjuntos de dados no Gerenciador de Eventos da Meta"
description: "Sobre conjuntos de dados no Gerenciador de Eventos: visualização unificada de eventos de site, app, offline e mensagens, como funciona a identificação (relação com pixel e app) e integrações compatíveis por origem."
tags: [datasets, events-manager, capi, pixel, sdk]
related: [como-decidir-conjunto-dados, gerenciador-eventos, api-conversao]
captured: 2026-06-23
---

# Sobre conjuntos de dados no Gerenciador de Eventos da Meta

> A Meta está introduzindo mudanças gradualmente em como dados de eventos aparecem no Gerenciador de Eventos. Eventos da web, app, offline e mensagens podem ser mesclados em uma visualização única chamada conjunto de dados.

Conjuntos de dados permitem conectar e gerenciar dados de eventos de diferentes origens, como site, app para celular, estabelecimento físico e chats comerciais, em um só lugar.

Eventos são ações realizadas nas experiências do cliente. Esses dados podem ser enviados por integrações como Pixel da Meta, API de Conversões ou SDK do Facebook para iOS e Android.

## Como os conjuntos de dados funcionam

Ao criar um conjunto de dados, você recebe uma identificação do conjunto de dados. Essa identificação pode ser usada para configurar integrações e visualizar eventos no [Gerenciador de Eventos](gerenciador-eventos.md).

- Se um pixel existente estiver vinculado ao conjunto de dados, a identificação do conjunto de dados pode ser a mesma identificação do pixel.

- Se não houver pixel vinculado, você recebe uma nova identificação do conjunto de dados.

- Se houver um app, a identificação do app permanece a mesma e pode ser vinculada ao conjunto de dados.

## Integrações compatíveis

### Site

Pixel da Meta e API de Conversões para eventos do site.

### App

SDK do Facebook para iOS ou Android, Parceiros de Métricas para Aplicativos e API de Eventos do App.

### Offline

Carregamento de arquivo CSV e dados de eventos offline.

### Mensagens

API de Conversões para eventos de mensagens em chats comerciais.

Para conectar eventos do app ao conjunto de dados, primeiro vincule a identificação do app para dispositivos móveis ao conjunto de dados. Também pode haver opção para vincular novamente a identificação do app.

## Benefícios

- **Visualizar atividade do cliente em um só lugar.** Em vez de manter identificações separadas para cada integração, você pode usar uma identificação de conjunto de dados para representar eventos de site, app, offline e mensagens.

- **Gerenciar configurações com menos fragmentação.** O conjunto de dados ajuda a monitorar eventos e administrar integrações em uma visualização centralizada.

- **Reduzir integrações de API separadas.** Ao criar um conjunto de dados e vincular o app, a API de Conversões pode conectar dados de eventos do site, app, offline e mensagens em uma integração mais unificada.

> **Impacto em campanhas:** criar um conjunto de dados não deve impactar a otimização nem os relatórios de campanhas no Gerenciador de Anúncios.

## Saiba mais

- [Gerenciador de Eventos da Meta](gerenciador-eventos.md)

- [Sobre a API de Conversões](api-conversao.md)

- [Eventos do app](eventos-app.md)

- [Conversões offline](conversoes-offline.md)
