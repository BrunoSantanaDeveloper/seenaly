---
title: "Como visualizar detalhes de eventos do servidor no Gerenciador de Eventos da Meta"
description: "Como visualizar detalhes de eventos do servidor no Gerenciador de Eventos: abas Visão geral do evento, Cobertura de eventos, Correspondência de eventos, Desduplicação de evento e Nível de atualidade dos dados."
tags: [capi, events-manager, server-events, event-coverage, deduplication, emq]
related: [monitorar-api-conversao, boas-praticas-melhorar-anuncios-api, gerenciador-eventos]
captured: 2026-06-23
---

# Como visualizar detalhes de eventos do servidor no Gerenciador de Eventos da Meta

> Esses detalhamentos de eventos estão disponíveis para eventos do site enviados por meio da API de Conversões. Eles podem não estar disponíveis para outros tipos de eventos enviados pela API de Conversões ou para eventos enviados pelo Pixel da Meta.

No [Gerenciador de Eventos da Meta](gerenciador-eventos.md), é possível ver detalhamentos de cada evento do site compartilhado usando a [API de Conversões](api-conversao.md). Esses detalhes ajudam a entender volume, cobertura, correspondência, desduplicação e atualidade dos dados enviados pelo servidor.

## Para que servem os detalhes de eventos

- Monitorar o volume de eventos e verificar se você compartilha eventos de forma redundante na aba **Visão geral do evento**.

- Melhorar a cobertura de eventos na aba **Cobertura de eventos**.

- Aumentar a qualidade da correspondência na aba **Correspondência de eventos**.

- Melhorar a desduplicação na aba **Desduplicação de evento**.

- Compartilhar eventos com a Meta em tempo real, ou o mais próximo possível disso, na aba **Nível de atualidade dos dados**.

Para recomendações gerais de implementação, consulte também [boas práticas para a API de Conversões](boas-praticas-api-conversao.md).

## Visualizar os detalhes do evento do servidor

1. Acesse o [Gerenciador de Eventos](https://business.facebook.com/events_manager2/list).

2. Selecione o nome e a identificação dos seus dados.

3. Encontre o evento para o qual deseja ver detalhes e clique em **Ver detalhes**.

4. Selecione uma aba para visualizar as informações detalhadas sobre o evento.

### Visão geral do evento

A aba **Visão geral do evento** mostra a métrica **Eventos recebidos** para o Pixel da Meta e para a API de Conversões. Os eventos do navegador vêm pelo Pixel, enquanto os eventos do servidor vêm pela API de Conversões.

- **Eventos recebidos:** total de eventos antes do processamento. Ao usar Pixel e API de Conversões juntos, essa soma não é desduplicada.

- **Conversões adicionais reportadas:** linha de tendência que ajuda a entender como mudanças na qualidade dos dados afetam conversões ao longo do tempo.

- **Verificação de redundância:** os eventos da API de Conversões devem ser iguais ou superiores aos eventos do Pixel da Meta. Se o volume do Pixel estiver mais alto, revise a configuração do servidor.

### Cobertura de eventos

A cobertura de eventos mostra a porcentagem de eventos recebidos da API de Conversões em comparação com eventos únicos do navegador enviados pelo Pixel da Meta. Essa aba também pode exibir recomendações personalizadas para melhorar a mensuração de conversões.

A Meta recomenda buscar uma taxa de cobertura de eventos de **75%** da API de Conversões em relação aos eventos do Pixel da Meta, ajudando a manter relatórios mais precisos e melhor desempenho.

### Correspondência de eventos

A aba **Correspondência de eventos** avalia como os parâmetros de informações de clientes enviados no evento do servidor ajudam a corresponder eventos a contas da Meta. Melhor correspondência pode aumentar as conversões adicionais reportadas.

- **Informações do cliente:** mostra a porcentagem de eventos com dados completos de clientes.

- **Dicas de melhoria:** enviar um único parâmetro não garante correspondência. Um evento pode não corresponder por falta de sinais suficientes ou porque a pessoa não tem uma conta da Meta.

### Desduplicação de evento

A aba **Desduplicação de evento** ajuda a identificar se a configuração precisa ser ajustada para evitar duplicidade entre eventos enviados pelo Pixel e pela API de Conversões.

| Métrica | O que observar |
| --- | --- |
| Chaves de desduplicação | Porcentagem de eventos do Pixel e da API de Conversões recebidos com cada chave de desduplicação. |
| Sobreposição | Porcentagem de eventos com a mesma chave recebidos tanto pela API de Conversões quanto pelo Pixel. Quanto maior, melhor a identificação de duplicados. |

Compartilhe chaves de desduplicação para todos os eventos sempre que usar Pixel e API de Conversões juntos.

### Nível de atualidade dos dados

A aba **Nível de atualidade dos dados** mostra o atraso entre o momento em que o evento ocorreu e o momento em que a Meta recebeu os dados. A boa prática é compartilhar eventos em tempo real ou o mais próximo possível do tempo real.

> **Observação:** esta é uma das formas de monitorar eventos compartilhados pela API de Conversões. Veja também [como monitorar e melhorar a configuração da API de Conversões](monitorar-api-conversao.md).

## Saiba mais

- [Monitorar e melhorar a configuração da API de Conversões](monitorar-api-conversao.md)

- [Boas práticas para a API de Conversões](boas-praticas-api-conversao.md)

- [Como usar a API de Conversões](como-usar-api.md)

- [Rastreamento de conversão](conversion-traking.md)
