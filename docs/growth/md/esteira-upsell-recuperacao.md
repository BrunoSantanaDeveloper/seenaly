---
title: "Esteira de oferta: order bump, upsell, downsell e recuperação"
description: "O ticket médio (não o CPA) é o que desbloqueia escala: order bump e upsell 1-click puxam o AOV; downsell recupera 5–15% das recusas; e a recuperação mais rentável é a do upsell (via webinário automático para quem já comprou o front) — enquanto recuperação de carrinho abandonado converte pouco. Como diagnosticar um funil sem esteira."
tags: [order-bump, upsell, downsell, recovery, aov, ltv, funnel-economics]
related: [funil-perpetuo-ticket-frio, tipos-funil-escolha, checkout-br-pagamentos, mensuracao-funil-metricas]
sources: ["Thiago Ruas — live sobre esteira e recuperação em funis perpétuos BR", "prática consolidada de resposta direta sobre maximização de ticket médio"]
trust: 5
captured: 2026-07-10
---

[← Voltar ao índice](INDEX.md)

# Esteira de oferta: order bump, upsell, downsell e recuperação

## Princípio

Num funil a frio, o CPA tem piso (o leilão não perdoa) — então quem decide se a conta
fecha não é o custo da venda, é **quanto cada comprador vale**: o ticket médio (AOV) e o
que vem depois da primeira compra. Um funil sem esteira (order bump, upsell, downsell,
recuperação) compete contra funis que monetizam o mesmo clique 2–3× melhor, e perde o
leilão **mesmo com criativo e página melhores**. "Não escala" muitas vezes significa
"não tem esteira".

## Evidência

Trust 5 — heurísticas de praticante nomeado (Thiago Ruas) + prática consolidada de
resposta direta; percentuais são da experiência relatada, não pesquisa:

- **Order bump** (oferta complementar no próprio checkout, um checkbox): adição de AOV
  com atrito quase nulo — padrão consolidado do mercado.
- **Upsell 1-click pós-compra**: com pagamento em cartão, a segunda oferta não exige
  redigitar dados — é o mecanismo que mais puxa o AOV. Dependência direta do **mix de
  pagamento**: PIX quebra o 1-click, por isso low ticket dominado por PIX trava a esteira
  (ver [checkout-br-pagamentos](checkout-br-pagamentos.md) e
  [funil-perpetuo-ticket-frio](funil-perpetuo-ticket-frio.md)).
- **Downsell pós-recusa** (versão reduzida/parcelada da oferta recusada): recupera na
  faixa de **5–15%** das recusas na experiência relatada.
- **Recuperação de upsell > recuperação de carrinho**: na experiência relatada,
  recuperação de carrinho abandonado converte **pouco** ("dá um dinheirinho"), enquanto
  recuperar **quem comprou o front e recusou o upsell** — convidando para um webinário
  automático "exclusivo para alunos" que revende o upsell — tem resultado muito maior. A
  lógica: comprador provado > curioso que abandonou. Nuance à parte: **PIX/boleto
  pendente não é carrinho abandonado** — pendência tem recuperação boa e obrigatória
  (ver checkout BR).
- **Webinário automático diário** (vs. semanal) quase dobra o comparecimento na
  experiência de operadores do formato — menos tempo entre inscrição e aula, menos
  esquecimento.

## Quando se aplica

- Qualquer funil self-service com checkout próprio — especialmente low ticket, onde a
  esteira não é opcional: é o modelo de negócio.
- No passo 0, define o desenho: a primeira campanha já nasce com order bump e upsell
  planejados, não "depois que escalar".
- Diagnóstico fino pede as métricas da esteira: taxa de order bump, take rate do upsell,
  recuperação do downsell, AOV vs. preço do front (ver
  [mensuracao-funil-metricas](mensuracao-funil-metricas.md)).

## Como diagnosticar

- **CPA "alto" comparado ao preço do front, mas nunca comparado ao AOV**: diagnóstico
  incompleto — a pergunta certa é CPA vs. ticket médio real.
- **Front converte bem e a conta não fecha**: funil sem esteira ou esteira com take rate
  baixo — o gargalo é arquitetura, não mídia.
- **AOV ≈ preço do front**: esteira inexistente ou irrelevante; cada real de escala
  depende só do CPA — teto estrutural.
- **Esteira boa + PIX dominante**: o 1-click não roda; o problema é o mix de pagamento,
  não as ofertas.
- **Upsell com take rate baixo**: oferta do upsell desconectada do front (não é a
  continuação natural da mesma dor) — problema de desenho de oferta, ver
  [oferta-value-equation](oferta-value-equation.md).

## Ação recomendada

1. **Meça AOV e LTV antes de mexer em mídia** — se o AOV é o front puro, a prioridade é
   esteira, não criativo.
2. **Order bump complementar barato** (recibo da mesma dor: template, checklist, acesso)
   no checkout — primeira adição, menor esforço.
3. **Upsell 1-click como continuação da promessa** (o próximo resultado óbvio de quem
   acabou de comprar), apresentado imediatamente pós-pagamento em cartão.
4. **Downsell na recusa** — versão menor/parcelada, uma única vez, sem leilão de desconto.
5. **Recupere na ordem do retorno**: pendências de PIX/boleto primeiro; depois recusas de
   upsell (convite para aula/webinário de alunos); carrinho abandonado por último e com
   expectativa realista.
6. Cada peça entra como experimento com take rate esperado e impacto no AOV registrados
   na memória de experimentos.

## Riscos e limites

- Trust 5: percentuais (5–15% downsell, "dobra comparecimento") são da experiência de
  praticantes — referências a validar no funil do cliente, nunca benchmark garantido.
- **Esteira agressiva corrói confiança**: upsell em cascata infinita e downsell que
  desmoraliza o preço cheio geram reembolso e dano de marca — o risco entra na
  recomendação (e reembolso alto é diagnóstico próprio, ver mensuração).
- Upsell/downsell pressupõem **checkout próprio com 1-click**; em plataformas de
  infoproduto as regras são das plataformas (cards trust 1 futuros).
- A esteira **não conserta front fraco**: sem conversão no front não há quem subir de
  ticket — valide o front primeiro.
