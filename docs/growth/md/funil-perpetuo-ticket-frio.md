---
title: "Funil perpétuo para público frio: teto de ticket e teto de nicho"
description: "Heurísticas de praticante BR para perpétuo escalado a frio: existe um teto de ticket para público frio (~R$297 — o 'ticket ouro'); acima disso a venda depende de autoridade e pede outro funil. VSL converte ticket médio melhor que página estática pelo tempo de tela; e o nicho tem teto de faturamento que define o funil inteiro."
tags: [perpetual-funnel, cold-traffic, ticket, vsl, niche, funnel-economics]
related: [tipos-funil-escolha, esteira-upsell-recuperacao, checkout-br-pagamentos, oferta-value-equation]
sources: ["Thiago Ruas — podcast Segredos da Escala (Vturb) sobre funis perpétuos para público frio", "prática de mercado BR de perpétuo para infoprodutos"]
trust: 5
captured: 2026-07-10
---

[← Voltar ao índice](INDEX.md)

# Funil perpétuo para público frio: teto de ticket e teto de nicho

## Princípio

Perpétuo escalado **a público frio** obedece a dois tetos que o anunciante não controla
com criativo nem com verba: o **teto de ticket** (quanto um desconhecido paga para quem
nunca viu) e o **teto de nicho** (quanta gente existe com aquela dor e quanto ela paga).
Muita "campanha ruim" é, na verdade, um funil montado acima de um desses tetos — e nenhum
ajuste de mídia conserta isso.

## Evidência

Trust 5 — heurísticas de praticante nomeado (Thiago Ruas, especialista em perpétuo BR de
múltiplos 7 dígitos/mês), não pesquisa controlada. Cite sempre como "heurística de
praticante", nunca como regra:

- **Ticket ouro do frio ≈ R$297**: acima disso, escalar perpétuo para público frio fica
  desproporcionalmente difícil — a venda passa a depender de **autoridade** construída
  (o comprador conhece o expert), e o jogo muda de funil (webinário/lançamento). Vender
  ticket alto "no perpétuo" geralmente é vender para audiência quente via autoridade,
  não para frio.
- **VSL > página estática para o topo desse ticket**: o tempo de tela da VSL constrói o
  valor que um ticket de R$147–297 exige; página estática segura melhor tickets menores.
  Bônus operacional: retenção de VSL é metrificável minuto a minuto, o que torna o
  diagnóstico do funil muito mais fino que o de uma página.
- **O ticket define o mix de pagamento**: na faixa de R$297 predomina cartão de crédito
  (na experiência citada, ~70%), destravando upsell 1-click e ticket médio; no low ticket
  o PIX domina e trava a esteira (ver [checkout-br-pagamentos](checkout-br-pagamentos.md)
  e [esteira-upsell-recuperacao](esteira-upsell-recuperacao.md)).
- **Nicho tem teto de faturamento**: avaliar o nicho vem **antes** de oferta, criativo e
  funil — nichos pequenos/meio-de-funil não escalam perpétuo a frio por definição
  (pouca gente para o algoritmo encontrar), e a comparação com "big niches" gera
  diagnóstico errado de desempenho.

## Quando se aplica

- Produto digital vendido em perpétuo com tráfego frio via Meta Ads — o recorte central
  da Seenaly. No passo 0, os tetos orientam o desenho: o preço pretendido no
  `product_context` cabe no funil pretendido?
- Não se aplica a vendas por autoridade/audiência quente, remarketing ou lançamento —
  ali os tetos são outros.

## Como diagnosticar

- **Ticket acima de ~R$300 + tráfego frio + conversão persistentemente baixa** com
  página/checkout saudáveis: suspeite de funil incompatível com o ticket antes de culpar
  criativo — a hipótese é "ticket exige autoridade que o frio não tem".
- **CPA razoável mas escala trava cedo** (aumentos de verba degradam rápido): suspeite de
  teto de nicho — o público-alvo real é menor do que o funil precisa.
- **Low ticket com margem espremida e PIX dominante**: o gargalo é a esteira/mix de
  pagamento, não a taxa de conversão (ver esteira).
- Discriminador a pedir em `missing_data`: ticket médio real, mix de pagamento e tamanho
  estimado do público (ver corpus `meta-ads-docs` para estimativas de público).

## Ação recomendada

1. **Valide o trio nicho → oferta → funil nessa ordem** antes de otimizar mídia: nicho
   com teto compatível com a meta; oferta cuja promessa caiba no ticket; funil compatível
   com o ticket (ver [tipos-funil-escolha](tipos-funil-escolha.md)).
2. **Ticket até ~R$297 a frio**: perpétuo com VSL é o caminho testado; acima disso,
   proponha webinário/lançamento ou construção de autoridade como experimento.
3. **Se o ticket não pode baixar** (margem/posicionamento): não force o perpétuo a frio —
   redesenhe o funil, não o orçamento.
4. Formule sempre como experimento com critério de sucesso (CPA-alvo vs. margem do
   `product_context`) e registre na memória de experimentos.

## Riscos e limites

- Trust 5: números de um praticante (R$297, ~70% cartão) são **ordens de grandeza da
  experiência dele**, não constantes — variam por nicho, ano e maturidade; o motor deve
  apresentá-los como referência de mercado a validar, jamais como benchmark do cliente.
- O teto de ticket se refere a **público frio**; com autoridade/audiência o mesmo produto
  vende mais caro — não aplicar o teto a contas maduras com remarketing forte.
- Teto de nicho não é desculpa universal: antes de concluir "nicho esgotado", descarte
  fadiga de criativo e ângulo errado (ver [publico-segmentacao-angulo](publico-segmentacao-angulo.md)).
