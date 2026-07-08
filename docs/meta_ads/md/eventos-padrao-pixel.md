---
title: "Especificações para eventos padrão do Pixel da Meta"
description: "Referência dos eventos padrão do Pixel da Meta com o código fbq('track', ...) de cada um (AddToCart, Purchase, Lead, Subscribe etc.) e instruções de posicionamento do código base e do evento nas páginas."
tags: [pixel, standard-events, reference, fbq, code-snippets]
related: [eventos-padrao-site, boas-praticas-configuracao-pixel, conversion-traking]
captured: 2026-06-23
---

# Especificações para eventos padrão do Pixel da Meta

> Você pode conversar com um Especialista Técnico Meta e receber orientação passo a passo para implementar eventos padrão no Pixel da Meta.

[Eventos](eventos-padrao-site.md) são ações que as pessoas realizam no site. Os eventos padrão são predefinidos pela Meta para registrar conversões, otimizar campanhas para conversões e criar públicos.

A tabela abaixo resume eventos padrão do Pixel da Meta e o código correspondente. Para uma lista completa de eventos e parâmetros, consulte a documentação do Meta for Developers.

## Eventos padrão

| Ação no site | Descrição | Código do evento padrão |
| --- | --- | --- |
| Adicionar informações de pagamento | Adição de informações de pagamento do cliente durante a finalização da compra. | `fbq('track', 'AddPaymentInfo');` |
| Adicionar ao carrinho | Adição de um item ao carrinho ou cesto de compras. | `fbq('track', 'AddToCart');` |
| Adicionar à lista de desejos | Adição de itens à lista de desejos. | `fbq('track', 'AddToWishlist');` |
| Concluir registro | Envio de informações em troca de um serviço fornecido pela empresa, como cadastro para assinatura de email. | `fbq('track', 'CompleteRegistration');` |
| Entrar em contato | Contato entre um cliente e a empresa por telefone, SMS, email, chat ou outros meios. | `fbq('track', 'Contact');` |
| Personalizar produto | Personalização de produtos por uma ferramenta de configuração ou app da empresa. | `fbq('track', 'CustomizeProduct');` |
| Doar | Doação de fundos para uma organização ou causa. | `fbq('track', 'Donate');` |
| Encontrar localização | Quando uma pessoa encontra uma localização online com intenção de visitar o estabelecimento. | `fbq('track', 'FindLocation');` |
| Iniciar finalização da compra | Início do processo de finalização da compra. | `fbq('track', 'InitiateCheckout');` |
| Lead | Envio de informações pelo cliente, sabendo que poderá ser contatado posteriormente pela empresa. | `fbq('track', 'Lead');` |
| Comprar | Conclusão de uma compra, geralmente indicada por confirmação de pedido, compra ou recibo. | `fbq('track', 'Purchase', {value: 0.00, currency: 'USD'});` |
| Programar | Marcação de um horário para visitar uma das localizações da empresa. | `fbq('track', 'Schedule');` |
| Pesquisar | Pesquisa realizada no site, app ou outra propriedade, como buscas por produtos ou viagens. | `fbq('track', 'Search');` |
| Iniciar período de avaliação | Início de uma avaliação gratuita de produto ou serviço. | `fbq('track', 'StartTrial', {value: '0.00', currency: 'USD', predicted_ltv: '0.00'});` |
| Enviar inscrição | Envio de solicitação para produto, serviço ou programa, como cartão de crédito, programa educacional ou emprego. | `fbq('track', 'SubmitApplication');` |
| Assinar | Início de uma assinatura paga referente a produto ou serviço. | `fbq('track', 'Subscribe', {value: '0.00', currency: 'USD', predicted_ltv: '0.00'});` |
| Ver conteúdo | Visita a uma página importante, como página de destino ou página de produto. | `fbq('track', 'ViewContent');` |

> **Observação:** o evento de visualização da página é incluído como parte do código base do pixel. Ele informa quando uma pessoa acessa uma página da web com o código base instalado.

## Exemplo de evento padrão

O exemplo abaixo mostra como fica o código do site com eventos padrão instalados.

![Diagrama de implementação de evento padrão do Pixel da Meta no código do site](assets/exemplo-de-c-oacute-digo-de-evento-padr-atilde-o-do-pixel-da-70f139.webp)

1. **Código original do site:** cole o código do Pixel da Meta entre as tags `<head>` e `</head>` da página. Se já houver outro código nessa área, insira o pixel abaixo dele e acima de `</head>`.

2. **Código base do Pixel da Meta:** o código terá a mesma aparência do diagrama, mas com a ID real do seu pixel.

3. **Código do evento padrão:** acima da tag `</script>`, cole o evento correto para aquela página, como `AddToCart`. Repita esse processo nas páginas que deseja rastrear.

Cada página do site deve conter o código base do pixel. Páginas diferentes podem ter eventos padrão diferentes, conforme a ação que você deseja medir.

## Saiba mais

- [Sobre o Pixel da Meta](meta-pixel.md)

- [Eventos padrão e personalizados do site](eventos-padrao-site.md)

- [Rastreamento de conversão](conversion-traking.md)
