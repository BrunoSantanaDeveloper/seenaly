# Seenaly — Definição de produto

> **AI Growth Copilot / Plataforma de Inteligência de Aquisição para negócios que vendem com tráfego pago.**
> Internamente: **Decision Intelligence aplicada a Meta Ads, criativos e funis de venda.**

Comunicação com usuários: *"Seu copiloto de growth para transformar dados de tráfego pago em decisões, criativos e próximos testes."*

## A pergunta que o produto responde

Um Ads Manager responde "onde eu configuro, publico e gerencio campanhas?". O Seenaly responde:

> "Considerando este produto, esta oferta, este funil, estes criativos, estes dados de campanha e este histórico de testes, qual é o diagnóstico e o próximo experimento mais inteligente?"

O sistema **analisa, diagnostica e sugere** — não opera as campanhas pelo usuário. Ações semi-automatizadas só entram em pauta depois que a camada de decisão estiver madura. Não competimos com a automação da Meta (Advantage+): ajudamos o usuário a alimentá-la melhor com criativos, estrutura, dados e decisões.

### O que o Seenaly NÃO é

Ads Manager · automação de tráfego pago · dashboard de marketing · ferramenta de criativos com IA · ferramenta de atribuição · CRM/CDP. Ele toca essas áreas, mas a categoria é definida pelo problema central: **melhorar a qualidade da decisão**.

## Princípios de produto

1. **O coração não é a IA — é o modelo de contexto do produto.** Antes de analisar qualquer campanha, o sistema precisa saber: produto, preço, margem, CAC máximo aceitável, ticket médio, LTV, tipo de conversão desejada, etapa do funil, público-alvo, promessa principal, objeções, provas disponíveis, criativos já testados e seus resultados, página usada e sua taxa de conversão, evento de otimização, orçamento, tempo e estágio da campanha. Sem isso, qualquer resposta é genérica.
2. **Lei interna: nada genérico.** Toda recomendação deve estar vinculada a pelo menos um dado da campanha, uma informação do produto ou uma regra/documentação da plataforma. "Teste novos criativos com ângulos diferentes" é resposta proibida.
3. **Níveis de confiança do conhecimento.** Nível 1: documentação oficial da Meta. Nível 2: dados reais das campanhas. Nível 3: dados reais de vendas/funil. Nível 4: playbooks internos validados. Nível 5: cursos, opiniões e benchmarks externos. Decisões priorizam níveis 1–3; cursos são repertório, não verdade. (Mapeia 1:1 nos `trust_level` de `packages/knowledge`.)
4. **Saber quando não dá para concluir.** Volume insuficiente de eventos, fase de aprendizado, breakdowns incompatíveis da Insights API: o sistema declara a limitação em vez de inventar conclusão.
5. **Formato fixo de toda recomendação** (via saída estruturada, JSON Schema):
   - **Diagnóstico** — o que está acontecendo
   - **Evidências** — quais dados sustentam
   - **Base técnica** — regra/documentação aplicável
   - **Hipótese** — por que isso pode estar acontecendo
   - **Ação recomendada** — o que fazer agora
   - **Risco** — o que pode dar errado
   - **Confiança** — baixa / média / alta
   - **Critério de sucesso** — como saber se funcionou
   - **Próxima leitura** — quando reavaliar
6. **Espectro de maturidade — o valor nunca fica atrás da conexão Meta.** O sistema serve desde o iniciante sem nenhuma campanha (nem conta Meta) até a empresa com histórico rico, degradando graciosamente. É a forma extrema do princípio nº 4:
   - **Zero dados**: guia do passo 0 usando **contexto do produto + conhecimento oficial** — que evento otimizar, como estruturar a 1ª campanha, que criativo/oferta testar primeiro. Nenhum dado de campanha necessário.
   - **Campanha nova (conta conectada)**: "ainda não há base para concluir" — fase de aprendizado, volume mínimo.
   - **Histórico rico**: diagnóstico completo com evidências, rankings de relevância, fadiga, memória de experimentos.

   Consequência de arquitetura: o **contexto do produto (o coração) é o passo 0 e independe de dados**; a conexão Meta é enriquecimento opcional, não pré-requisito. O motor de diagnóstico recebe o que existir (contexto sempre; conhecimento sempre; dados Meta se houver) e nunca exige a conexão.

## Os cinco pilares + memória

1. **Base de conhecimento Meta Ads** (nível 1): documentação oficial, políticas, cursos Blueprint, glossário, regras de aprendizado, pixel/CAPI, Advantage+, diagnósticos de relevância, limitações da API. O corpus vive em `docs/meta_ads/` (pipeline próprio em `docs/meta_ads/_tools/`) e é ingerido na coleção global `meta-ads-docs` da knowledge base (`scripts/ingest-meta-ads.ts`).
2. **Camada de dados das campanhas**: sync via Marketing/Ads Insights API por campanha/conjunto/anúncio/criativo/período/posicionamento — gasto, impressões, alcance, frequência, CPM, CTR, CPC, conversões, CPA, valor, ROAS, eventos de pixel/CAPI. Respeitando restrições de compatibilidade entre métricas e breakdowns.
3. **Camada de funil e vendas reais** (o que a Meta não vê): visitas, taxa de conversão da página, checkout iniciado, compra, Pix/boleto pendente, reembolso, upsell, receita líquida, margem, origem real da venda.
4. **Biblioteca de criativos etiquetada**: cada criativo com ângulo, promessa, dor, desejo, objeção, formato, gancho, CTA, estilo visual, duração, primeira cena, tipo de prova, emoção, público presumido, etapa do funil e resultado. O objetivo é saber **por que** um criativo performou, não só qual performou.
5. **Motor de diagnóstico** (o módulo mais valioso): o problema está no criativo ou na oferta? Antes ou depois do clique? Há dados suficientes? Fadiga? CPA alto por CPC caro ou por baixa conversão? Fase de aprendizado? Evento de otimização adequado? Cruza diagnósticos de relevância da Meta com dados do funil.

**Diferencial máximo — memória de experimentos**: todo teste registrado como hipótese → mudança → motivo → período → orçamento → criativos → métricas → resultado → conclusão → próximo passo. Com o tempo a IA deixa de ser só "especialista em Meta Ads" e vira especialista **nos produtos, criativos, públicos e ofertas do cliente**.

## Recorte inicial

**Copiloto especialista em Meta Ads para produtos digitais e ofertas self-service.** Não competir de frente com Madgicx/Smartly/Motion. Foco: leitura da conta Meta Ads, cadastro profundo do produto/oferta, análise de criativos, diagnóstico de gargalo, recomendação com evidências, geração de experimentos, memória do que foi testado, base de conhecimento oficial, saída sempre contextual.

### Mercado (benchmarks, não concorrentes diretos)

| Área | Ferramentas próximas |
|---|---|
| Gestão/otimização de Meta Ads com IA | Madgicx, Good Morning |
| Enterprise creative + media | Smartly.io |
| Creative analytics | Motion, Segwise, Foreplay |
| Atribuição e dados de negócio | Triple Whale, Northbeam, Wicked Reports |
| Automação por regras | Birch/Revealbot |

O espaço é fragmentado; nenhuma entrega a combinação: conhecimento técnico da plataforma + dados reais da campanha + contexto do produto + histórico de experimentos + regras de decisão. A visão é a junção de *Madgicx + Motion + Triple Whale + base de conhecimento + memória de experimentos + contexto proprietário do produto*.

## Roadmap por fases

As fases **não** são um funil sequencial onde tudo espera a conexão Meta. O contexto do produto (2) e o motor de diagnóstico (3) entregam valor a um iniciante sem nenhum dado; a conexão Meta (1) enriquece quando existe (ver princípio nº 6). O conector foi construído cedo por causa do app review da Meta (semanas), não porque o resto depende dele.

| Fase | Entrega | Status |
|---|---|---|
| 0 | Base de conhecimento: corpus `docs/meta_ads/` + ingestão em `meta-ads-docs` (trust 1) | corpus e script prontos; ingestão pendente de env (Supabase + `GEMINI_API_KEY`) |
| 1 | Conector Meta Ads: schema `meta_*` (`0009`), cliente Graph API, sync incremental + cron, gate de assinatura. **Opcional para o usuário** (enriquecimento, não portão) | núcleo implementado (trilha A: system-user token); falta validar com token real, OAuth/app review (trilha B) e tela de conferência |
| 2 | **Modelo de contexto do produto** (o coração; independe de dados): schema de produto/oferta/economia/funil + UI de cadastro guiado. É o passo 0 do iniciante | em andamento |
| 3 | Motor de diagnóstico: assistente grounded que **degrada graciosamente** (contexto sempre; conhecimento sempre; dados Meta se houver) com `generateStructured` no formato fixo — primeiro produto vendável, já para quem tem zero campanhas | — |
| 4 | Biblioteca de criativos etiquetada + análise de padrões vencedores (reusa `meta_creatives`; iniciante pode cadastrar criativos planejados) | — |
| 5 | Memória de experimentos (iniciante registra o 1º teste planejado) | — |
| 6 | Camada de funil/vendas reais | — |

### Mapa produto → infraestrutura do template

- Base de conhecimento em níveis de confiança → `packages/knowledge` (pgvector + Gemini embeddings, trust levels 1–5)
- Integração Meta Ads → `packages/connectors` (+ tabelas novas em `packages/db`) com sync via `packages/jobs` (Inngest)
- Assistente e formato fixo → `packages/ai` (`generateStructured` com JSON Schema; grounding via `config.knowledge`)
- Monetização por uso → `packages/billing` (créditos por mensagem)
