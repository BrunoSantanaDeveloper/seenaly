---
title: "Preço, ancoragem e enquadramento da decisão"
description: "Preço é julgado de forma relativa, não absoluta: ancoragem, efeito chamariz (decoy), enquadramento (por dia/por parcela) e o preço como sinal de qualidade. A alavanca raramente é 'baixar o preço' — é reancorar a comparação. Como diagnosticar resistência a preço e o que testar antes de descontar."
tags: [pricing, anchoring, decoy, price-framing, offer, behavioral-economics]
related: [oferta-value-equation, checkout-br-pagamentos, prova-social-sinais-confianca]
sources: ["Tversky & Kahneman — ancoragem e heurísticas de julgamento", "Dan Ariely — efeito chamariz / dominância assimétrica (Predictably Irrational)", "prática consolidada de pricing de resposta direta"]
trust: 4
captured: 2026-07-10
---

[← Voltar ao índice](INDEX.md)

# Preço, ancoragem e enquadramento da decisão

## Princípio

O comprador não avalia o preço em termos absolutos — avalia **contra uma referência**. Não
existe "caro" ou "barato" no vácuo: existe caro *em relação a uma âncora*. Por isso a
alavanca de conversão raramente é **baixar o preço** (que corrói margem e sinaliza baixa
qualidade); é **reancorar a comparação** para que o mesmo número pareça um bom negócio. O
preço também é um **sinal**: preço baixo demais para a promessa gera desconfiança, não
atração.

## Evidência

- **Ancoragem** (Tversky & Kahneman): a primeira referência apresentada contamina o
  julgamento seguinte — mostrar o valor "cheio" ou a soma dos componentes antes do preço
  final faz o preço final parecer menor. Efeito experimentalmente robusto.
- **Efeito chamariz / dominância assimétrica** (Ariely): introduzir uma terceira opção
  propositalmente inferior desloca a escolha para a opção-alvo. É por isso que planos
  costumam vir em três — o do meio vira o "óbvio". Experimentalmente documentado.
- **Enquadramento temporal**: "R$ 1,30 por dia" ou "12× de R$ X" reduz a dor de pagamento
  percebida frente a "R$ 470 à vista", mesmo com total idêntico (liga-se ao parcelamento —
  ver [checkout-br-pagamentos](checkout-br-pagamentos.md)).
- **Charm pricing** (terminar em 9/7): evidência **fraca e contestada** — trate como
  hipótese menor, nunca como regra. É o item de menor confiança deste card.

Trust 4 (síntese): o núcleo (ancoragem, chamariz) tem respaldo experimental forte; o
enquadramento é bem estabelecido; charm pricing é folclore. O motor deve distinguir isso.

## Quando se aplica

- Quando o gargalo é **resistência a preço** especificamente — o comprador entende a
  oferta, deseja o resultado, e trava no valor. É a camada seguinte à
  [equação de valor](oferta-value-equation.md): esta trata da *promessa*; aqui, do
  *enquadramento do número*.
- Aplica-se com zero dados de campanha (estrutura a apresentação do preço no passo 0) e
  ganha precisão com o funil (onde exatamente a decisão trava).

## Como diagnosticar

- **Chega à oferta, engaja, e trava no preço** (não no checkout técnico): candidato a
  problema de ancoragem/enquadramento, não de oferta nem de fricção.
- **Preço apresentado "nu"**, sem âncora nem comparação: o número aparece sem referência
  que o justifique — suspeita direta.
- **Opção única de compra**: sem chamariz nem contraste, o preço é julgado contra o nada
  (ou contra o concorrente, o que é pior).
- **Ticket alto sem enquadramento temporal/parcelamento**: o total cheio afasta antes da
  parcela aparecer.
- **Preço muito abaixo da promessa**: conversão baixa por **desconfiança** ("bom demais"),
  não por caro — o sinal de qualidade está errado.

## Ação recomendada

Em ordem de alavancagem, **antes** de considerar desconto:

1. **Ancore o preço** — mostre a soma dos componentes / o valor de referência / o "de-por"
   honesto antes do número final.
2. **Ofereça 2–3 opções** com um alvo claro (o chamariz torna a opção desejada a escolha
   óbvia), em vez de um preço único.
3. **Enquadre no tempo** — parcela e/ou custo por dia ao lado do total, sem esconder o total.
4. **Alinhe preço e promessa** — se está barato demais para o que promete, o problema pode
   ser *subir* o preço e reforçar a prova, não descer.
5. **Só então teste desconto** — e prefira reancorar (bônus, condição, prazo) a cortar o
   número, protegendo a margem do `product_context`.
6. Formule como experimento (uma mudança de enquadramento por vez, critério de sucesso na
   conclusão de checkout) e registre na memória.

## Riscos e limites

- Trust 4: distinga no diagnóstico o que é robusto (ancoragem, chamariz) do que é fraco
  (charm pricing) — nunca recomende terminar em 9 como se fosse lei.
- **Margem e CAC-alvo mandam**: enquadramento e chamariz não podem quebrar a economia
  unitária; o risco de margem entra na recomendação.
- **Manipulação erode confiança**: âncora falsa ("de R$ 2000 por R$ 47" sem que os R$ 2000
  jamais tenham existido) é prática enganosa — risco de política de anúncios (corpus
  `meta-ads-docs`) e de consumidor. Ancoragem honesta apenas.
- Sem dados de onde a decisão trava, o diagnóstico é hipótese — separe "resistência a
  preço" de "oferta fraca" de "fricção de checkout" e peça o dado que discrimina.
