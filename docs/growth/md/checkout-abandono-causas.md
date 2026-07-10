---
title: "Abandono de checkout: taxa média e causas documentadas"
description: "Síntese da pesquisa do Baymard Institute sobre abandono de carrinho/checkout: taxa média em torno de 70%, ranking das causas (custos extras, conta obrigatória, fluxo longo, desconfiança) e como usar esses números como baseline de diagnóstico."
tags: [checkout, cart-abandonment, cro, benchmark]
related: [congruencia-anuncio-pagina, oferta-value-equation]
sources: ["Baymard Institute — Cart Abandonment Rate Statistics", "Baymard Institute — Checkout Usability research"]
trust: 2
captured: 2026-07-10
---

[← Voltar ao índice](INDEX.md)

# Abandono de checkout: taxa média e causas documentadas

## Princípio

A maior parte das pessoas que inicia um checkout não compra — e isso é o **normal
estatístico**, não um defeito do produto. A meta-análise do Baymard Institute, que agrega
dezenas de estudos publicados de e-commerce, situa a taxa média documentada de abandono de
carrinho **em torno de 70%**. O diagnóstico útil não é "há abandono?", e sim: o abandono
está acima do esperado para o contexto, e **qual causa evitável** domina.

## Evidência

Todos os números abaixo são da pesquisa do Baymard Institute (valores aproximados; a
pesquisa é reeditada periodicamente e os percentuais oscilam alguns pontos entre edições).
Entre compradores que abandonaram **por um motivo específico** (excluindo "só estava
pesquisando"), as causas mais citadas:

- **Custos extras altos demais** (frete, taxas, encargos revelados tarde) — na casa de 45–50%, consistentemente a causa nº 1.
- **O site exigiu criar uma conta** — ~25%.
- **Entrega lenta demais** — ~20–25%.
- **Não confiou no site com os dados do cartão** — ~20–25%.
- **Checkout longo ou complicado demais** — ~15–20%.
- **Não conseguia ver/calcular o custo total do pedido antecipadamente** — ~15–20%.
- Erros/travamentos do site, política de devolução insatisfatória, poucas formas de pagamento e cartão recusado completam a lista, cada um abaixo de ~15%.

A mesma linha de pesquisa mostra que o checkout médio dos grandes e-commerces tem cerca de
**5 etapas e ~12 campos de formulário**, quando um fluxo bem desenhado resolve o mesmo
pedido com aproximadamente metade dos campos — e estima que um site médio de grande porte
pode obter **ganho de dois dígitos na conversão** só com redesign de checkout, sem tocar em
preço ou tráfego.

## Quando se aplica

- Produto vendido em checkout self-service (página de vendas → checkout → compra) — o
  recorte inicial da Seenaly.
- Requer no mínimo dados de funil (visitas à página, checkout iniciado, compras). Sem
  esses dados, o card serve como **baseline educativo** para o iniciante: ao projetar o
  funil, assuma que ~7 em cada 10 checkouts iniciados não viram venda e planeje
  recuperação desde o dia 0.

## Como diagnosticar

Use a decomposição `CPA = CPC ÷ taxa de conversão pós-clique` (ver `docs/PRODUCT.md`):

- **CTR e CPC saudáveis + conversão página→checkout ok + queda forte checkout→compra**:
  o gargalo é o checkout, não o anúncio nem a página. Este card se aplica.
- Taxa de conclusão de checkout (compras ÷ checkouts iniciados) muito abaixo de ~30%
  merece investigação das causas evitáveis acima, na ordem do ranking.
- Sinais específicos: pico de abandono na etapa de identificação → suspeite de conta
  obrigatória/excesso de campos; abandono na etapa de pagamento → suspeite de custo
  revelado tarde, desconfiança ou falta do meio de pagamento esperado.

## Ação recomendada

Em ordem de alavancagem, espelhando o ranking de causas:

1. **Exponha o custo total o mais cedo possível** — frete/taxas antes do checkout, nunca
   como surpresa na última etapa.
2. **Elimine a conta obrigatória** — compra como convidado ou conta criada implicitamente
   após a compra.
3. **Corte campos** — cada campo que não é estritamente necessário para entregar o produto
   é candidato a remoção; para produto digital, e-mail + pagamento costumam bastar.
4. **Sinalize confiança na etapa do cartão** — selos, emissor do checkout, política de
   reembolso visível.
5. **Ofereça os meios de pagamento que o público espera** — no Brasil, ausência de PIX e
   parcelamento é causa direta de abandono (ver limites abaixo).

## Riscos e limites

- Os números são de **e-commerce dos EUA/Europa**; para infoprodutos brasileiros os
  percentuais exatos não se transferem — use-os como **ordem de grandeza e ranking de
  causas**, não como benchmark rígido. Cite sempre como "pesquisa do Baymard Institute".
- Particularidades BR (PIX, boleto pendente, parcelamento no cartão) não são cobertas
  pela pesquisa original e pertencem a cards próprios. O recorte inicial assume **checkout
  próprio** (página e desenvolvimento proprietário); cards de trust 1 sobre plataformas
  (Hotmart/Kiwify/Eduzz, documentação oficial) entram quando esse público entrar no escopo.
- "Só estava pesquisando" é a maior fatia bruta do abandono e **não é recuperável por
  UX** — não prometa que otimização de checkout elimina o abandono; ela ataca a fração
  evitável.
