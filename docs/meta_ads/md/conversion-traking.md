---
title: "Rastreamento de conversão"
description: "Rastreamento de conversões com o Pixel: eventos padrão via fbq('track'), eventos personalizados via fbq('trackCustom') e conversões personalizadas por regra de URL. Inclui restrição de set/2025 a conversões que sugiram dados sensíveis (saúde, finanças)."
tags: [pixel, conversion-tracking, fbq, custom-conversions, policy]
related: [eventos-padrao-pixel, conversoes-personalizadas-web, eventos-padrao-site]
captured: 2026-06-23
---

# Rastreamento de conversão

> Esta página foi traduzida do inglês para outro idioma usando IA. O conteúdo traduzido por IA pode conter erros, omissões ou divergências de sentido. Consulte o conteúdo original em inglês quando precisar validar orientações técnicas.

Você pode usar o Pixel da Meta para rastrear as ações dos visitantes do seu site, o que também é conhecido como rastreamento de conversão. As conversões rastreadas aparecem no Gerenciador de Anúncios e no Gerenciador de Eventos da Meta.

Essas conversões podem ser usadas para analisar a eficiência do funil, calcular o retorno sobre o investimento em anúncios, definir públicos personalizados, otimizar anúncios e alimentar campanhas de anúncios de catálogo Advantage+. Depois de definir públicos personalizados, a Meta pode usá-los para identificar outras pessoas propensas à conversão e direcioná-las com seus anúncios.

Há três maneiras de rastrear conversões com o Pixel:

- **Eventos padrão:** ações de visitantes predefinidas que você relata ao chamar uma função do Pixel.

- **Eventos personalizados:** ações de visitantes que você define e relata ao chamar uma função do Pixel.

- **Conversões personalizadas:** ações de visitantes rastreadas automaticamente pela análise dos URLs de referência do site.

> **Restrição a partir de 2 de setembro de 2025:** conversões personalizadas que possam sugerir informações não permitidas nos Termos das Ferramentas da Meta para Empresas passam a receber restrições adicionais e proativas. Exemplos incluem conversões que indiquem condições de saúde específicas, como "artrite" ou "diabetes", ou situação financeira, como "pontuação de crédito" ou "alta renda".

> Essas conversões podem ser sinalizadas e impedidas de serem usadas para veicular campanhas de anúncios.

### Requisitos

Antes de rastrear conversões, instale o Pixel da Meta no site e confirme que os eventos chegam ao Gerenciador de Eventos. Para configurações mais completas, combine o Pixel com a [API de Conversões](api-conversao.md) e use os mesmos eventos em ambos os canais quando possível.

## Eventos padrão

Eventos padrão são nomes reconhecidos pela Meta e compatíveis com os produtos de publicidade. Eles ajudam a otimizar campanhas, gerar relatórios e criar públicos.

### Como rastrear eventos padrão

Para rastrear um evento padrão, chame `fbq('track')` com o nome do evento e, quando necessário, parâmetros como moeda e valor.

```
fbq('track', 'Purchase', { currency: 'USD', value: 30.00 });
```

Alguns eventos padrão comuns incluem:

| Evento | Uso típico |
| --- | --- |
| `PageView` | Visualização de uma página. |
| `ViewContent` | Visualização de uma página importante, como produto, destino ou artigo. |
| `AddToCart` | Adição de produto ao carrinho. |
| `InitiateCheckout` | Início do checkout. |
| `Lead` | Envio de lead, cadastro ou contato comercial. |
| `Purchase` | Compra concluída; use com `value` e `currency`. |

## Eventos personalizados

Eventos personalizados permitem medir ações que não são cobertas pelos eventos padrão. Eles são úteis quando sua jornada tem ações específicas do seu produto, funil ou operação.

### Como rastrear eventos personalizados

Para rastrear um evento personalizado, chame `fbq('trackCustom')` com um nome próprio e parâmetros opcionais.

```
fbq('trackCustom', 'ShareDiscount', { promotion: 'share_discount_10%' });
```

Use nomes claros, estáveis e livres de informações sensíveis. Eventos personalizados podem ajudar a definir públicos e mensurar etapas específicas, mas devem seguir os Termos das Ferramentas da Meta para Empresas.

## Conversões personalizadas

Conversões personalizadas permitem definir regras sobre URLs, eventos ou parâmetros para medir ações sem alterar o código do site. Elas são úteis quando você quer separar variações de uma mesma ação, como compras de uma categoria específica ou leads vindos de uma página dedicada.

### Como criar conversões personalizadas

1. Acesse o Gerenciador de Eventos.

2. Escolha a fonte de dados do Pixel.

3. Crie uma conversão personalizada com base em evento, URL ou regras.

4. Defina uma categoria de evento apropriada.

5. Revise se o nome, as regras e os parâmetros não indicam informações proibidas.

### Conversões personalizadas com base em regras

Você pode criar regras com base em URLs, parâmetros ou eventos. Por exemplo, uma regra pode identificar visitantes que chegaram a uma página de agradecimento, ou compradores cujo evento `Purchase` contém determinada categoria de conteúdo.

### Insights e limitações

Use os insights de conversões personalizadas para avaliar volume, qualidade e disponibilidade das conversões. Conversões sinalizadas por potencial violação podem ficar indisponíveis para veiculação, otimização ou criação de públicos.

Se uma conversão personalizada for sinalizada, revise o nome, as regras e os parâmetros. Evite termos que possam sugerir condições de saúde, situação financeira, características sensíveis ou outras informações proibidas.

## Rastrear conversões fora do site

Para eventos que acontecem fora do navegador, como vendas offline, eventos de app, CRM ou mensagens, use a [API de Conversões](api-conversao.md). Ela ajuda a enviar eventos de várias fontes para os sistemas de mensuração e otimização da Meta.

## Parâmetros

Parâmetros adicionam contexto ao evento. Eles ajudam na mensuração, otimização, criação de públicos e uso de anúncios de catálogo.

### Propriedades de objetos

| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `content_ids` | array de strings | IDs de produtos ou conteúdos associados ao evento. |
| `content_type` | string | Tipo de conteúdo, como `product` ou `product_group`. |
| `contents` | array de objetos | Lista de itens com ID, quantidade e outros detalhes. |
| `currency` | string | Moeda associada ao valor do evento, como `USD` ou `BRL`. |
| `value` | número | Valor monetário do evento; obrigatório para compras e otimização de valor. |
| `search_string` | string | Texto pesquisado pelo usuário; usado com o evento `Search`. |
| `status` | booleano | Status de registro; usado com `CompleteRegistration`. |

### Propriedades personalizadas

Se as propriedades predefinidas não atenderem às suas necessidades, você pode incluir propriedades personalizadas. Elas podem ser usadas com eventos padrão e personalizados para definir públicos de forma mais específica.

Exemplo de compra com uma propriedade personalizada que indica o produto comparado antes da compra:

```
fbq('track', 'Purchase', {
  value: 115.00,
  currency: 'USD',
  contents: [
    { id: '301', quantity: 1 },
    { id: '401', quantity: 2 }
  ],
  content_type: 'product',
  compared_product: 'recommended-banner-shoes',
  delivery_category: 'in_store'
});
```

## Próximas etapas

Agora que você está rastreando conversões, use-as para definir públicos personalizados e otimizar anúncios para conversões do site. Para melhorar cobertura e confiabilidade, considere combinar Pixel da Meta e API de Conversões.

## Saiba mais

- [Sobre os eventos padrão e personalizados do site](eventos-padrao-site.md)

- [Sobre a API de Conversões](api-conversao.md)

- Rastreamento de conversão com Meta Blueprint
