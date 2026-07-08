---
title: "Sobre os eventos padrão e personalizados do site"
description: "Conceito de eventos de site: diferença entre eventos padrão (nomes predefinidos pela Meta) e eventos personalizados (nomes próprios), formas de configuração e boa prática de envio redundante por Pixel e API de Conversões."
tags: [web-events, standard-events, custom-events, pixel, capi]
related: [eventos-padrao-pixel, conversoes-personalizadas-web, api-conversao]
captured: 2026-06-23
---

# Sobre os eventos padrão e personalizados do site

A Meta usa dados de evento para mostrar anúncios para pessoas com probabilidade de se interessar por eles. Os eventos de site são ações que as pessoas realizam no seu site, como fazer uma compra ou adicionar um item ao carrinho.

Quando as pessoas interagem com sua empresa, ferramentas como a [API de Conversões](api-conversao.md) e o [Pixel da Meta](meta-pixel.md) ajudam a compartilhar esses eventos. Esse compartilhamento melhora seus anúncios da Meta ao alcançar um público relevante, personalizar experiências de anúncios e otimizar campanhas de anúncios para obter resultados melhores.

Há duas categorias de eventos que você pode compartilhar: padrão e personalizado.

- **Eventos padrão:** são ações com nomes predefinidos que a Meta reconhece e são compatíveis com todos os produtos de publicidade. Você pode configurar eventos padrão usando a ferramenta de configuração de eventos, uma integração de parceiros, o código do pixel ou o código da API de Conversões. O compartilhamento de eventos padrão ajuda a otimizar para conversões e a criar públicos.

- **Eventos personalizados:** são ações não abrangidas pelos eventos padrão. Você pode atribuir um nome único para representar a ação. Configure eventos personalizados usando seu código do pixel ou o código da API de Conversões. O compartilhamento de eventos personalizados ajuda a otimizar para conversões e a criar públicos. Ao enviar um novo evento personalizado, analise-o no Gerenciador de Eventos da Meta para confirmar que ele é da sua empresa e segue os Termos das Ferramentas da Meta para Empresas.

## Exemplo de código de site com eventos

Veja como o código do seu site aparece com os eventos padrão ou personalizados instalados:

![Exemplo de código de site com eventos](assets/exemplo-de-c-oacute-digo-de-evento-padr-atilde-o-do-pixel-da-70f139.webp)

1. Código original do site.

2. Código do Pixel da Meta.

3. Código do evento padrão ou personalizado. Um exemplo é o evento "adicionar ao carrinho", um evento padrão.

Integre eventos a páginas que são significativas para sua empresa e entenda a jornada do seu cliente. A configuração de eventos ao longo do caminho, como de visualizações de páginas de produtos a compras, ajuda a mensurar e otimizar anúncios para conversões significativas. Depois que os eventos estiverem configurados, você pode entendê-los no Gerenciador de Eventos.

## Boas práticas

Envie os mesmos eventos do site por meio do pixel e da API de Conversões. Essa prática melhora o desempenho e a mensuração das suas campanhas de anúncios do Facebook.

> **Observação:** os anunciantes não devem usar as Ferramentas da Meta para Empresas para compartilhar informações proibidas sobre pessoas. Isso inclui dados definidos como sensíveis segundo as leis, regulamentações ou diretrizes do setor aplicáveis, ou dados não permitidos de acordo com os termos e políticas da Meta. Compartilhar essas informações viola os Termos das Ferramentas da Meta para Empresas.

## Saiba mais

- Especificações para eventos padrão do Pixel da Meta

- Boas práticas para a configuração de eventos padrão com o Pixel da Meta

- Sobre as conversões personalizadas para a web
