---
title: "Sobre a API de Conversões"
description: "Visão geral da API de Conversões: o que é, como funciona, benefícios por tipo de evento (site, app, offline, mensagens) e como se integra ao Pixel da Meta. Nota: API de Conversões Offline descontinuada em maio/2025."
tags: [capi, overview, web-events, app-events, offline-events, messaging-events, pixel]
related: [como-usar-api, parameters, boas-praticas-api-conversao, comparar-opcoes-configuracoes-api]
captured: 2026-06-23
---

# Sobre a API de Conversões

> Você pode conversar com um Especialista Técnico Meta e receber orientação passo a passo sobre como implementar a API de Conversões. Saiba como [agendar uma ligação com um Especialista Meta](https://www.facebook.com/business/meta-pro-team/technical-pro?lead_source=sbg_2025_q4_ou_specialist_technical_helpcenter_xyz).

A API de Conversões foi desenvolvida para criar uma conexão direta entre seus dados de marketing e os sistemas de otimização de anúncios da Meta, que ajudam a otimizar o direcionamento de anúncios, reduzir o custo por resultado e mensurar resultados nas tecnologias da Meta.

## Entenda como a API de Conversões funciona

A API de Conversões foi desenvolvida para criar uma conexão direta e mais confiável entre dados de marketing (do seu servidor, plataforma do site, app ou CRM) e a Meta. Os dados de marketing incluem eventos do site, eventos do app, conversões offline e eventos de mensagens. Esses dados ajudam a otimizar, mensurar e personalizar anúncios nas tecnologias da Meta. Dessa forma, seus anúncios serão exibidos para as pessoas com maior probabilidade de achá-los relevantes.

As conversões offline podem ser usadas para otimização de anúncios em uma campanha com objetivo de vendas ao selecionar "Site e loja física".

Você pode configurar a API de Conversões de várias maneiras. Muitas integrações não precisam de desenvolvedor.

## Gerencie dados de eventos com a API de Conversões

A API de Conversões pode ajudar você a gerenciar os dados de eventos com uma única API. A API de Conversões é compatível com eventos de várias fontes, incluindo sites, estabelecimentos físicos, email, chat comercial, telefone, app para celular e offline.

Como alternativa, é possível configurar a API de Conversões em vez da API de Eventos do App e da API de Conversões Offline. Caso você já use a API de Eventos do App ou a API de Conversões Offline, poderá continuar usando-as, a menos que precise criar conjuntos de dados.

> **Observação:** A API de Conversões Offline será descontinuada em maio de 2025. Nesse momento, você não poderá mais usar a API de Conversões Offline para carregar eventos em conjuntos de eventos offline. A Meta recomenda carregar eventos em conjuntos de dados e converter a integração da API de Conversões Offline em uma integração da API de Conversões.

## Descubra outros benefícios da API de Conversões

A API de Conversões oferece outros benefícios para eventos de site, app, offline e mensagens.

### Como usar a API de Conversões para enviar eventos do site

Usar a API de Conversões para eventos do site pode ajudar a:

- **Aumentar a conectividade, reduzindo o custo por resultado.** Os dados da API de Conversões são menos afetados do que o Pixel da Meta por erros de carregamento do navegador, problemas de conexão e bloqueadores de anúncios.

- **Otimizar anúncios para ações posteriores da jornada do cliente.** Esses eventos incluem ações pós-compra, ações em lojas e pontuações de clientes.

- **Aprimorar a mensuração.** A API de Conversões pode ajudar a melhorar a mensuração da atribuição e do desempenho de anúncios na jornada do cliente.

- **Aumentar a correspondência de eventos, reduzindo o custo por resultado.** Com a API de Conversões, você pode incluir outros parâmetros de informações do cliente que ajudam a aumentar os eventos com correspondência e a qualidade da correspondência de eventos.

## Como integrar a API de Conversões com o Pixel da Meta

Se você usa a API de Conversões para enviar eventos da web, a Meta recomenda usar também o pixel para maximizar a eficácia dos eventos do site.

Os eventos do site enviados por meio da API de Conversões estão vinculados ao seu pixel e se comportam como eventos enviados por meio do pixel:

- Eles são usados para os mesmos tipos de otimização do anúncio, incluindo maximizar o número de conversões e maximizar o valor das conversões.

- Eles aparecem na mesma seção da maioria das ferramentas, incluindo o Gerenciador de Anúncios da Meta e o Gerenciador de Eventos da Meta.

- Eles seguem a ferramenta Atividade fora do Facebook, o controle de dados de terceiros para a personalização de anúncios e outras restrições dos Termos das Ferramentas da Meta para Empresas.

- Assim como o pixel, a API de Conversões não foi criada para contornar políticas de compartilhamento de dados ou regras de privacidade.

Visite o Meta for Developers para [saber como enviar eventos do site por meio de uma integração direta da API de Conversões](https://developers.facebook.com/docs/marketing-api/conversions-api/get-started).

### Como usar a API de Conversões para enviar eventos do app

Usar a API de Conversões para enviar eventos do app pode ajudar a depender menos do SDK e das atualizações de versão do app. Você pode enviar novos dados de eventos sem a necessidade de manter o SDK do Facebook para iOS ou Android e sem depender de atualizações de versão do app.

Caso já use uma integração direta da API de Conversões para compartilhar eventos do seu site, você pode atualizar a configuração para compartilhar eventos do app também. Visite o Meta for Developers para [saber como enviar eventos do app por meio de uma integração direta da API de Conversões](https://developers.facebook.com/docs/marketing-api/conversions-api/app-events).

### Como usar a API de Conversões para enviar eventos offline

Usar a API de Conversões para enviar eventos offline pode ajudar a:

- **Mensurar os resultados no estabelecimento causados pelos seus anúncios da Meta.**

- **Criar públicos personalizados e públicos semelhantes com base nos seus eventos offline.**

- **Realizar estudos de incrementalidade para entender o impacto dos anúncios da Meta nas compras no estabelecimento.**

Caso já use uma integração direta da API de Conversões para compartilhar eventos do seu site ou app, você pode atualizar a configuração para compartilhar eventos offline também. Visite o Meta for Developers para [saber como enviar eventos offline por meio de uma integração direta da API de Conversões](https://developers.facebook.com/docs/marketing-api/conversions-api/offline-events).

### Como usar a API de Conversões para enviar eventos de mensagens

Usar a API de Conversões para enviar eventos de mensagens pode ajudar a:

- **Conectar dados valiosos de chats comerciais.** Compartilhar eventos pode ajudar a compreender as ações que as pessoas realizam nos chats comerciais do Messenger, do Instagram ou do WhatsApp.

- **Otimizar anúncios de clique para o Messenger para compras a fim de melhorar o desempenho.** No momento, a otimização só está disponível para eventos de compra no Messenger.

- **Melhorar a mensuração.** A API de Conversões pode ajudar a compreender melhor e a mensurar as ações que acontecem mais tarde na jornada do cliente, como fazer uma compra.

Aprenda a enviar eventos de mensagens por meio de uma integração de parceiros ou visite o Meta for Developers para [saber como enviar eventos de mensagens por meio de uma integração direta da API de Conversões](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging).

## Explore mais recursos

- Como preparar sua empresa para usar a API de Conversões

- Boas práticas para a API de Conversões

- [Meta for Developers: Parâmetros da API de Conversões](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters)

- Conexões melhores com a API de Conversões

- Boas práticas de privacidade e uso de dados para as Ferramentas da Meta para Empresas

- [O que é a API de Conversões?](https://www.facebook.com/business/tools/facebook-conversions-api)
