# Playbook de Growth — Índice

> Corpus autoral em pt-BR sobre CRO, checkout, oferta e funil, sintetizado de pesquisa
> publicada e frameworks de mercado com atribuição de fontes (modelo editorial e mapa de
> trust levels em `../README.md`). Cada arquivo tem frontmatter YAML com `description`,
> `tags` (em inglês), `related`, `sources` e `trust` (nível de confiança por documento).

Como usar este índice: localize o documento pela descrição abaixo e leia apenas os
arquivos relevantes para a tarefa. Complementa o corpus `docs/meta_ads/` — este cobre o
que acontece **depois do clique** e **antes da campanha** (página, checkout, oferta).

## Checkout e pagamento

- [Abandono de checkout: taxa média e causas documentadas](checkout-abandono-causas.md) (trust 2): Síntese da pesquisa do Baymard Institute — taxa média de abandono em torno de 70%, ranking das causas evitáveis (custos extras, conta obrigatória, fluxo longo, desconfiança) e como usá-las como baseline de diagnóstico do funil.
- [Meios de pagamento no Brasil: PIX, parcelamento e boleto](checkout-br-pagamentos.md) (trust 4): Como a escolha e a apresentação dos meios de pagamento no checkout próprio brasileiro movem a conversão — PIX (aprovação instantânea), parcelamento (ancoragem na parcela), boleto (conversão baixa que exige recuperação), cartão recusado — e o diagnóstico pelo mix de pagamento.

## Oferta e pricing

- [Equação de valor: diagnóstico de oferta fraca](oferta-value-equation.md) (trust 4): Framework da equação de valor (Hormozi) — resultado sonhado × probabilidade percebida ÷ tempo × esforço — para diagnosticar quando o gargalo é a oferta e quais alavancas reforçá-la antes de mexer no preço.
- [Preço, ancoragem e enquadramento da decisão](pricing-ancoragem-decisao.md) (trust 4): Preço é julgado de forma relativa — ancoragem, efeito chamariz, enquadramento por parcela/por dia e o preço como sinal de qualidade. A alavanca raramente é baixar o preço; é reancorar a comparação antes de descontar.

## Página de vendas e funil

- [Congruência anúncio → página (message match)](congruencia-anuncio-pagina.md) (trust 4): Princípio de information scent (NN/g) aplicado à transição anúncio→página: por que CTR alto com conversão baixa costuma ser quebra de promessa e o que alinhar primeiro (headline, ângulo, visual).
- [Estrutura da página de vendas e da VSL](pagina-vendas-estrutura.md) (trust 4): A página/VSL como sequência projetada (primeira dobra → problema → solução → prova → oferta → garantia → CTA repetido) e como diagnosticar onde ela perde o visitante por profundidade de rolagem e retenção de vídeo.
- [Prova social e sinais de confiança](prova-social-sinais-confianca.md) (trust 2): Prova reduz o risco percebido (probabilidade na equação de valor); sinais de confiança reduzem a ansiedade da transação — cada tipo de prova responde a uma objeção diferente, e o diagnóstico casa o tipo de prova com a objeção dominante.

## Criação de conteúdo e criativos

- [Anatomia do criativo de performance: gancho, ângulo e prova](criativo-gancho-angulo-prova.md) (trust 4): Decomposição do criativo em três camadas com falhas mensuravelmente distintas — hook rate, hold rate e CTR dizem qual camada variar — e como a taxonomia alimenta a biblioteca de criativos etiquetada.
- [Taxonomia de ganchos visuais e o erro fatal da introdução lenta](taxonomia-ganchos-visuais.md) (trust 5): Arquétipos de gancho (sensorial, quebra de padrão física, antes/depois imediato) e os erros que matam retenção nos primeiros 3 segundos (autoapresentação lenta, abertura institucional, explicar antes de prender atenção) — catálogo tático que complementa a camada de gancho.
- [Formato lista/carrossel para topo de funil](formato-lista-carrossel-topo-funil.md) (trust 5): Por que salvamento (não curtida) é o sinal que importa em conteúdo de topo de funil, a anatomia do carrossel de lista (capa, headline de "inimigo comum", miolo denso, CTA único) e como não medir esse formato pela régua errada.
- [Copy que converte: headline, frameworks e nível de consciência](copy-frameworks-headline.md) (trust 4): A headline carrega a maior parte do peso; frameworks (PAS/AIDA/BAB, inimigo comum) são andaimes; e a mensagem precisa casar com o nível de consciência do público (Schwartz, com a simplificação operacional de três estágios e sua métrica). Como diagnosticar copy genérica e o que reescrever primeiro.
- [Público, segmentação e fit ângulo–mercado](publico-segmentacao-angulo.md) (trust 4): Na entrega por IA da Meta (público amplo/Advantage+) o criativo é a segmentação; a mesma oferta exige ângulos diferentes por segmento. Como não confundir "público errado" com "ângulo errado para este público" e separar fadiga de saturação.

## Arquitetura de funil e escala

- [Tipos de funil e critérios de escolha](tipos-funil-escolha.md) (trust 4): Mapa dos funis de aquisição (página+checkout low ticket, VSL, quiz diagnóstico→low ticket→webinário, webinário, lançamento) e os critérios — ticket, consciência, autoridade, complexidade da promessa — mais a régua de níveis de escala: criativo → oferta → funil.
- [Funil perpétuo para público frio: teto de ticket e teto de nicho](funil-perpetuo-ticket-frio.md) (trust 5): Heurísticas de praticante BR — ticket ouro ~R$297 para frio (acima exige autoridade e outro funil), VSL pelo tempo de tela, ticket define o mix de pagamento, e o nicho tem teto de faturamento que define o funil inteiro.
- [Esteira de oferta: order bump, upsell, downsell e recuperação](esteira-upsell-recuperacao.md) (trust 5): O ticket médio é o que desbloqueia escala — order bump/upsell 1-click puxam o AOV, downsell recupera 5–15% das recusas, recuperar upsell rende mais que carrinho abandonado, e PIX/boleto pendente não é abandono.
- [Escada de valor e backend: diagnosticando o platô de faturamento](escada-valor-backend-ltv.md) (trust 5): Quando a conta empaca com front-end saudável, a causa relatada é arquitetura de produto — falta backend (ticket maior para quem já comprou) e falta audiência própria — não mídia. Como diferenciar isso de teto de nicho e de esteira de sessão única.
- [Teste, validação e escala de campanhas: heurísticas de operação](teste-escala-orcamento.md) (trust 5): O ciclo testar→validar→escalar com papéis separados — régua de validação por criativo, degraus de orçamento lendo o pós-aumento, campanha de escala intocável, duplicação com limite de custo — e os anti-padrões day trade e "esperar otimizar".

## Mensuração e funil

- [Mensuração de funil: o que medir para o diagnóstico fechar](mensuracao-funil-metricas.md) (trust 4): As métricas mínimas do funil (visitas, checkout iniciado, compra, pagamento pendente, reembolso, receita líquida, margem) e qual taxa separa cada hipótese concorrente — página vs. checkout vs. preço. É o mapa do que o motor pede em `missing_data`.
