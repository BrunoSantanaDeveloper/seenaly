---
title: "Pilares de conteúdo: a proporção entre educar, provar, conectar e vender"
description: "Um perfil que só publica oferta direta se lê como anúncio e é suprimido pelo próprio filtro que o comprador desenvolveu contra propaganda. Framework de pilares (educar, provar, conectar, vender) como mix declarado e testável, mapeado para a taxonomia de narrativas do Organic Growth — nunca uma proporção universal."
tags: [organic, content-strategy, pillars, narrative, mix]
related: [conteudo-nativo-vs-anuncio, distribuicao-organica-sinais, criativo-gancho-angulo-prova, publico-segmentacao-angulo]
sources: ["Think with Google — framework Hero/Hub/Help de estratégia de conteúdo", "packages/organic-growth/src/taxonomy.ts — taxonomia de tipos narrativos do produto"]
trust: 4
captured: 2026-08-06
---

[← Voltar ao índice](INDEX.md)

# Pilares de conteúdo: a proporção entre educar, provar, conectar e vender

## Princípio

Um perfil que publica majoritariamente **oferta direta** ("compre agora", "últimas vagas",
"link na bio") treina a própria audiência a filtrá-lo como propaganda — e, pelo mecanismo
descrito em [distribuicao-organica-sinais](distribuicao-organica-sinais.md), é distribuído
para menos gente exatamente por causa disso. A alternativa não é "nunca vender" — é
declarar um **mix de pilares** onde a oferta direta é minoria, e o resto do conteúdo
constrói o que a venda sozinha não constrói: autoridade (por que confiar), prova (por que
funciona) e conexão (por que este negócio, não outro).

O produto já tem uma taxonomia para isso: os **tipos narrativos** do Organic Growth
(`packages/organic-growth/src/taxonomy.ts`) incluem `tutorial`, `bastidores`, `opiniao`,
`estudo_de_caso`, `depoimento`, `transformacao`, `erro_comum`, `mito`, `conteudo_de_fundador`
— quinze variações de conteúdo nativo — e apenas **uma** delas, `oferta_direta`, é
propaganda explícita. Essa proporção (1 em 15 tipos catalogados) não é um mandato de
frequência, mas é um lembrete estrutural: o repertório de conteúdo que funciona é
majoritariamente não-promocional, por desenho.

## Evidência

Trust 4 — framework de mercado publicamente documentado, mais a taxonomia interna do
próprio produto:

- **Hero/Hub/Help** (Think with Google): framework de estratégia de conteúdo que separa
  três funções — *Hero* (grandes momentos de marca, baixa frequência), *Hub* (conteúdo
  recorrente que mantém relacionamento — bastidores, opinião, tutorial), *Help* (conteúdo
  que resolve uma dúvida específica de quem já está pesquisando). A oferta direta não é
  nenhuma das três: ela converte quem o Hub e o Help já aqueceram, não substitui os dois.
- **A taxonomia interna do Organic Growth** já opera com essa lógica: `strategic_intent`
  inclui `gerar_autoridade`, `gerar_confianca`, `gerar_salvamento`, `gerar_compartilhamento`,
  `gerar_conversa` como objetivos tão válidos quanto `gerar_venda` — a classificação por IA
  do módulo já assume que a maior parte do conteúdo tem um objetivo que não é a venda
  imediata. Este card explica o **porquê** por trás dessa taxonomia já implementada.

Não há proporção numérica universal (ex.: "80/20") citável com rigor — qualquer número
fixo aqui seria conselho genérico. O que é defensável é a ORDEM: pilares que constroem
confiança e recorrência antes de pilares que pedem a venda.

## Quando se aplica

- A qualquer conta que publique organicamente com o objetivo de aquecer audiência para o
  tráfego pago (o recorte do Plano de Teste Criativo).
- É mais crítico quanto **mais nova** a conta ou a marca — sem histórico de confiança
  acumulado, um feed majoritariamente promocional não tem o que o justifique.
- Pesa menos para contas com autoridade e audiência já estabelecidas, onde uma fração
  maior de oferta direta é tolerada porque a confiança já existe fora do feed.
- Não se aplica ao criativo pago: dentro do anúncio, ser direto sobre a oferta é esperado
  e correto — o princípio deste card é sobre o **feed orgânico**, onde a audiência não
  pediu para ver uma oferta.

## Como diagnosticar

- **Liste as últimas 10–15 publicações por tipo narrativo** (usando a taxonomia do
  Organic Growth): se a maioria cai em `oferta_direta`, o perfil está gastando a
  distribuição orgânica em vez de construir a base que a sustentaria.
- **Cruze tipo narrativo com o sinal de distribuição** (retenção/salvamento/
  compartilhamento, ver [distribuicao-organica-sinais](distribuicao-organica-sinais.md)):
  se `oferta_direta` tem desempenho visivelmente pior que `bastidores` ou
  `estudo_de_caso` na mesma conta, é a confirmação direta do princípio deste card,
  específica para esse público.
- **Verifique se existe pelo menos um pilar de prova** (`estudo_de_caso`, `depoimento`,
  `transformacao`) e um de conexão (`bastidores`, `conteudo_de_fundador`, `opiniao`) —
  a ausência de qualquer um deles é uma lacuna de repertório, não só de frequência.
- Biblioteca de criativos sem nenhuma hipótese fora do ângulo comercial é o mesmo sintoma
  visto pela lente da etiquetagem (ver
  [criativo-gancho-angulo-prova](criativo-gancho-angulo-prova.md)).

## Ação recomendada

Em ordem de alavancagem:

1. **Declare o mix de pilares antes de produzir**, não depois: para cada hipótese do
   Plano de Teste Criativo, escolha deliberadamente um tipo narrativo não-`oferta_direta`
   quando o objetivo for alcance, e reserve `oferta_direta` para quando o objetivo
   declarado for conversão de quem já é público aquecido.
2. **Garanta pelo menos um pilar de prova social** por ciclo de publicação — depoimento,
   estudo de caso ou transformação — antes de qualquer sequência de peças comerciais.
3. **Use `bastidores`/`conteudo_de_fundador` como o pilar de menor custo de produção e
   maior ganho de conexão** — é frequentemente o tipo mais barato de gravar e o que mais
   humaniza uma marca nova.
4. **Trate a proporção como hipótese, não como regra fixa**: registre no Plano de Teste
   Criativo qual mix foi tentado e o que a leitura de distribuição mostrou, ajustando a
   proporção pela própria conta — nunca por um número de mercado importado.

## Riscos e limites

- Trust 4: o framework Hero/Hub/Help é uma lente de organização, não uma fórmula com
  proporções obrigatórias — usar como estrutura de raciocínio, nunca como checklist rígido.
- **Não vire regra de frequência absoluta.** "Publique 1 venda para cada 5 conteúdos" é o
  tipo de número genérico que este card evita — a proporção certa depende do estágio de
  confiança da audiência com a marca, que só a própria conta pode revelar.
- Um negócio que vende algo genuinamente urgente ou sazonal (ex.: vaga de turma fechando)
  tem uma janela legítima de maior proporção de `oferta_direta` — o princípio não proíbe
  isso, alerta contra ele ser o **padrão permanente**.
- A classificação por tipo narrativo é feita por IA no Organic Growth e pode errar —
  correção humana sempre prevalece (invariante do módulo).
