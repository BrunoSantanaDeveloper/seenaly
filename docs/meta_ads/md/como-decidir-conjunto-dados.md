---
title: "Como decidir qual opção de criação de conjunto de dados é certa para sua empresa"
description: "Matriz de decisão para criar ou selecionar um conjunto de dados conforme as fontes de eventos (app, site, offline, mensagens e combinações) e qual identificação usar ao configurar a API de Conversões."
tags: [capi, datasets, decision-matrix, setup]
related: [conjunto-dados, comparar-opcoes-configuracoes-api, api-conversao]
captured: 2026-06-23
---

# Como decidir qual opção de criação de conjunto de dados é certa para sua empresa

Existem várias formas de criar um [conjunto de dados](conjunto-dados.md) e configurar a [API de Conversões](api-conversao.md), dependendo dos tipos de eventos que você deseja enviar.

Use a matriz abaixo para decidir como criar o conjunto de dados, qual identificação usar e como encaminhar a configuração da API de Conversões.

> **Para integrações diretas existentes:** se a API de Conversões já foi configurada por integração direta, você pode atualizar a configuração adicionando novos tipos de eventos ao código. Os parâmetros obrigatórios variam conforme o tipo de evento.

## Processo geral

1. **Determine quais eventos deseja enviar.** Identifique se os eventos vêm de site, app, offline, mensagens ou combinações dessas fontes.

2. **Crie ou selecione um conjunto de dados.** A opção depende da origem dos eventos e das integrações existentes.

3. **Configure a API de Conversões.** Use a identificação correta e encaminhe instruções personalizadas para quem implementar.

## Matriz de decisão

| Eventos que deseja enviar | Como criar ou selecionar o conjunto de dados | Identificação e configuração da API |
| --- | --- | --- |
| Apenas app | Crie um conjunto de dados por meio de um app existente e selecione **Criar novo**. | Use a nova identificação do conjunto de dados no Gerenciador de Eventos para configurar a API de Conversões e os eventos. |
| Apenas site | Não é necessário criar um conjunto de dados novo, mas o Pixel da Meta precisa existir e estar instalado. | Use a identificação do Pixel da Meta para configurar a API de Conversões. |
| Apenas offline | Crie um conjunto de dados para conectar eventos offline. | Use a nova identificação do conjunto de dados para configurar a API e os eventos offline. |
| App e site | Crie um conjunto de dados por meio de um app existente e selecione **Criar a partir de uma identificação do pixel**. | A identificação do conjunto de dados será igual à identificação do pixel. A identificação do app permanece a mesma. |
| App e offline | Crie um conjunto de dados para eventos offline e vincule um app ao conjunto de dados. | Use a nova identificação do conjunto de dados para a API de Conversões. |
| Site e offline | Crie um conjunto de dados para conectar eventos offline. | Use a identificação do conjunto de dados no Gerenciador de Eventos para configurar a API. |
| Site, app e offline | Crie um conjunto de dados por meio de um app existente e selecione **Criar a partir de uma identificação do pixel**. | A identificação do conjunto de dados será igual à do pixel, enquanto a identificação do app permanece igual. |
| Apenas mensagens ou mensagens e site | Crie um conjunto de dados durante a criação do conjunto de eventos de mensagens. | Use a identificação do conjunto de dados para configurar a API de Conversões e os eventos. |
| Mensagens, site, app e offline | Crie o conjunto de dados durante a criação do conjunto de eventos de mensagens e depois vincule um app. | Use a identificação do conjunto de dados no Gerenciador de Eventos para configurar a API. |

## Próximo passo

Depois de escolher a opção correta, crie instruções personalizadas de integração direta no Gerenciador de Eventos e envie para o desenvolvedor. Se preferir, consulte a documentação técnica da Meta for Developers para configurar uma integração direta.

## Saiba mais

- [Conjuntos de dados no Gerenciador de Eventos](conjunto-dados.md)

- [Comparar opções de configuração da API de Conversões](comparar-opcoes-configuracoes-api.md)

- [Sobre a API de Conversões](api-conversao.md)
