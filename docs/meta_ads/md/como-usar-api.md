---
title: "Como usar a API de Conversões"
description: "Guia prático de envio de eventos de servidor: endpoint POST /{PIXEL_ID}/events da Graph API, payload de exemplo em curl, parâmetros obrigatórios, hashing, envio em lote, test_event_code e verificação no Gerenciador de Eventos."
tags: [capi, how-to, graph-api, endpoint, payload, testing, deduplication]
related: [parameters, boas-praticas-api-conversao, api-conversao, monitorar-api-conversao]
captured: 2026-06-23
---

# Como usar a API de Conversões

**Atualizado:** 6 de fevereiro de 2026

Depois de concluir os pré-requisitos da página de introdução da API de Conversões, use este guia para enviar eventos de servidor, testar a implementação e verificar se os eventos chegaram ao Gerenciador de Eventos da Meta.

> A API de Conversões é baseada na API de Marketing do Facebook, criada sobre a Graph API. O ciclo de versões da API de Conversões acompanha a Graph API para manter compatibilidade por pelo menos dois anos.

**Endpoint principal** `POST /{PIXEL_ID}/events` cria eventos de servidor. **Parâmetro crítico** `action_source` deve refletir a origem real do evento. **Teste** `test_event_code` ajuda a validar eventos no Gerenciador de Eventos.

## Parâmetros obrigatórios

Eventos de loja física, app e web compartilhados pela API de Conversões exigem parâmetros específicos. Ao usar a API, garanta a precisão do `action_source` e consulte a lista oficial de parâmetros antes de enviar eventos em produção.

| Campo | Função |
| --- | --- |
| `event_name` | Nome do evento, como `PageView`, `ViewContent`, `Lead` ou `Purchase`. |
| `event_time` | Momento em que o evento aconteceu, em timestamp Unix. Use o tempo da transação, não o tempo de upload. |
| `action_source` | Origem do evento, por exemplo `website`, `app`, `phone_call`, `chat`, `physical_store` ou `system_generated`. |
| `user_data` | Dados de correspondência do cliente, como email, telefone, IP, user agent e outros identificadores permitidos. |
| `custom_data` | Dados do evento, como moeda, valor, conteúdo, categoria ou quantidade. |
| `event_id` | Identificador usado para desduplicar eventos enviados pelo Pixel e pela API de Conversões. |

## Enviar solicitações

Para enviar novos eventos, faça uma solicitação `POST` para a borda `/events` do pixel:

```
https://graph.facebook.com/{API_VERSION}/{PIXEL_ID}/events?access_token={TOKEN}
```

Exemplo simplificado de envio de evento:

```
curl -X POST \
  "https://graph.facebook.com/v25.0/<PIXEL_ID>/events?access_token=<ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {
        "event_name": "Purchase",
        "event_time": 1764975551,
        "action_source": "website",
        "event_source_url": "https://www.exemplo.com/produto",
        "event_id": "pedido-123",
        "user_data": {
          "em": ["<EMAIL_SHA256>"],
          "ph": ["<PHONE_SHA256>"],
          "client_ip_address": "192.0.2.1",
          "client_user_agent": "<USER_AGENT>"
        },
        "custom_data": {
          "currency": "BRL",
          "value": 123.45
        }
      }
    ]
  }'
```

Uma resposta bem-sucedida indica quantos eventos foram recebidos:

```
{
  "events_received": 1,
  "messages": [],
  "fbtrace_id": "..."
}
```

### Tempo do evento, lote e hash

- **Tempo do evento:** preencha `event_time` com o momento em que a ação ocorreu.

- **Solicitações em lote:** envie múltiplos eventos no array `data` quando fizer sentido operacional.

- **Uso de hash:** normalize e aplique SHA-256 aos identificadores de cliente exigidos pela documentação, como email e telefone, antes do envio.

- **Desduplicação:** use o mesmo `event_id` para o evento equivalente enviado pelo navegador e pelo servidor.

## Verificação de eventos

Depois de enviar eventos, confirme se eles foram recebidos no [Gerenciador de Eventos](gerenciador-eventos.md). Na página **Fontes de dados**, selecione o pixel correspondente ao `PIXEL_ID` usado na solicitação. Em **Visão geral**, acompanhe eventos brutos, correspondidos, atribuídos e o método de conexão.

![Aba Visão geral do Gerenciador de Eventos mostrando gráfico de atividade e lista de eventos com método de conexão e total de eventos](assets/aba-visao-geral-do-gerenciador-de-eventos-mostrando-grafico-7aa94b.png)

*Visão geral do Gerenciador de Eventos com atividade e método de conexão.*

Clique em cada evento para ver detalhes específicos. Os eventos podem levar até 20 minutos para aparecer.

![Evento PageView expandido no Gerenciador de Eventos mostrando atividade de correspondência avançada e detalhes do evento](assets/evento-pageview-expandido-no-gerenciador-de-eventos-mostrand-85446b.png)

*Detalhes de evento no Gerenciador de Eventos.*

## Ferramenta Eventos de Teste

Use **Events Manager > Data Sources > Your Pixel > Test Events** para confirmar se os eventos de servidor estão sendo recebidos corretamente. A ferramenta gera um ID de teste; envie esse ID como `test_event_code`.

> **Observação:** use `test_event_code` apenas em testes. Remova esse campo do payload de produção. Eventos enviados com esse campo ainda chegam ao Gerenciador de Eventos e podem ser usados em direcionamento e mensuração.

```
{
  "data": [
    {
      "event_name": "ViewContent",
      "event_time": 1764975551,
      "action_source": "website",
      "user_data": {
        "em": ["<EMAIL_SHA256>"]
      }
    }
  ],
  "test_event_code": "TEST12345"
}
```

![Explorador da Graph API com payload POST para eventos e resposta JSON events_received igual a 1](assets/explorador-da-graph-api-com-payload-post-para-eventos-e-resp-21bbd3.png)

*Exemplo de solicitação no Graph API Explorer com resposta de evento recebido.*

![Aba Test Your Events Server mostrando um evento View Content recebido, URL e chaves de dados do usuário](assets/aba-test-your-events-server-mostrando-um-evento-view-content-f0471b.png)

*Evento de servidor recebido na ferramenta Eventos de Teste.*

## Opções de processamento de dados para usuários nos EUA

Quando necessário, envie opções de processamento de dados no payload para limitar o uso de dados conforme os requisitos aplicáveis.

```
{
  "data": [
    {
      "event_name": "Purchase",
      "event_time": 1764975551,
      "action_source": "website",
      "data_processing_options": ["LDU"],
      "data_processing_options_country": 1,
      "data_processing_options_state": 1000
    }
  ]
}
```

## Limites da API

Respeite os limites de volume, tamanho de payload e validade temporal dos eventos. Eventos muito antigos, payloads malformados ou dados sem parâmetros obrigatórios podem ser descartados, atrasados ou gerar mensagens de diagnóstico.

## Uso do SDK de Negócios no Conversions API Gateway

Para enviar eventos a uma instância do Conversions API Gateway usando o SDK de Negócios, o artigo original destaca o uso de `CAPIGatewayIngressRequest`. O conteúdo indica suporte nos SDKs de PHP e Java, com versões mínimas PHP 7.2 e Java 8.

### Requisitos

| Parâmetro | Descrição |
| --- | --- |
| `CB_URL` | URL da instância do Conversions API Gateway. |
| `CAPIG_ACCESS_KEY` | Chave de acesso necessária para enviar eventos ao endpoint de eventos do Gateway. |

### Setters principais

- `setSendToDestinationOnly(true)`: envia o evento somente ao destino configurado.

- `setFilter(...)`: aplica uma função de filtro por evento; quando a lógica retorna `true`, o evento é transmitido.

- `setCustomEndpoint(...)`: conecta o `EventRequest` ao endpoint customizado do Gateway.

```
// Exemplo conceitual
CAPIGatewayIngressRequest capiRequest =
    new CAPIGatewayIngressRequest(CB_URL, CAPIG_ACCESS_KEY);

eventRequest.setCustomEndpoint(capiRequest);
eventRequest.execute();
```

## Saiba mais

- [Sobre a API de Conversões](api-conversao.md)

- [Como monitorar e melhorar a configuração da API de Conversões](monitorar-api-conversao.md)

- [Eventos padrão e personalizados do site](eventos-padrao-site.md)

- [Rastreamento de conversão](conversion-traking.md)
