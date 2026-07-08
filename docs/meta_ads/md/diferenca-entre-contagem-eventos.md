---
title: "Diferenças entre contagens de eventos no Gerenciador de Anúncios, Relatórios de Anúncios e Gerenciador de Eventos"
description: "Por que as contagens de eventos diferem entre Gerenciador de Anúncios, Relatórios de Anúncios e Gerenciador de Eventos: eventos atribuídos vs recebidos, desduplicação, janelas de atribuição e o que cada ferramenta responde."
tags: [reporting, attribution, deduplication, events-manager, ads-manager]
related: [gerenciador-relatorios, detalhes-eventos-servidor, relatorio-de-anuncios]
captured: 2026-06-23
---

# Diferenças entre contagens de eventos no Gerenciador de Anúncios, Relatórios de Anúncios e Gerenciador de Eventos

As contagens de eventos podem variar entre o [Gerenciador de Anúncios da Meta](gerenciador-anuncio.md), os Relatórios de Anúncios e o [Gerenciador de Eventos da Meta](gerenciador-eventos.md). Isso acontece porque cada ferramenta responde a uma pergunta diferente.

> O Gerenciador de Eventos mostra a maior parte dos eventos recebidos pelas fontes de dados. Já o Gerenciador de Anúncios e os Relatórios de Anúncios mostram eventos atribuídos aos anúncios, depois de processamento, descarte e desduplicação.

## Visão geral

| Ferramenta | O que mostra | Como interpretar |
| --- | --- | --- |
| **Gerenciador de Anúncios** | Eventos padrão e conversões personalizadas atribuídos aos anúncios. | Use para avaliar resultados de campanha e ações geradas pela veiculação dos anúncios. |
| **Relatórios de Anúncios** | Eventos padrão agrupados em conversões, conversões personalizadas e eventos personalizados usados anteriormente para otimização. | Use para análises de performance e comparação de métricas atribuídas. |
| **Gerenciador de Eventos** | Eventos padrão, eventos personalizados e conversões personalizadas recebidos pelas fontes de dados. | Use para validar implementação, diagnóstico, recebimento e qualidade dos eventos. |

### Que tipos de eventos são mostrados?

- **Gerenciador de Anúncios:** eventos padrão e conversões personalizadas.

- **Relatórios de Anúncios:** eventos padrão agrupados em conversões, conversões personalizadas e eventos personalizados que já foram usados para otimizar a veiculação de anúncios.

- **Gerenciador de Eventos:** eventos padrão, eventos personalizados e conversões personalizadas.

### Eventos atribuídos e não atribuídos

O Gerenciador de Anúncios e os Relatórios de Anúncios exibem eventos atribuídos a pessoas para quem um anúncio foi exibido. Esses eventos já passaram por processamento e podem ter sido descartados por duplicação, políticas de dados ou regulamentos.

O Gerenciador de Eventos mostra eventos atribuídos e não atribuídos. Por isso, normalmente inclui tráfego orgânico, tráfego gerado por anúncios da Meta e tráfego vindo de outras plataformas.

### Desduplicação

No Gerenciador de Anúncios e nos Relatórios de Anúncios, os eventos são desduplicados. Se a Meta receber o mesmo evento várias vezes em um curto período, pode manter uma ocorrência e descartar o restante para evitar excesso de contagem.

No Gerenciador de Eventos, a interpretação depende da área consultada:

- **Página de fontes de dados:** a contagem **Total de eventos** não é desduplicada.

- **Página de conversões personalizadas:** a contagem **Total de conversões personalizadas** é desduplicada.

## Diferenças mais comuns

- **Resultados menores no Gerenciador de Anúncios e nos Relatórios de Anúncios:** esses relatórios mostram ações atribuídas aos anúncios, enquanto o Gerenciador de Eventos mostra ações recebidas pelas fontes de dados, incluindo tráfego não atribuído.

- **Contagens menores para conversões personalizadas:** eventos padrão e personalizados tendem a incluir a maior parte dos eventos recebidos. Conversões personalizadas podem excluir eventos descartados por duplicação, políticas de dados ou regulamentos.

## Quando usar cada número

- Use **Gerenciador de Anúncios** e **Relatórios de Anúncios** para decisões de campanha, performance e atribuição.

- Use **Gerenciador de Eventos** para conferir se Pixel, API de Conversões, eventos personalizados e conversões personalizadas estão chegando corretamente.

- Ao investigar divergências, compare sempre o tipo de evento, a janela de atribuição, a origem do tráfego e se a métrica consultada já foi desduplicada.

## Saiba mais

- [Como os resultados são calculados nos relatórios de anúncios](relatorio-de-anuncios.md)

- [Detalhes de eventos do servidor no Gerenciador de Eventos](detalhes-eventos-servidor.md)

- [Monitorar a API de Conversões](monitorar-api-conversao.md)
