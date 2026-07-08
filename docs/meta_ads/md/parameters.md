---
title: "Parâmetros da API de Conversões"
description: "Referência completa dos parâmetros da API de Conversões por família: corpo principal, informações do cliente (com regras de hashing SHA-256), evento de servidor, dados de app — com obrigatoriedade de cada um."
tags: [capi, parameters, reference, hashing, user-data, custom-data]
related: [api-conversao, como-usar-api, detalhes-eventos-servidor, eventos-app]
captured: 2026-06-23
---

# Parâmetros da API de Conversões

Esta página agrupa os parâmetros da API de Conversões por família, cobrindo os parâmetros de dados de evento obrigatórios e os parâmetros adicionais que auxiliam na atribuição e na otimização de veiculação de anúncios.

> **Compatibilidade:** A API de Conversões suporta eventos de site (web), aplicativo (app), offline e mensagens comerciais (business messaging). Os eventos do site compartilhados por meio da API de Conversões exigem os parâmetros `client_user_agent`, `action_source` e `event_source_url`, enquanto os eventos não-web exigem apenas `action_source`.

## Parâmetros do Corpo Principal (Main Body)

Estes são os parâmetros de nível superior enviados na requisição POST da API de Conversões.

- `data` — Array de objetos de eventos do servidor. **[Obrigatório]**

- `test_event_code` — Código usado para testar eventos no Gerenciador de Eventos. **[Opcional]**

## Parâmetros de Informações do Cliente (Customer Information)

Utilizados para fazer a correspondência entre os eventos enviados do seu servidor e as contas de usuário da Meta. Muitos desses parâmetros exigem criptografia SHA256 (hashing) antes do envio.

- `em` — Endereço de e-mail do cliente. **[Hash Obrigatório]**

- `ph` — Número de telefone do cliente. **[Hash Obrigatório]**

- `fn` — Primeiro nome do cliente. **[Hash Obrigatório]**

- `ln` — Sobrenome do cliente. **[Hash Obrigatório]**

- `ge` — Gênero do cliente (m ou f). **[Hash Obrigatório]**

- `db` — Data de nascimento (AAAAMMDD). **[Hash Obrigatório]**

- `ct` — Cidade do cliente. **[Hash Obrigatório]**

- `st` — Estado do cliente (ex: SP, RJ). **[Hash Obrigatório]**

- `zp` — Código postal / CEP do cliente. **[Hash Obrigatório]**

- `country` — Código do país com duas letras em minúsculo. **[Hash Obrigatório]**

- `external_id` — ID exclusivo fornecido pelo anunciante para identificar o cliente. **[Hash Recomendado]**

- `client_ip_address` — Endereço IP do dispositivo do cliente. **[Não Criptografar]**

- `client_user_agent` — User Agent do navegador do cliente. **[Não Criptografar]**

- `fbc` — ID do clique do Facebook (contém o parâmetro fbclid). **[Não Criptografar]**

- `fbp` — ID do navegador do Facebook (gerado automaticamente pelo pixel). **[Não Criptografar]**

- `subscription_id` — ID da assinatura do cliente. **[Não Criptografar]**

- `fb_login_id` — ID de login do Facebook do usuário. **[Não Criptografar]**

- `lead_id` — ID do lead gerado pelas campanhas de geração de cadastro. **[Não Criptografar]**

- `anon_id` — ID de instalação do aplicativo (exclusivo para app). **[Não Criptografar]**

- `madid` — ID do anunciante móvel (exclusivo para app). **[Não Criptografar]**

- `page_id` — ID da página do Facebook associada à sua empresa. **[Não Criptografar]**

- `page_scoped_user_id` — ID do usuário no escopo da página para mensagens comerciais. **[Não Criptografar]**

- `ctwa_clid` — ID de clique de anúncio de Clique para WhatsApp. **[Não Criptografar]**

- `ig_account_id` — ID da conta empresarial do Instagram. **[Não Criptografar]**

- `ig_sid` — ID de clique de anúncio de Clique para Instagram. **[Não Criptografar]**

## Parâmetros de Evento do Servidor (Server Event)

Descrevem as ações que o cliente realiza no seu site, aplicativo ou canais físicos.

- `event_name` — O nome de um evento padrão ou personalizado da Meta (ex: Purchase, Lead). **[Obrigatório]**

- `event_time` — Timestamp Unix em segundos indicando o momento exato em que o evento ocorreu. **[Obrigatório]**

- `user_data` — Objeto contendo os parâmetros de informações do cliente. **[Obrigatório]**

- `custom_data` — Objeto contendo dados personalizados adicionais (como valor, moeda, itens comprados). **[Recomendado]**

- `event_source_url` — A URL da página web onde o evento ocorreu. Exigido para eventos do site. **[Condicional]**

- `action_source` — Indica a origem física da ação (email, website, app, phone, physical_store, system_generated, chat). **[Obrigatório]**

- `event_id` — String exclusiva usada para a desduplicação de eventos idênticos. **[Altamente Recomendado]**

- `opt_out` — Parâmetro opcional para indicar que o usuário optou por não ter seus dados rastreados. **[Opcional]**

- `data_processing_options` — Opções de processamento de dados para conformidade com leis de privacidade (como a CCPA). **[Opcional]**

## Parâmetros de Dados de Aplicativo (App Data)

Específicos para a integração e monitoramento de eventos que ocorrem em aplicativos nativos móveis.

- `advertiser_tracking_enabled` — Indica se o rastreamento do anunciante móvel está ativo (0 ou 1).

- `application_tracking_enabled` — Indica se o rastreamento do aplicativo móvel está ativo (0 ou 1).

- `extinfo` — Array de informações do aplicativo móvel (como versão, nome do app, largura/altura de tela).

*Nota técnica: Para orientação detalhada sobre como integrar esses parâmetros no seu aplicativo, consulte a página sobre [Eventos de Aplicativo](eventos-app.md).*

## Veja Também

- [Sobre a API de Conversões da Meta](api-conversao.md)

- [Como usar a API de Conversões](como-usar-api.md)

- [Boas Práticas para a API de Conversões](boas-praticas-api-conversao.md)

- [Visualizar Detalhes de Eventos do Servidor](detalhes-eventos-servidor.md)
