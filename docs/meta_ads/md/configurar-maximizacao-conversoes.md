---
title: "Como configurar a maximização do valor das conversões na sua configuração da SKAdNetwork"
description: "Como ativar a maximização do valor das conversões na configuração da SKAdNetwork (iOS 14.5+): conjuntos de valores por evento de compra, requisitos de dados e o consumo de pelo menos 4 espaços de eventos no Gerenciador de Eventos."
tags: [skadnetwork, ios, value-optimization, app-events, how-to]
related: [requisitos-maximizar-conversoes, eventos-app, relatorio-de-anuncios]
---

# Como configurar a maximização do valor das conversões na sua configuração da SKAdNetwork

Se você usa a API SKAdNetwork da Apple para alcançar pessoas no iOS 14.5 ou posterior e deseja usar a maximização do valor das conversões, ative Maximizar o valor das conversões no Gerenciador de Eventos e habilite um conjunto de valores para cada evento de compra que pretende maximizar para valor. Você deve ativar a maximização do valor das conversões na configuração de eventos do app para a SKAdNetwork. No entanto, não é necessário ativar a maximização do valor das conversões para eventos enviados pela Mensuração de Eventos Agregados.

**Observação:** agora, é possível usar a maximização do valor das conversões para um evento além daqueles que você priorizou para dispositivos iOS 14.5 ou posterior no Gerenciador de Eventos. Nesse caso, não é necessário ativar a maximização do valor das conversões nem habilitar um conjunto de valores no Gerenciador de Eventos. No entanto, é possível que você não consiga alcançar as pessoas que não concederam permissão à ATT.

## Como configurar a maximização do valor das conversões na sua configuração da SKAdNetwork

Se você enviar eventos do app por meio da SKAdNetwork, siga estas etapas para configurar a maximização do valor das conversões e alcançar pessoas que usam dispositivos iOS 14.5 ou posterior:

1. Configure uma integração, como a API de Conversões ou o SDK do Facebook, que envia e otimiza eventos de compra com valores de rastreamento.

2. Depois que sua integração começar a enviar dados, a Meta poderá determinar um conjunto de valores para o evento de otimização escolhido. Isso acontece automaticamente na configuração do evento do app para a SKAdNetwork, a menos que você decida personalizar a configuração de eventos do app. Um [conjunto de valores](/business/help/378857770047703) agrupa conversões para maximizar o valor delas e ajuda nosso sistema a relatar o valor dessas conversões. Para garantir que você tenha dados suficientes para a Meta determinar um conjunto de valores para o evento escolhido, sua integração deve atender aos [requisitos de qualificação para maximizar o valor das conversões](/business/help/571188993373447).

3. Agora que você tem dados suficientes, pode ativar a maximização do valor das conversões no Gerenciador de Eventos e ativar seus conjuntos de valores quando [configurar eventos do app para a SKAdNetwork](/business/help/670955636925518). Definimos automaticamente os intervalos de conjuntos de valores, a menos que você decida personalizar a configuração de eventos do app para a SKAdNetwork.

**Observação:** ao ativar a maximização do valor das conversões, você usará pelo menos quatro dos espaços de eventos disponíveis para configuração no Gerenciador de Eventos sob a [SKAdNetwork](/business/help/188126096313109). Isso acontece porque precisamos de pelo menos quatro faixas de valores para que a maximização do valor das conversões funcione. Cada intervalo ocupa um espaço do evento. Saiba mais sobre [conjuntos de valores](/business/help/378857770047703) e [Prioridade do Evento](/business/help/193250612476055).

4. Depois de ativar a otimização do valor das conversões no Gerenciador de Eventos, será possível criar uma campanha ou um conjunto de anúncios com otimização de valor no Gerenciador de Anúncios. É possível conferir os resultados na coluna de ROAS, localizada na tabela de relatórios do Gerenciador de Anúncios.

## Saiba mais

- [Sobre a maximização do valor das conversões](/business/help/296463804090290)

- [Requisitos de qualificação para maximizar o valor das conversões](/business/help/571188993373447)

- [Sobre conjuntos de valores](/help/378857770047703)
