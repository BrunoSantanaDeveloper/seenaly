# Captura pendente — artigos citados mas nunca capturados

**Problema identificado (2026-07-31):** a captura do corpus pegou as páginas
**panorâmicas** ("Sobre X"), e a Central de Ajuda da Meta coloca o **passo a passo de
interface** em artigos separados, linkados a partir delas. Resultado: o corpus sabe que os
artigos existem — contém as URLs — mas não contém o conteúdo deles.

Sintoma no produto: o `Como fazer` do Diagnóstico de Prontidão responde "os trechos
explicam a lógica, mas não fornecem o passo a passo técnico de como configurar isso no
Gerenciador de Anúncios". Está correto: a lógica veio do `growth-playbook`, e o passo a
passo simplesmente não está na base.

**Exemplo canônico** — `md/como-alcancar-novos-publicos.md` (linha 55) diz textualmente
que Públicos Personalizados podem ser criados "a partir de uma lista de clientes, dados do
Pixel, eventos do SDK ou engajamento" — com **link para cada um**. Nenhum dos quatro foi
capturado.

Ao todo há **~66 URLs distintas** da Central de Ajuda citadas e não capturadas.

## Como capturar

`WebFetch`/`curl` **não funcionam** nessas páginas (renderizadas por JS e/ou atrás de
login) — verificado. O caminho é salvar o HTML manualmente e rodar o pipeline normal
descrito em `README.md` (`convert.py` → `verify.py` → `metadata.json` → `build_index.py`
→ `npm run knowledge:ingest -- --corpus=meta-ads-docs`).

## Prioridade 1 — Públicos Personalizados (destrava o remarketing por estado do trial)

Estes quatro são o gargalo direto das pendências de remarketing. Complementam
`docs/growth/md/remarketing-estado-ciclo-vida.md`, que traz a *estratégia* e delega a
*mecânica* para cá.

| Artigo | URL | Nome sugerido |
|---|---|---|
| Público Personalizado a partir de **lista de clientes** | https://www.facebook.com/help/341425252616329 | `publicos-personalizados-lista-clientes.html` |
| Público Personalizado a partir de **dados do Pixel** | https://www.facebook.com/help/742478679120153 | `publicos-personalizados-pixel.html` |
| Público Personalizado por **engajamento** nas tecnologias Meta | https://www.facebook.com/help/1090330204367211 | `publicos-personalizados-engajamento.html` |
| **Públicos Semelhantes** (Lookalike) | https://www.facebook.com/help/164749007013531 | `publicos-semelhantes.html` |
| Usar um **público salvo** | https://www.facebook.com/help/570332443495822 | `publicos-salvos.html` |
| Público Personalizado por eventos do **SDK** (só se houver app) | https://www.facebook.com/help/1471413626484885 | `publicos-personalizados-sdk.html` |

## Prioridade 2 — direcionamento e posicionamento (referência de mecânica)

| Artigo | URL |
|---|---|
| Sobre o direcionamento de anúncios | https://www.facebook.com/business/help/717368264947302 |
| Sobre Posicionamentos de Anúncio | https://www.facebook.com/business/help/980593475366490 |
| Posicionamentos Advantage+ | https://www.facebook.com/business/help/196554084569964 |
| Localizações gerais / alcance por cidade e região | https://www.facebook.com/business/help/365561350785642 · https://www.facebook.com/business/help/726389026372510 |
| Tamanho estimado do público | https://www.facebook.com/business/help/1665333080167380 |

## Prioridade 3 — criação de anúncio e relatórios (passo a passo de interface)

| Artigo | URL |
|---|---|
| Como criar um anúncio em carrossel no Gerenciador | https://www.facebook.com/business/help/1375829326076396 |
| Sobre anúncios em carrossel · métricas de carrossel | https://www.facebook.com/business/help/773889936018967 · https://www.facebook.com/business/help/1609310829322538 |
| Criar anúncio em vídeo a partir de imagens | https://www.facebook.com/business/help/1562296953875361 |
| Sobre os Relatórios de Anúncios | https://www.facebook.com/business/help/487269218011981 |
| Configurar Orçamento de Campanha · Sobre o Orçamento Advantage+ | https://www.facebook.com/business/help/343242619559352 · https://www.facebook.com/business/help/519856662172206 |
| Testes de Conversion Lift | https://www.facebook.com/business/help/221353413010930 |

## Prioridade 4 — políticas e categorias especiais

| Artigo | URL |
|---|---|
| Anúncios de crédito, emprego e moradia (categorias especiais) | https://www.facebook.com/business/help/399587795372584 |
| Publicidade para adolescentes | https://www.facebook.com/business/help/229435355723442 |
| Contas Meta / Central de Contas | https://www.facebook.com/business/help/283579896000936 |

## Baixa prioridade — glossário de métricas

Há ~35 URLs de definições de métricas "únicas" (cliques únicos, compras únicas,
visualizações de conteúdo únicas...). São verbetes curtos de glossário; capturar só se o
motor começar a errar na interpretação de métricas. Não bloqueiam nenhuma recomendação.

## O que a captura NÃO resolve

O `Como fazer` também pede o passo a passo de **plataformas de e-mail marketing** (para a
régua do trial). Isso não é documentação da Meta e nunca estará neste corpus — dependeria
de um corpus por ferramenta (Resend, Mailchimp, ActiveCampaign...), que multiplica a
manutenção e envelhece rápido. Alternativa preferível: manter a régua no nível de
*conteúdo e gatilhos* (o que `docs/growth/md/email-ciclo-de-vida-trial.md` já entrega) e
tratar a configuração da ferramenta como o passo que o usuário delega ou resolve na
documentação do próprio fornecedor.
