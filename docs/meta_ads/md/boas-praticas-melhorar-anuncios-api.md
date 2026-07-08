---
title: "Boas práticas para a API de Conversões ajudar a melhorar o desempenho do anúncio"
description: "Boas práticas para a API de Conversões melhorar o desempenho dos anúncios: eventos redundantes com o Pixel, meta de cobertura de 75%, desduplicação, pontuação EMQ (1–10), combinações mínimas de parâmetros (pós Graph API v13.0), ferramentas de teste, eventos offline/parceiros, pontuação de oportunidade e checklist de revisão."
tags: [capi, best-practices, performance, event-coverage, emq, redundancy]
related: [boas-praticas-api-conversao, detalhes-eventos-servidor, monitorar-api-conversao, pontuacao-oportunidade]
captured: 2026-06-23
---

# Boas práticas para a API de Conversões ajudar a melhorar o desempenho do anúncio

> Este artigo se aplica a empresas que usam a [API de Conversões](api-conversao.md) para enviar eventos do site. Algumas práticas também ajudam integrações de app, offline e outros eventos de servidor.

As boas práticas abaixo ajudam a tornar os eventos enviados pela API de Conversões mais úteis para otimização, mensuração e personalização de anúncios. Quando bem implementadas, elas podem melhorar o desempenho das campanhas e reduzir o custo por ação.

O ideal é aplicar essas práticas durante a configuração inicial. Se a API de Conversões já estiver ativa, use este guia como roteiro de auditoria e refinamento.

## Prioridades de configuração

| Prioridade | Objetivo | Impacto esperado |
| --- | --- | --- |
| **Eventos redundantes** | Enviar os mesmos eventos pelo Pixel da Meta e pela API de Conversões. | Capturar eventos que o navegador pode perder por bloqueios, falhas de rede ou carregamento incompleto. |
| **Cobertura de eventos** | Acompanhar a proporção entre eventos do navegador e eventos do servidor. | Dar mais sinais ao sistema de veiculação e melhorar a consistência dos relatórios. |
| **Desduplicação** | Evitar contagem dupla quando Pixel e API enviam o mesmo evento. | Preservar relatórios confiáveis e reduzir ruído nos sinais de otimização. |
| **Correspondência** | Enviar parâmetros de informações do cliente com permissão e consentimento adequados. | Aumentar a chance de associar eventos a Contas Meta e reportar conversões adicionais. |

## Configurações redundantes

- **Use a API de Conversões junto com o Pixel da Meta.** Compartilhe os mesmos eventos pelas duas ferramentas. Por exemplo, se o Pixel envia **Purchase**, **InitiateCheckout** e **Contact**, envie também esses eventos pelo servidor.

- **Monitore a cobertura de eventos.** A cobertura compara eventos do navegador e do servidor enviados à Meta. Busque uma taxa de cobertura de 75% da API de Conversões em relação aos eventos do Pixel da Meta.

- **Desduplique eventos redundantes.** Ao usar Pixel e API de Conversões juntos, inclua parâmetros de deduplicação para que a Meta mantenha uma ocorrência e descarte duplicatas.

## Parâmetros e desduplicação

- **Envie parâmetros obrigatórios.** Em eventos do site, inclua os parâmetros de evento e de informações do cliente exigidos. O parâmetro `action_source` deve refletir corretamente a origem do evento.

- **Inclua identificadores para desduplicação.** Para eventos redundantes do Pixel e da API, mantenha o mesmo `event_name` e use `event_id` ou uma combinação de `external_id` ou `fbp`. Isso ajuda a reduzir relatórios duplos.

- **Mantenha `fbp` e `fbc` atualizados.** Esses valores de cookie podem mudar. Quando enviados como parâmetros do usuário, devem ser recuperados e atualizados regularmente.

- **Use hashing quando necessário.** Se não usar o SDK de Negócios da Meta, implemente hashing para parâmetros que exigem proteção antes do envio.

## Qualidade da correspondência de eventos

A qualidade da correspondência indica quão bem os parâmetros enviados com os eventos ajudam a associar uma ação a uma Conta Meta. Uma correspondência melhor pode aumentar as conversões adicionais reportadas e melhorar os sinais usados pela veiculação.

**Aumente a cobertura de parâmetros** Inclua informações do cliente nos eventos quando houver permissão legal e consentimento para isso. **Priorize os parâmetros mais úteis** Dê atenção aos identificadores com maior chance de melhorar a correspondência para o seu público. **Acompanhe recomendações** Verifique a aba de detalhes no Gerenciador de Eventos para encontrar ações recomendadas. **Observe tendências** Monitore conversões adicionais ao longo do tempo para entender o impacto de melhorias na qualidade dos dados.

Em eventos do servidor, o Gerenciador de Eventos pode mostrar uma pontuação de qualidade da correspondência, ou EMQ, de 1 a 10. Essa pontuação indica a eficiência do evento em associar informações do cliente a uma conta do Facebook ou da Meta.

Atualmente, a qualidade de correspondência está disponível para eventos da web. Para eventos offline, de loja física, app, conversões de cadastros ou integrações em alfa/beta, a orientação pode depender de suporte específico da Meta.

> **Privacidade:** antes de compartilhar informações do cliente com terceiros, obtenha as permissões legais e consentimentos necessários. Para orientação técnica, consulte a documentação de privacidade da Meta e valide o plano de conformidade com assessoria jurídica.

## Requisitos básicos para correspondência

Depois da Graph API v13.0, a Meta passou a validar combinações de parâmetros de informações do cliente. Um evento pode ser considerado inválido se enviar apenas combinações amplas demais, com baixa chance de correspondência.

- Combinações como `ct`, `country`, `st`, `zp`, `ge` e `client_user_agent`, quando enviadas sozinhas ou como subconjunto, podem ser insuficientes.

- Combinações como `db` e `client_user_agent`, sem outros sinais mais fortes, também podem não atender aos requisitos.

- Priorize parâmetros de maior qualidade, como email, IP do cliente e outros identificadores permitidos, sempre respeitando consentimento e políticas aplicáveis.

## Ferramentas de implementação e teste

- **Use a ferramenta Eventos de Teste.** Valide se eventos do servidor foram configurados e recebidos corretamente, confira se eventos redundantes foram desduplicados e depure atividades incomuns.

- **Use o Auxiliar de carga.** Preencha campos obrigatórios e recomendados para entender a estrutura da carga e receber recomendações de parâmetros.

- **Use o SDK de Negócios quando fizer sentido.** Os exemplos de Python, Java, Ruby, PHP e Node podem reduzir desenvolvimento. Em alguns casos, o SDK automatiza tarefas como hashing de parâmetros.

- **Considere solicitações em lote.** Eventos em tempo real são preferíveis, mas solicitações em lote podem ajudar em fluxos quase em tempo real.

## Eventos offline e parceiros

- **Use a API de Conversões para eventos offline.** Ela pode funcionar como contêiner abrangente para vendas no local, ligações telefônicas, ações em dispositivos e assinaturas offline.

- **Configure `action_source` corretamente.** Ao enviar eventos offline, escolha uma fonte de ação adequada, diferente de `website` quando o evento não ocorreu no site.

- **Parceiros e agências devem enviar `partner_agent`.** Quem compartilha eventos em nome de anunciantes deve usar uma string única de agente/parceiro quando aplicável.

- **Plataformas devem explicar a decisão ao anunciante.** Para integrações de plataforma, deixe claro que Pixel e API de Conversões podem trabalhar juntos para compartilhamento de dados mais completo e confiável.

## Outras boas práticas

- **Compartilhe eventos em tempo real ou o mais perto possível disso.** Eventos recentes ajudam o sistema de veiculação a estimar a probabilidade de uma pessoa realizar a ação desejada depois de ver o anúncio.

- **Expanda a integração quando fizer sentido.** Conectar mais pixels e compartilhar mais eventos relevantes pode fornecer mais dados para otimização.

- **Monitore a configuração regularmente.** Acompanhe dados, diagnósticos, cobertura, desduplicação, qualidade de correspondência e atualidade no Gerenciador de Eventos.

- **Aplique recomendações de pontuação de oportunidade quando disponíveis.** Quando você se qualificar, poderá receber recomendações comprovadas de forma experimental, como anúncios em vídeo no celular. A [pontuação de oportunidade](pontuacao-oportunidade.md) ajuda a identificar e priorizar recomendações de campanha quase em tempo real, mas a pontuação (incluindo uma pontuação alta) em si não reflete nem garante desempenho real ou futuro.

## Testar a estratégia de anúncios

Depois de validar a implementação, use testes para entender o impacto da API de Conversões no desempenho das campanhas.

- **Estudo de Conversion Lift:** ajuda a entender o impacto incremental do uso de eventos do servidor.

- **Teste A/B:** ajuda a comparar estratégias de campanha e identificar a abordagem com melhores resultados e eficiência.

## Checklist de revisão

- Os eventos mais importantes para otimização são enviados tanto pelo Pixel quanto pela API de Conversões.

- A cobertura de eventos da API de Conversões está próxima ou acima da meta de 75% em relação aos eventos do Pixel.

- Eventos redundantes usam `event_name` consistente e identificadores adequados para desduplicação.

- Os parâmetros obrigatórios, recomendados, `fbp` e `fbc` foram revisados e atualizados.

- Os parâmetros de informações do cliente foram priorizados e enviados com base em consentimento e permissão legal.

- Eventos chegam com baixa latência, idealmente em tempo real ou quase em tempo real.

- A ferramenta Eventos de Teste foi usada para validar recebimento, desduplicação e depuração.

- O Gerenciador de Eventos é revisado com frequência para detectar avisos e oportunidades de melhoria.

## Saiba mais

- [Monitorar a API de Conversões](monitorar-api-conversao.md)

- [Detalhes de eventos do servidor no Gerenciador de Eventos](detalhes-eventos-servidor.md)

- [Boas práticas da API de Conversões](boas-praticas-api-conversao.md)

- [Comparar opções de configuração da API](comparar-opcoes-configuracoes-api.md)

- [Conversões offline](conversoes-offline.md)
