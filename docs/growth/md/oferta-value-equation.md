---
title: "Equação de valor: diagnóstico de oferta fraca"
description: "Framework da equação de valor (Hormozi) para diagnosticar oferta fraca: resultado sonhado × probabilidade percebida ÷ tempo × esforço. Quando o gargalo é a oferta (e não o criativo ou a página) e as quatro alavancas para reforçá-la."
tags: [offer, pricing, value-proposition, funnel]
related: [checkout-abandono-causas, congruencia-anuncio-pagina]
sources: ["Alex Hormozi — $100M Offers (framework de praticante)", "princípios de economia comportamental — ancoragem e aversão ao risco"]
trust: 4
captured: 2026-07-10
---

[← Voltar ao índice](INDEX.md)

# Equação de valor: diagnóstico de oferta fraca

## Princípio

Quando anúncio e página estão tecnicamente saudáveis mas a venda não acontece, o gargalo
costuma ser a **oferta** — a relação entre o que se promete e o que se pede em troca. O
framework mais operacional para decompor isso é a equação de valor popularizada por Alex
Hormozi ($100M Offers):

> **Valor percebido = (Resultado sonhado × Probabilidade percebida de alcançá-lo) ÷ (Tempo até o resultado × Esforço e sacrifício exigidos)**

Preço não aparece na equação: preço é o que se compara **contra** o valor percebido. Uma
oferta fraca não se conserta com desconto — se conserta aumentando o numerador ou
reduzindo o denominador.

## Evidência

Framework de praticante (trust 4): não é pesquisa controlada, mas é consistente com
princípios documentados de economia comportamental — o comprador avalia a oferta contra
uma **âncora** de referência (ancoragem), pesa mais o risco de perda do que o ganho
equivalente (aversão à perda, o que explica a força de garantias), e desconta fortemente
resultados distantes no tempo (desconto hiperbólico, o que explica a força de "resultado
em X dias"). Cite como "framework da equação de valor (Hormozi)" — nunca como regra da
plataforma nem como estatística.

## Quando se aplica

- Produtos digitais e ofertas self-service (recorte inicial da Seenaly), especialmente
  quando o `product_context` já registra promessa, preço, garantia e formato da entrega.
- **Aplica-se com zero dados de campanha**: no passo 0, a equação estrutura o cadastro da
  oferta e antecipa objeções antes do primeiro real gasto em tráfego.

## Como diagnosticar

Sinais de que o gargalo é a oferta, e não o criativo/página/checkout:

- **CTR bom + página coerente com o anúncio + conversão baixa em toda a página** (não
  concentrada no checkout): o visitante entende a proposta e mesmo assim não quer.
- Custo por checkout iniciado razoável, mas taxa de conclusão baixa **sem** fricção
  técnica evidente no checkout — o preço na tela é onde a oferta é de fato julgada.
- Vários criativos com ângulos diferentes convergindo para a mesma conversão fraca — se
  trocar o criativo não move a agulha, o problema está depois da promessa.

Diagnóstico pelas quatro alavancas, perguntando contra o `product_context`:

1. **Resultado sonhado**: a promessa é específica e desejada, ou genérica ("melhore sua vida")?
2. **Probabilidade percebida**: há prova (depoimentos, casos, demonstração, autoridade)?
3. **Tempo**: o comprador sabe em quanto tempo vê o primeiro resultado?
4. **Esforço**: a entrega parece trabalhosa ("curso de 40 horas") em vez de facilitada?

## Ação recomendada

Em ordem de alavancagem típica para infoprodutos:

1. **Reduza o risco percebido** — garantia incondicional clara e visível perto do preço;
   é a alavanca mais barata de testar.
2. **Especifique a promessa** — resultado + prazo + para quem ("X em Y dias para Z"),
   na headline da página e no criativo.
3. **Empilhe e nomeie os componentes da oferta** (offer stack) — bônus que atacam as
   objeções específicas registradas no contexto do produto, cada um com valor nomeado,
   ancorando o preço total contra a soma.
4. **Reduza tempo e esforço percebidos** — reposicione a entrega em torno do primeiro
   resultado rápido (quick win), não do volume de conteúdo.
5. Só depois disso considere mexer no preço — e prefira **reancorar** (comparação, parcelamento)
   a descontar (ver [pricing-ancoragem-decisao](pricing-ancoragem-decisao.md)).

Quando o diagnóstico pede **reconstrução** (não ajuste), o processo do próprio Hormozi em
cinco passos: (1) defina o resultado sonhado como promessa específica; (2) liste **todos**
os problemas/crenças que impedem o comprador de alcançá-lo; (3) converta cada problema em
uma solução; (4) faça brainstorm de entregáveis por solução sem filtrar por viabilidade;
(5) enxugue pela matriz **custo de entrega × valor percebido** — mantenha o barato-de-entregar
e alto-em-valor-percebido, corte o resto. O stack final nasce das soluções que sobraram.

## Riscos e limites

- Trust 4: framework de praticante, não estatística — o motor deve apresentá-lo como
  hipótese estruturada com critério de sucesso mensurável, nunca como certeza.
- Escassez/urgência só quando **verdadeiras**; urgência fabricada destrói a confiança e
  contamina a marca do anunciante (e pode violar políticas de anúncio da Meta — ver corpus
  `meta-ads-docs`).
- Empilhar bônus irrelevantes infla a página e **piora** a clareza da promessa; cada item
  do stack precisa atacar uma objeção real.
- Margem e CAC-alvo do `product_context` limitam as alavancas: garantia agressiva com
  margem apertada e reembolso alto pode ser insustentável — o risco deve constar na
  recomendação.
