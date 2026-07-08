---
title: "Como monitorar e melhorar a configuração da API de Conversões no Gerenciador de Eventos da Meta"
description: "Checklist de monitoramento da API de Conversões no Gerenciador de Eventos: eventos de teste, compartilhamento redundante, cobertura de 75%, desduplicação, aba Diagnóstico, qualidade de correspondência (EMQ) e atualidade dos dados."
tags: [capi, monitoring, events-manager, diagnostics, emq]
related: [detalhes-eventos-servidor, boas-praticas-api-conversao, gerenciador-eventos]
captured: 2026-06-23
---

# Como monitorar e melhorar a configuração da API de Conversões no Gerenciador de Eventos da Meta

> Este artigo se aplica a empresas que usam a API de Conversões para enviar eventos do site.

Depois de configurar os eventos do site usando a [API de Conversões](api-conversao.md), monitore seus eventos e parâmetros no [Gerenciador de Eventos da Meta](gerenciador-eventos.md) regularmente. A manutenção constante ajuda a garantir que a configuração continue funcionando de forma eficaz e a identificar oportunidades de melhoria, o que pode melhorar o desempenho dos anúncios.

## Checklist de monitoramento

- **Verifique eventos usando a ferramenta de eventos de teste.**

  Essa ferramenta verifica se a carga de eventos do servidor está formada corretamente e ajuda a depurar atividades incomuns. Os eventos de teste devem aparecer na ferramenta em breve; caso contrário, verifique se a carga está estruturada corretamente usando o Payload Helper.

- **Compartilhe eventos de forma redundante.**

  A boa prática é usar a API de Conversões juntamente com o Pixel da Meta, compartilhando os mesmos eventos com ambas as ferramentas. Trata-se de uma configuração de evento redundante.

- **Verifique quais eventos você está compartilhando de forma redundante.**

  Use a aba **Visão geral do evento** nos detalhes de eventos do servidor para monitorar o volume de eventos e confirmar se o compartilhamento redundante está acontecendo conforme recomendado.

- **Monitore a cobertura de eventos.**

  Use a aba **Cobertura de eventos** para comparar a porcentagem de eventos recebidos da API de Conversões com eventos únicos do navegador do Pixel da Meta. Busque uma taxa de cobertura de eventos de 75% para garantir relatórios precisos e bom desempenho do anúncio.

- **Melhore a desduplicação de eventos.**

  A aba **Desduplicação de eventos** mostra quais chaves de desduplicação estão sendo compartilhadas. Use essas informações para avaliar se precisa melhorar a desduplicação dos eventos e garantir um monitoramento preciso.

- **Monitore regularmente a conexão da API de Conversões.**

  Na aba **Diagnóstico**, passe o cursor sobre o ícone **!** para ver mais informações sobre problemas e recomendações de melhoria. Essa abordagem proativa ajuda a manter uma configuração estável.

- **Verifique a qualidade da correspondência de eventos.**

  Use a aba **Correspondência de eventos** nos detalhes dos eventos do servidor. Ela mostra a qualidade da correspondência de eventos e oferece dicas de melhoria. Melhorar essa qualidade pode resultar em mais conversões e reduzir custos por resultado.

- **Confira se os dados dos eventos estão atualizados.**

  Use a aba **Nível de atualidade dos dados** para ver o atraso entre a ocorrência do evento e o momento em que os dados foram recebidos. O ideal é compartilhar eventos em tempo real ou o mais próximo possível do tempo real.

## Saiba mais

- Boas práticas para a API de Conversões.

- Diferenças entre contagens de eventos no Gerenciador de Anúncios, nos Relatórios de Anúncios e no Gerenciador de Eventos da Meta.

- [Sobre o Gerenciador de Eventos da Meta](gerenciador-eventos.md)

- [Rastreamento de conversão](conversion-traking.md)
