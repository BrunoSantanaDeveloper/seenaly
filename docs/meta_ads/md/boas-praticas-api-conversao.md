---
title: "Boas práticas para a API de Conversões"
description: "Checklist de implementação da API de Conversões: escolha de eventos, parâmetros completos, action_source correto, envio em tempo real, hashing, desduplicação com o Pixel via event_id, testes e monitoramento contínuo, privacidade."
tags: [capi, best-practices, deduplication, event-matching, testing, privacy]
related: [como-usar-api, boas-praticas-melhorar-anuncios-api, monitorar-api-conversao, eventos-padrao-site]
captured: 2026-06-23
---

# Boas práticas para a API de Conversões

**Atualizado:** 6 de fevereiro de 2026

A API de Conversões ajuda a criar uma conexão mais confiável entre eventos do seu servidor e os sistemas de otimização, mensuração e personalização de anúncios da Meta. Para aproveitar melhor essa integração, combine qualidade de dados, desduplicação correta, testes frequentes e monitoramento contínuo.

**Qualidade** Envie eventos relevantes com parâmetros completos e dados de correspondência confiáveis. **Redundância** Use API de Conversões e Pixel da Meta juntos quando fizer sentido para eventos do site. **Monitoramento** Teste, verifique diagnósticos e acompanhe cobertura, correspondência e atualidade dos dados.

## Checklist de implementação

- **Escolha eventos que realmente representam valor para o negócio.**

  Priorize eventos padrão como `ViewContent`, `AddToCart`, `Lead` e `Purchase` quando eles descrevem bem a jornada. Use eventos personalizados apenas quando os eventos padrão não cobrirem a ação.

- **Preencha os parâmetros obrigatórios e recomendados.**

  Inclua `event_name`, `event_time`, `action_source`, `user_data` e, quando aplicável, `custom_data` com valor, moeda, conteúdo e categoria.

- **Use `action_source` com precisão.**

  Esse campo deve representar a origem real do evento, como `website`, `app`, `phone_call`, `chat`, `physical_store` ou `system_generated`.

- **Envie os eventos o mais próximo possível do tempo real.**

  Use `event_time` com o horário em que a ação aconteceu, não o horário em que o lote foi enviado. A atualidade dos dados influencia diagnóstico, mensuração e otimização.

- **Faça hash dos dados de cliente quando necessário.**

  Normalize identificadores como email e telefone antes de aplicar SHA-256, seguindo o formato esperado pela API. Não envie dados sensíveis que não sejam permitidos pelas políticas aplicáveis.

## Desduplicação com Pixel e API de Conversões

Quando um mesmo evento é enviado pelo navegador e pelo servidor, configure a desduplicação para evitar contagem duplicada. A prática recomendada é enviar o mesmo `event_name` e o mesmo `event_id` nas duas origens.

| Campo | Boa prática |
| --- | --- |
| `event_name` | Deve ser igual no evento do Pixel e no evento do servidor. |
| `event_id` | Deve identificar a mesma ação nas duas fontes, como o ID do pedido ou uma chave gerada para a interação. |
| `event_time` | Deve refletir o momento real da ação. Evite usar horários artificiais apenas para processamento. |

```
{
  "event_name": "Purchase",
  "event_time": 1764975551,
  "event_id": "pedido-123",
  "action_source": "website"
}
```

## Melhore a correspondência de eventos

A qualidade da correspondência de eventos depende da quantidade e da confiabilidade dos parâmetros enviados em `user_data`. Inclua apenas dados permitidos, com consentimento e tratamento adequados.

| Parâmetro | Uso recomendado |
| --- | --- |
| `em`, `ph` | Email e telefone normalizados e com hash. |
| `client_ip_address`, `client_user_agent` | Úteis para eventos de site quando coletados no momento da ação. |
| `fbc`, `fbp` | Identificadores do navegador que ajudam a conectar eventos quando disponíveis. |
| `external_id` | Identificador próprio, persistente e com hash, quando existe uma base autenticada. |

## Teste antes de publicar

Use a ferramenta Eventos de Teste no Gerenciador de Eventos para validar payload, parâmetros e chegada dos eventos. Envie `test_event_code` somente em ambiente de teste e remova esse campo dos eventos de produção.

> **Importante:** eventos enviados com `test_event_code` ainda podem aparecer no Gerenciador de Eventos e participar de mensuração. Use dados de teste controlados.

![Explorador da Graph API com payload POST para eventos e resposta JSON events_received igual a 1](assets/explorador-da-graph-api-com-payload-post-para-eventos-e-resp-21bbd3.png)

*Exemplo de payload enviado pelo Graph API Explorer com resposta de evento recebido.*

![Aba Test Your Events Server mostrando um evento View Content recebido, URL e chaves de dados do usuário](assets/aba-test-your-events-server-mostrando-um-evento-view-content-f0471b.png)

*Evento de servidor recebido na ferramenta Eventos de Teste.*

## Monitore a configuração continuamente

Depois da publicação, acompanhe a fonte de dados no [Gerenciador de Eventos](gerenciador-eventos.md). Verifique diagnósticos, cobertura de eventos, desduplicação, qualidade de correspondência e atualidade dos dados.

![Aba Visão geral do Gerenciador de Eventos mostrando gráfico de atividade e lista de eventos com método de conexão e total de eventos](assets/aba-visao-geral-do-gerenciador-de-eventos-mostrando-grafico-7aa94b.png)

*Visão geral do Gerenciador de Eventos com atividade e método de conexão.*

![Evento PageView expandido no Gerenciador de Eventos mostrando atividade de correspondência avançada e detalhes do evento](assets/evento-pageview-expandido-no-gerenciador-de-eventos-mostrand-85446b.png)

*Detalhes de evento para revisar correspondência e integridade dos dados.*

## Privacidade, consentimento e governança

- Envie somente dados permitidos pelas políticas aplicáveis e pelos seus avisos de privacidade.

- Respeite consentimento, preferências de usuário e restrições regionais.

- Use opções de processamento de dados quando forem necessárias para usuários nos EUA ou outros contextos regulatórios.

- Evite dados sensíveis, diagnósticos com informações pessoais expostas e payloads além do necessário para mensuração e otimização.

## Saiba mais

- [Sobre a API de Conversões](api-conversao.md)

- [Como usar a API de Conversões](como-usar-api.md)

- [Como monitorar e melhorar a configuração da API de Conversões](monitorar-api-conversao.md)

- [Eventos padrão e personalizados do site](eventos-padrao-site.md)

- [Rastreamento de conversão](conversion-traking.md)
