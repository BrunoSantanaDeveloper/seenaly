---
title: "Mensuração de funil: o que medir para o diagnóstico fechar"
description: "O motor só diagnostica o pós-clique se o funil estiver instrumentado. Define as métricas mínimas — visitas, checkout iniciado, compra, pagamento pendente, reembolso, receita líquida, margem — e por que cada uma discrimina hipóteses concorrentes (página vs. checkout vs. preço). É o mapa do que o motor pede em missing_data."
tags: [measurement, funnel, analytics, metrics, attribution, missing-data]
related: [checkout-abandono-causas, congruencia-anuncio-pagina, oferta-value-equation]
sources: ["mecânica oficial de pixel/CAPI e eventos da Meta — ver corpus meta-ads-docs", "fundamentos de mensuração de funil e a decomposição CPA = CPC ÷ conversão pós-clique (docs/PRODUCT.md)"]
trust: 4
captured: 2026-07-10
---

[← Voltar ao índice](INDEX.md)

# Mensuração de funil: o que medir para o diagnóstico fechar

## Princípio

O motor de diagnóstico só localiza um gargalo **pós-clique** se o funil estiver
**instrumentado**. A Meta enxerga até a borda da plataforma (clique, e os eventos que o
pixel/CAPI reportam); o que acontece **na página, no checkout e depois da venda** só existe
para o diagnóstico se for medido. Sem essas métricas, o motor não consegue separar hipóteses
concorrentes e faz a coisa honesta: pede o dado em `missing_data` em vez de supor. Este card
é o **mapa do que medir** para o diagnóstico fechar.

## Evidência

A decomposição-mãe (ver `docs/PRODUCT.md`): **CPA = CPC ÷ taxa de conversão pós-clique**.
Cada etapa do funil é uma taxa de conversão entre dois eventos, e é a **queda entre eventos
específicos** que aponta o gargalo — não a métrica agregada. A mecânica de captura
(pixel, CAPI, eventos padrão, desduplicação, EMQ) é oficial e vive no corpus
`meta-ads-docs`; aqui está **o que** medir e **por quê**, não o como técnico.

Métricas mínimas do funil, e a pergunta que cada uma responde:

- **Visitas à página** (por origem): o clique virou sessão? (base de tudo pós-clique)
- **Taxa de conversão da página → checkout iniciado**: a página convence? (message
  match / estrutura)
- **Checkout iniciado → compra** (taxa de conclusão): o checkout/oferta/preço fecham?
- **Pagamento pendente** (PIX/boleto): venda em aberto, recuperável — não é abandono.
- **Reembolso / chargeback**: a promessa foi sustentada? (qualidade da oferta, não do ads)
- **Receita líquida e margem** (por produto): o que sobra depois de taxas/reembolso —
  liga a conversão à economia unitária e ao CAC-alvo.

## Quando se aplica

- Sempre que o diagnóstico apontar (ou suspeitar de) gargalo pós-clique. É pré-requisito
  da Fase de funil/vendas reais (Fase 6 do roadmap) e a razão de o motor hoje pedir tantos
  dados via `missing_data`.
- No passo 0, orienta **o que instrumentar antes de escalar tráfego** — funil cego não
  gera diagnóstico, gera achismo.

## Como diagnosticar (qual métrica separa qual hipótese)

- **Página → checkout baixa**: gargalo **antes** de decidir comprar — promessa/estrutura
  da página (message match, primeira dobra). Sai para
  [congruencia-anuncio-pagina](congruencia-anuncio-pagina.md) /
  [pagina-vendas-estrutura](pagina-vendas-estrutura.md).
- **Checkout iniciado → compra baixa**: gargalo **na hora de pagar** — fricção de
  checkout, meio de pagamento, ou preço. Discrimine com o **breakdown por meio de
  pagamento** (ver [checkout-br-pagamentos](checkout-br-pagamentos.md)): queda em boleto =
  recuperação; recusa de cartão = técnico; queda geral = preço/oferta.
- **Compra alta + reembolso alto**: não é problema de aquisição — é **promessa vs.
  entrega**; otimizar tráfego só amplifica o prejuízo.
- **Boa conversão + margem negativa**: o gargalo é **economia unitária** (preço, taxas,
  CAC), não funil — medir receita líquida revela o que a taxa de conversão esconde.
- **Sem esses dados**: o motor NÃO deve escolher entre página/checkout/preço no escuro —
  nomeia as hipóteses e pede em `missing_data` exatamente a taxa que as separa.

## Ação recomendada

1. **Instrumente as taxas entre eventos**, não só os totais — o diagnóstico mora na queda
   entre dois passos, não no número absoluto.
2. **Separe pendente de perdido**: PIX/boleto pendente é linha própria; contá-los como
   abandono corrompe o diagnóstico de checkout.
3. **Meça reembolso e margem por produto** — sem isso, "aumente a conversão" pode piorar o
   resultado (mais vendas ruins).
4. **Garanta a captura na borda** (pixel + CAPI, evento de compra correto, desduplicação):
   funil interno e Meta precisam concordar — a mecânica está em `meta-ads-docs`.
5. **Feche o loop com a memória de experimentos**: cada teste registra as taxas de funil
   do período, não só o CPA, para o aprendizado ser causal.

## Riscos e limites

- Trust 4: fundamentos de mensuração; a **mecânica oficial** de pixel/CAPI/atribuição
  manda e vive em `meta-ads-docs` — não afirme comportamento de plataforma a partir daqui.
- **Atribuição não é verdade absoluta**: janelas, modelos e a divergência entre o número
  da Meta e a venda real (origem real da venda) exigem cautela — trate discrepância como
  dado a investigar, não como erro a ignorar.
- **Volume mínimo**: taxas com poucos eventos são ruído; em aprendizado, o diagnóstico
  honesto é "ainda não há base para concluir".
- Medir tudo não substitui **agir**: o objetivo é a métrica que discrimina a próxima
  decisão, não um painel. Peça o dado que muda a recomendação, não todos os dados.
