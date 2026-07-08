---
title: "Manual do Orçamento de Campanha Advantage+"
description: "Manual completo do orçamento de campanha Advantage+ (CBO): CBO vs orçamentos por conjunto, passo a passo, requisitos de qualificação, boas práticas, limitações pós-publicação em grandes campanhas e análise de relatórios."
tags: [campaign-budget, cbo, advantage-plus, how-to, best-practices]
related: [meta-advantage-plus-budget, relatorio-orcamento-campanha, gerenciador-edicoes-significativas]
captured: 2026-07-06
---

[← Voltar ao índice](INDEX.md)

# Manual do Orçamento de Campanha Advantage+

Um guia completo unificando conceitos fundamentais, passo a passo de configuração, regras de qualificação, boas práticas e análise de relatórios bayesianos.

## CBO vs. Orçamentos Individuais por Conjunto

O **Orçamento de Campanha Advantage+** (antigamente chamado de CBO - *Campaign Budget Optimization*) gerencia o investimento publicitário de forma consolidada. Ao invés de travar valores em cada conjunto, define-se um orçamento central único que a inteligência artificial da Meta distribui em tempo real para os conjuntos de anúncios com melhor performance.

**Recomendação básica:** O orçamento Advantage+ é indicado principalmente para campanhas contendo pelo menos **dois conjuntos de anúncios** ativos.

### Quando optar por cada modalidade?

| Escolha Orçamento Advantage+ se: | Escolha Orçamento por Conjunto se: |
| --- | --- |
| Você busca maximizar o volume total de conversões gerais da campanha. | Você deseja controlar rigidamente a verba gasta em cada público específico. |
| Você tem flexibilidade sobre de qual público virão as conversões. | O valor dos seus conjuntos de anúncios varia muito e os lances manuais não compensam essa discrepância. |
| Deseja simplificar o gerenciamento operacional diário da conta. | Há grandes disparidades no tamanho dos públicos ou você roda testes A/B rígidos de audiência. |
| Todos os conjuntos de anúncios são avaliados com igual importância. | Você tem metas de otimização ou estratégias de lance completamente distintas em cada conjunto. |

> **Compartilhamento do Orçamento do Conjunto:** Se optar por orçamentos de conjunto individuais devido a restrições rígidas, você pode ativar o "Compartilhamento do Orçamento" para permitir que o sistema transfira até 20% do orçamento diário entre os conjuntos em tempo real se surgirem melhores oportunidades, otimizando as conversões sem abrir mão do controle básico.

## Passo a Passo de Configuração

Você pode ativar o orçamento Advantage+ ao criar uma nova campanha ou ao editar uma campanha existente no Gerenciador de Anúncios.

1

#### Ative a Chave de Otimização

Na tela de criação da campanha, ative o botão **Orçamento de campanha Advantage+**. *Nota: Campanhas com objetivos de Vendas, Leads e Promoção do App já vêm com esta chave habilitada por padrão.*

2

#### Defina o Tipo de Orçamento

Selecione entre **Orçamento Diário** (média diária distribuída) ou **Orçamento Total** (gasto consolidado ao longo de toda a duração da campanha).

3

#### Insira o Valor e a Programação

Insira a verba e defina a data de início da campanha. Se utilizar o orçamento Total, é possível veicular anúncios programados configurando cronogramas horários em cada conjunto de anúncios.

4

#### Defina a Estratégia de Lance

Escolha a estratégia de lance da campanha (por exemplo: volume mais alto, limite de lance ou meta de custo por resultado).

**Restrição de Tempo (Carência de 2 Horas):** É exigida uma janela de carência de pelo menos 2 horas entre ligar e desligar o orçamento Advantage+. Se você ativou o CBO e precisa desativá-lo imediatamente (antes de 2 horas), pause a campanha e crie uma nova com orçamentos por conjunto.

## Requisitos de Qualificação da Campanha

Para habilitar e usar o orçamento Advantage+, a campanha deve obrigatoriamente cumprir os seguintes critérios em todos os seus conjuntos:

- **Mesmo Tipo de Orçamento:** Todos os conjuntos devem usar o mesmo tipo (todos Diário ou todos Total).

- **Mesma Estratégia de Lance:** Mesma regra de lance selecionada (ex: volume mais alto ou limite de custo).

- **Mesmo Evento de Otimização:** Se a estratégia for "volume mais alto", todos os conjuntos devem otimizar para o mesmo evento (ex: todos para Compra).

- **Veiculação Padrão:** O tipo de veiculação deve ser o padrão ("Standard") para todos os conjuntos.

## Boas Práticas para Turbinar sua Eficácia

Para obter os melhores resultados possíveis ao usar o orçamento Advantage+, atente-se às seguintes diretrizes:

Evite Pausas Manuais Frequentes

O CBO foca nos conjuntos de anúncios ativos. Se você pausar um conjunto e reativá-lo posteriormente, o orçamento da campanha pode já ter sido consumido pelos outros conjuntos ativos naquele dia.

Utilize Limites de Gastos com Moderação

Definir mínimos e máximos rígidos por conjunto restringe a liberdade da IA da Meta para buscar oportunidades mais baratas. Utilize limites apenas quando houver cotas orçamentárias corporativas rígidas.

Faça Alterações em Massa

Sempre que adicionar conjuntos de anúncios, faça-o em massa. Cada nova adição unitária força a campanha a retornar para a *fase de aprendizado*, o que pode instabilizar a entrega por cerca de 2 horas.

Entenda a Influência dos Públicos

Públicos com tamanhos muito desiguais fazem com que o orçamento Advantage+ direcione a maior parte da verba para o conjunto de anúncios com a maior audiência disponível.

**Atenção com Conjuntos de Baixa Veiculação:** Não pause conjuntos apenas porque eles estão recebendo pouca verba. O sistema detectou que as conversões ali seriam caras. Pausá-los reduz a flexibilidade futura e pode causar o aumento do CPA geral dos conjuntos que permaneceram ativos.

## Grandes Campanhas: Limitações Pós-Publicação

Ao configurar o orçamento de campanha Advantage+, você pode ter entre **70 e 200 conjuntos de anúncios** (ativos ou inativos combinados) em uma única campanha. Porém, isso gera bloqueios de edições.

**Importante:** Se a campanha contiver mais de 70 conjuntos de anúncios (incluindo inativos), você **não poderá atualizar** as seguintes configurações após a publicação:

- Desativar a chave de orçamento Advantage+ da campanha.

- Editar a estratégia de lance da campanha.

### Como contornar estes bloqueios?

Se você precisa fazer alterações em uma campanha publicada que estourou o limite de 70 conjuntos de anúncios:

1. **Duplicação:** Duplique a campanha ou os conjuntos de anúncios desejados e publique-os como uma nova campanha. *Nota: Isso pode reiniciar a fase de aprendizado.*

2. **Redução dos Conjuntos:** Exclua ou reduza os conjuntos ativos/inativos para menos de 70. Uma vez abaixo de 70, as chaves de edição do CBO e da estratégia de lance serão desbloqueadas.

3. **Duplicar Removidos:** Após salvar as alterações na campanha original (agora com menos de 70 conjuntos), você pode duplicar os conjuntos excluídos de volta ou movê-los para uma campanha secundária.

O limite absoluto de conjuntos de anúncios (ativos e inativos acumulados) por campanha é de **200 conjuntos**. Ao atingir 200, você não poderá adicionar ou duplicar novos conjuntos na mesma campanha.

## Análise e Otimização de Performance

A premissa número um do orçamento Advantage+ é: **avalie sempre os resultados no nível da campanha**, e não no nível de cada conjunto individual.

Flutuações Diárias de até 75%

Os orçamentos diários representam médias. Em dias com alta oportunidade de conversões baratas, o gasto diário pode ultrapassar em até 75% a meta configurada, compensando em dias de baixa conversão.

Alterações no Fim do Dia

Ajustar orçamentos ou programações muito próximo ao encerramento do dia útil impede que o algoritmo tenha tempo de suavizar o gasto, gerando picos indesejados de CPA temporário.

Curva Normal de Aumento de CPA

É natural que o CPA médio suba de forma gradual ao longo do tempo. O sistema de veiculação esgota as oportunidades mais baratas primeiro antes de comprar conversões mais caras.

Detalhamentos de Tempo Limitados

Cuidado ao filtrar relatórios por janelas horárias curtas. Oscilações momentâneas no rendimento compensam-se ao longo da janela completa de 24 horas.

## Estudo Prático: O Modelo de Oportunidades (Estratégia de Volume)

Ao usar a estratégia de lance de **volume mais alto** com o orçamento Advantage+, o sistema busca maximizar o total de conversões. Isso pode fazer com que o custo médio por resultado de um conjunto pareça caro, mas desligar esse conjunto aumenta o CPA geral da campanha. Veja a simulação abaixo:

Cenário: 15 Oportunidades Totais de Conversão com Verba de US$ 30

Simule as configurações para entender a lógica matemática bayesiana da Meta:

#### Conjunto A

3 Conversões Gasto: US$ 15 (CPA: US$ 5)

#### Conjunto B

6 Conversões Gasto: US$ 12 (CPA: US$ 2)

#### Conjunto C

3 Conversões Gasto: US$ 3 (CPA: US$ 1)

Resultado: 12 Conversões por US$ 30 (CPA Médio Geral: US$ 2,50)

**Explicação Matemática:** Ao gastar US$ 15 no Conjunto A para obter conversões de US$ 5, o sistema evitou ter que comprar oportunidades mais caras de US$ 3.60 ou mais em outros conjuntos cujas oportunidades baratas já haviam esgotado.
