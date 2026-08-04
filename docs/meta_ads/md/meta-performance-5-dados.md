---
title: "Use dados de alta qualidade"
description: "Performance 5 — Lição 4, Use dados de alta qualidade: API de Conversões como fundamento, métodos de integração (direta, parceiro, gateway), pontuação EMQ e boas práticas de qualidade de dados."
trust: 4
tags: [performance-5, blueprint, capi, data-quality, emq]
related: [api-conversao, comparar-opcoes-configuracoes-api, boas-praticas-melhorar-anuncios-api, meta-performance-5-resultados]
captured: 2026-06-23
---

# Use dados de alta qualidade

![Ilustração de qualidade de correspondência: variações de criativo de produto aprovadas e selo 'Match Quality — Event Match Score 92%'.](assets/meta-performance-5-dados-01-c5a0e1.jpg)

Melhorar a qualidade dos dados da sua campanha de anúncio.

# A importância dos dados de qualidade

A forma como as pessoas encontram e compram produtos está em constante evolução. Hoje, as pessoas compram em lojas físicas, online, em apps para celular e nas redes sociais. E não há uma ordem específica para fazer isso, o que faz com que cada jornada de compra seja única e variada.

Dados de alta qualidade em conjunto com soluções de IA podem ajudar a encontrar as pessoas em seus caminhos distintos até a compra.

# Melhore a qualidade dos dados com a API de Conversões

Você pode implementar a API de Conversões para melhorar a qualidade dos seus dados. A API de Conversões pode ajudar você a compreender melhor e se conectar com clientes novos e existentes. Ela foi desenvolvida para servir de conexão direta entre os dados de marketing entre canais e os sistemas que ajudam a otimizar o desempenho dos anúncios nas tecnologias da Meta.

# Métodos de integração da API de Conversões

Existem várias opções de integração da API de Conversões disponíveis para você, de acordo com as necessidades da sua empresa.

Confira três opções para começar a usar a API de Conversões:

Ele permite que você conclua a integração em poucas horas. É uma opção de configuração de autoatendimento e sem código que está disponível no Gerenciador de Eventos da Meta. Atualmente, o Conversions API Gateway está disponível para as empresas que usam a Amazon Web Services (AWS) ou o Google Cloud Platform (GCP).

Para ter mais controle sobre o processo de integração, você pode construir uma integração direta com a API de Conversões, o que requer um desenvolvedor. Visite o Meta for Developers para ver como configurar uma integração direta e compartilhar eventos do site, do app ou offline.

Você pode configurar a API de Conversões com uma solução de parceiro e simplificar o processo sem custos adicionais. Exemplos de plataformas de comércio eletrônico incluem: Shopify, WooCommerce, Wix e BigCommerce. Exemplos de plataformas de parceiro de site incluem: Adobe, Gerenciador de tags do Google e Tealium.

# Boas práticas de qualidade dos dados

Implementar a API de Conversões é a primeira etapa. Para obter todos os benefícios da API de Conversões, você também pode otimizar sua configuração.

A qualidade da correspondência de eventos (EMQ) indica a probabilidade de o sistema associar com eficácia as informações do servidor de um cliente a uma conta nas tecnologias da Meta. Uma melhor qualidade da correspondência significa que os eventos têm maior probabilidade de corresponder a uma conta, o que pode ajudar você a obter mais conversões e reduzir o custo por resultado.

Para alcançar uma EMQ maior, priorize os parâmetros de informações do cliente com maior probabilidade de melhorar a qualidade de correspondência, por exemplo, email convertido em hash, endereço IP, telefone convertido em hash.

As configurações redundantes são úteis porque a API de Conversões permite compartilhar eventos do site que talvez o Pixel da Meta perca, por exemplo, devido a erros no carregamento da página ou problemas de conectividade de rede.

Outros detalhes: no Gerenciador de Eventos da Meta, identifique Navegador + servidor na coluna Método de conexão para garantir que todos os eventos sejam redundantes.

Para configurações redundantes, os anunciantes enviam dois eventos equivalentes para a mesma ação: um do navegador e outro do servidor.

Configure uma identificação única para cada evento a fim de garantir que eventos equivalentes sejam desduplicados e contados só uma vez. Caso contrário, o desempenho da campanha poderá ser afetado.

Outros detalhes: para que os eventos sejam desduplicados, determine se eles são iguais. Para tal, use a mesma convenção de nome para o nome do evento (por exemplo, Purchase ou AddToCart) e a identificação do evento.

A atualidade dos dados ocorre quando você compartilha os eventos em tempo real ou o mais próximo possível do tempo real. Isso é importante porque, quanto mais cedo você compartilhar os eventos, melhor o sistema de veiculação de anúncios poderá avaliar a probabilidade de uma pessoa realizar a ação desejada depois de ver o anúncio.

Outros detalhes: confira a atualidade dos dados na aba “Atualidade dos dados” no Gerenciador de Eventos da Meta.

# Melhore a configuração de dados com anúncios de catálogo Advantage+

Anunciantes do comércio eletrônico e do varejo que usam os anúncios de catálogo Advantage+ devem se concentrar na qualidade do catálogo para aproveitar ao máximo a configuração dos dados.

![Três pilares de qualidade de catálogo: Match rate (taxa de correspondência entre eventos e itens do catálogo), Product availability (disponibilidade do produto — comprar agora vs avisar), Event quality (qualidade dos eventos por produto).](assets/meta-performance-5-dados-04-caa839.png)

Verifique as taxas de correspondência Verifique a taxa de correspondência do catálogo no Gerenciador de Comércio e tenha como objetivo taxas de correspondência superiores a 90%. Essa taxa representa a porcentagem de produtos recebidos por meio de eventos da sua fonte de dados (Pixel da Meta ou SDK do app) que podem ser associados a um item de um catálogo.

Paridade da seleção no site Inclua no catálogo todos os produtos disponíveis no site, a fim de aumentar a relevância para uma grande variedade de compradores.

Monitore a disponibilidade dos produtos Mantenha seu catálogo atualizado em relação a itens fora de estoque e analise produtos rejeitados no Gerenciador de Comércio regularmente para garantir que eles estejam disponíveis para anúncios.

# Métricas da tabela de resultados para qualidade dos dados

![Trecho do scorecard — Qualidade dos dados: implementar a API de Conversões junto com o Pixel da Meta — razão servidor/navegador >30% (P0); aumentar a qualidade da correspondência de eventos — verificar o limite mínimo do evento no Gerenciador de Eventos (P0); melhorar a taxa de correspondência do catálogo >90% (P1).](assets/meta-performance-5-dados-05-c6f811.png)

Há várias ações recomendadas para esta categoria.

- Implementar a API de Conversões em conjunto com o Pixel da Meta. Esta é uma prioridade P0. A proporção entre servidor e navegador deve ser superior a 90%.

- Aumentar a pontuação da qualidade da correspondência de eventos: a pontuação da qualidade da correspondência de eventos mensura o nível de precisão com que os dados são transmitidos de forma bidirecional em tempo real. Quanto mais próximo do tempo real, maior é a pontuação. Você pode encontrar a pontuação da qualidade da correspondência de eventos no Gerenciador de Eventos. A recomendação é conferir o limite mínimo do evento no Gerenciador de Eventos.

Implementar a API de Conversões em conjunto com o Pixel da Meta. Esta é uma prioridade P0. A proporção entre servidor e navegador deve ser superior a 90%.

Aumentar a pontuação da qualidade da correspondência de eventos: a pontuação da qualidade da correspondência de eventos mensura o nível de precisão com que os dados são transmitidos de forma bidirecional em tempo real. Quanto mais próximo do tempo real, maior é a pontuação. Você pode encontrar a pontuação da qualidade da correspondência de eventos no Gerenciador de Eventos. A recomendação é conferir o limite mínimo do evento no Gerenciador de Eventos.

- Melhorar a taxa de correspondência do catálogo: esta métrica é voltada para anunciantes que usam os anúncios de catálogo Advantage+. O objetivo é alcançar uma taxa de correspondência do catálogo superior a 90%. Esta é uma prioridade P1.

Melhorar a taxa de correspondência do catálogo: esta métrica é voltada para anunciantes que usam os anúncios de catálogo Advantage+. O objetivo é alcançar uma taxa de correspondência do catálogo superior a 90%. Esta é uma prioridade P1.

# Onde encontrar informações sobre qualidade dos dados

Você pode encontrar informações sobre a qualidade dos dados (como a pontuação da qualidade da correspondência de eventos) no Gerenciador de Eventos e sobre a taxa de correspondência do catálogo no Gerenciador de Comércio.

Nota: a interface do usuário pode ser alterada à medida que o produto evolui.

![Capturas de ferramentas: à esquerda, Gerenciador de Eventos com Event Match Quality Score 7.4/10 para o evento Purchase e recomendações (enviar Click ID/fbc, IPv6, Facebook Login ID); à direita, Commerce Manager > Catalog > Events mostrando taxa de correspondência do catálogo — verde indica alta qualidade, vermelho indica problemas (ex.: Pixel sem eventos otimizados para iOS 14.5+).](assets/meta-performance-5-dados-06-3781cf.png)

A equipe da Spruce quis melhorar a qualidade dos dados de sua campanha de anúncios e, recentemente, concluiu a integração da API de Conversões. Quando a empresa verificou o Gerenciador de Eventos, ficou surpresa ao constatar que a pontuação da qualidade de correspondência de eventos era menor do que a esperada.

Aviso legal: a Spruce é uma empresa fictícia criada pela Meta. Qualquer semelhança com o conteúdo produzido por empresas reais não é intencional. Este exemplo é para fins meramente ilustrativos.

Para ajudar a melhorar a qualidade dos dados, implemente a API de Conversões. A API de Conversões ajuda as empresas a compreender melhor e se conectarem com clientes novos e existentes.

Para otimizar o desempenho a API de Conversões:

- Melhore a qualidade da correspondência de eventos priorizando os parâmetros do cliente, como email convertido em hash, endereço IP e telefone convertido em hash.

- Configure o Pixel da Meta em conjunto com a API de Conversões. Essa configuração permite compartilhar eventos do site que talvez o Pixel da Meta perca devido a erros no carregamento da página ou problemas de conectividade de rede.

- Configure uma identificação única para cada evento para garantir que os eventos equivalentes entre a API de Conversões e o Pixel da Meta sejam desduplicados e contados apenas uma vez.

- Compartilhe seus eventos com as tecnologias da Meta em tempo real ou o mais próximo possível do tempo real.

Melhore a qualidade da correspondência de eventos priorizando os parâmetros do cliente, como email convertido em hash, endereço IP e telefone convertido em hash.

Configure o Pixel da Meta em conjunto com a API de Conversões. Essa configuração permite compartilhar eventos do site que talvez o Pixel da Meta perca devido a erros no carregamento da página ou problemas de conectividade de rede.

Configure uma identificação única para cada evento para garantir que os eventos equivalentes entre a API de Conversões e o Pixel da Meta sejam desduplicados e contados apenas uma vez.

Compartilhe seus eventos com as tecnologias da Meta em tempo real ou o mais próximo possível do tempo real.

Cursos do Meta Blueprint e artigos da Central de Ajuda para Empresas relacionados

- Sobre a API de Conversões

- Configurar o Pixel da Meta e a API de Conversões para campanhas de anúncios

- Sobre os anúncios de catálogo Advantage+ da Meta
