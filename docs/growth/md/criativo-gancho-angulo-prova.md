---
title: "Anatomia do criativo de performance: gancho, ângulo e prova"
description: "Decomposição do criativo de resposta direta em gancho (3 primeiros segundos), ângulo (enquadramento de dor/desejo) e prova — como diagnosticar qual camada falhou usando hook rate, hold rate e CTR, e por que se testa uma camada por vez."
tags: [creative, hook, angle, proof, content, ugc, testing]
related: [congruencia-anuncio-pagina, oferta-value-equation]
sources: ["prática consolidada de direct response e creative strategy (taxonomia de creative testing)", "métricas derivadas do Gerenciador de Anúncios — ver corpus meta-ads-docs para as definições oficiais"]
trust: 4
captured: 2026-07-10
---

[← Voltar ao índice](INDEX.md)

# Anatomia do criativo de performance: gancho, ângulo e prova

## Princípio

Um criativo de performance não é uma peça única — é um empilhamento de três camadas com
funções distintas, e cada uma falha de um jeito mensuravelmente diferente:

1. **Gancho** (primeiros ~3 segundos / primeira dobra da imagem): interrompe a rolagem.
   Não vende nada; compra os próximos segundos de atenção.
2. **Ângulo**: o enquadramento da dor/desejo escolhido para esta peça — mesma oferta,
   ângulos diferentes ("economize tempo" vs "pare de perder venda") alcançam públicos
   psicológicos diferentes.
3. **Prova + CTA**: sustenta a promessa (demonstração, depoimento, resultado, autoridade)
   e direciona o clique.

"Trocar o criativo" sem saber **qual camada** falhou é jogar dado. O diagnóstico correto
identifica a camada e varia só ela.

## Evidência

Framework de praticante (trust 4), consolidado na prática de creative strategy/direct
response e operacionalizado por métricas padrão da plataforma (definições oficiais no
corpus `meta-ads-docs`):

- **Hook rate** — reproduções de 3 segundos ÷ impressões: mede o gancho, isolado do resto.
- **Hold rate** — ThruPlay (ou 15s) ÷ reproduções de 3s: mede se o ângulo sustenta a
  atenção comprada pelo gancho.
- **CTR** — mede o conjunto ângulo+prova+CTA: o desejo virou intenção?
- A conversão pós-clique **não** pertence ao criativo — pertence à página/oferta (ver
  [congruencia-anuncio-pagina](congruencia-anuncio-pagina.md) e
  [oferta-value-equation](oferta-value-equation.md)).

Não há benchmark universal para esses ratios — o baseline útil é **comparativo, dentro da
própria conta**, entre criativos do mesmo formato e posicionamento.

## Quando se aplica

- Sempre que houver dados de vídeo/criativo no nível do anúncio (formatos estáticos usam
  CTR e taxa de conversão por criativo, sem hook/hold).
- No passo 0 (sem dados), a decomposição vira **roteiro de produção**: brief de criativo
  nasce com gancho, ângulo e prova explícitos e etiquetados — alimentando a biblioteca de
  criativos (pilar 4) desde o primeiro teste.
- É a base da **etiquetagem** da biblioteca: ângulo, promessa, dor, desejo, objeção,
  formato, gancho, CTA, tipo de prova, emoção, etapa do funil (taxonomia em
  `docs/PRODUCT.md`). O objetivo é saber **por que** um criativo performou, não só qual.

## Como diagnosticar

Leitura em cascata, camada por camada:

- **Hook rate baixo** (vs. os pares da conta): o gancho não interrompe — o resto do vídeo
  nem foi visto; não conclua nada sobre ângulo/prova ainda.
- **Hook rate bom + hold rate baixo**: o gancho promete algo que o ângulo não desenvolve,
  ou o ritmo cai — problema de ângulo/roteiro.
- **Hold rate bom + CTR baixo**: a peça prende mas não converte atenção em clique —
  prova fraca ou CTA sem motivo para agir agora.
- **CTR bom + conversão pós-clique ruim**: o criativo cumpriu o papel; o gargalo está na
  página ou na oferta — sai deste card.
- **Métricas boas decaindo com frequência subindo**: fadiga de criativo, não defeito —
  o diagnóstico é rotação/variação, não descarte do ângulo (regras de fadiga e
  diagnósticos de relevância: corpus `meta-ads-docs`).

## Ação recomendada

1. **Varie uma camada por vez**, começando pela mais barata: novos ganchos sobre o mesmo
   corpo de vídeo antes de produzir peças novas.
2. **Teste ângulos como hipóteses, não estéticas**: cada ângulo etiquetado ataca uma dor
   ou objeção específica do `product_context`; criativo vencedor confirma a hipótese
   psicológica, não só a peça.
3. **Case a prova com a objeção dominante** registrada no contexto do produto (medo de
   não conseguir → depoimento de iniciante; ceticismo → demonstração ao vivo).
4. **Etiquete tudo e registre o teste na memória de experimentos**: hipótese → camada
   variada → período → métricas (hook/hold/CTR) → conclusão → próximo passo.
5. Ao escalar um vencedor, produza **variações do mesmo ângulo** (outros ganchos, outros
   formatos) antes de apostar em ângulos novos.

## Riscos e limites

- Trust 4: heurística de praticante; os thresholds são relativos à conta e ao formato —
  nunca citar números absolutos de hook/hold rate como regra.
- Hook e hold rate dependem de posicionamento e formato (Reels vs Feed vs Stories);
  compare apenas dentro do mesmo recorte, e lembre que breakdowns têm restrições de
  compatibilidade (ver corpus `meta-ads-docs`).
- Gancho que superpromete infla o hook rate e **destrói** a conversão pós-clique (quebra
  de message match) — além de risco de política de anúncios da Meta (práticas enganosas).
- Volume mínimo: com poucas impressões por criativo os ratios são ruído; em fase de
  aprendizado, o diagnóstico honesto é "ainda não há base para concluir".
