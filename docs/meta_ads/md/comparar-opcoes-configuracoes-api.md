---
title: "Comparar as opções de configuração da API de Conversões"
description: "Comparação das opções de configuração da API de Conversões — habilitada pela Meta, integração direta e parceiros — por custo, tempo de implementação, recursos necessários e fontes de eventos suportadas, com orientação de escolha."
tags: [capi, setup-options, comparison, partner-integrations, direct-integration]
related: [api-conversao, como-decidir-conjunto-dados, como-preparar-empresa-para-api]
captured: 2026-06-23
---

# Comparar as opções de configuração da API de Conversões

> Para configurar eventos de app para celular ou loja física (offline) pela API de Conversões, a integração direta é a única opção disponível no momento.

Há várias formas de configurar a [API de Conversões](api-conversao.md). A melhor opção depende da origem dos eventos, do nível de controle desejado, do custo de implementação e dos recursos técnicos disponíveis.

## Opções de configuração

- **API de Conversões habilitada pela Meta.** Configuração somente para web que cria automaticamente uma conexão do lado do servidor para enviar dados da web junto com o Pixel da Meta.

- **Integração direta usando programação.** Oferece mais controle sobre a integração, mas exige desenvolvedor e infraestrutura para enviar eventos para a Meta em tempo real.

- **Integrações de parceiros.** Incluem plataformas de comércio, parceiros da Meta, parceiros de mensagens e parceiros de CRM. A disponibilidade, o custo e os recursos variam conforme o parceiro.

## Comparação por custo e dificuldade

| Critério | API habilitada pela Meta | Integração direta | Parceiros da Meta |
| --- | --- | --- | --- |
| Custo | Grátis | Varia conforme custos de desenvolvimento e manutenção. | Depende do parceiro. |
| Tempo de implementação | Um clique. | Duas a quatro semanas para novas integrações; uma a duas semanas para atualizar integrações existentes. | Depende do parceiro. |
| Recursos necessários | Pixel da Meta. | Desenvolvedor. | Dependem do parceiro. |
| Outros requisitos | Nenhum. | Infraestrutura para enviar eventos em tempo real para a Meta. | Dependem do parceiro. |

## Comparação por recursos

| Recurso | API habilitada pela Meta | Integração direta | Parceiros da Meta |
| --- | --- | --- | --- |
| Fonte da ação compatível | Web. | Web, app, offline, CRM e mensagens comerciais. | Depende do parceiro. |
| Seleção de eventos | Eventos compartilhados pelo Pixel da Meta também são compartilhados pela API e desduplicados automaticamente. | Configurável. | Depende do parceiro. |
| Parâmetros enviados | Parâmetros compartilhados pelo Pixel também são compartilhados pela API habilitada pela Meta. | Configurável. | Depende do parceiro. |

## Quando escolher cada opção

- **Escolha API habilitada pela Meta** quando você precisa de uma opção web simples, rápida e sem desenvolvimento adicional.

- **Escolha integração direta** quando precisa enviar eventos de app, offline, CRM ou mensagens, ou quando precisa de controle detalhado sobre eventos e parâmetros.

- **Escolha parceiros** quando sua plataforma ou fornecedor já oferece uma integração pronta e adequada ao seu caso de uso.

## Saiba mais

- [Sobre a API de Conversões](api-conversao.md)

- [Como decidir qual conjunto de dados criar](como-decidir-conjunto-dados.md)

- [Boas práticas da API de Conversões](boas-praticas-api-conversao.md)

- [Conjuntos de dados no Gerenciador de Eventos](conjunto-dados.md)
