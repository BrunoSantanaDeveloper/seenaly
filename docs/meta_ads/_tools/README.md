# Pipeline da base de conhecimento Meta Ads

## Como adicionar conteúdo novo

1. **Formato:** um arquivo **`.html`** por artigo/assunto, salvo em **`docs/meta_ads/`**
   (na raiz, ao lado dos demais). Codificação UTF-8.
2. **Nome do arquivo:** kebab-case, sem acentos e sem underscore
   (ex.: `publicos-personalizados.html`). Prefixe pelo tópico quando fizer sentido
   (`gerenciador-*`, `restricoes-*`, `advantage-*`). Não reutilize um nome existente,
   a menos que a intenção seja substituir o artigo.
3. **Estrutura interna** (o conversor entende HTML semântico simples):
   - um único `<h1>` com o título; seções em `<h2>`/`<h3>`
   - `<p>`, `<ul>`/`<ol>`, `<table>`, `<pre>` para blocos de código, `<code>`/`<strong>` inline
   - callouts: `<div class="note">` ou `class="warning"` viram blockquote
   - links para outros artigos da base: `<a href="outro-artigo.html">` (viram `.md`)
   - CSS/`<style>`, `class="nav-links"` e `class="footer"` são descartados — pode incluir
     para leitura humana sem custo
   - rodapé com a data de captura no padrão `Extraído: DD/MM/AAAA` → vira `captured` no frontmatter
4. **Imagens:** salve o arquivo em `docs/meta_ads/assets/` e referencie com
   `<img src="assets/nome.png" alt="descrição textual completa do que a imagem mostra">`.
   O `alt` é o que a IA lê — descreva o conteúdo (dados de tabela, fluxo do diagrama),
   não a aparência. Imagem decorativa: simplesmente não inclua.

## Processamento (após adicionar os HTML)

```
python _tools/convert.py       # gera md/ a partir dos HTML
python _tools/verify.py        # prova que nenhum texto foi perdido (deve terminar com 0)
# adicionar entrada do novo arquivo em _tools/metadata.json (description, tags, related)
# adicionar o stem ao grupo adequado em _tools/build_index.py
python _tools/build_index.py   # regenera md/INDEX.md
npm run knowledge:ingest -- --corpus=meta-ads-docs  # (raiz do repo) ingere md/ na knowledge base (trust 1)
```

Ou simplesmente peça à IA: "processe os novos arquivos de docs/meta_ads" — ela roda o
pipeline e escreve os metadados.

**Como os novos são detectados:** `_tools/metadata.json` é o registro do que já foi
processado — todo artigo enriquecido tem uma entrada lá. O `convert.py` converte todos
os HTML (é idempotente, re-converter não muda nada) e, ao final, lista os arquivos que
ainda **não** têm entrada no metadata.json sob o título `NOVOS`. São esses que precisam
de enriquecimento (description, tags, related) e inclusão em um grupo do `build_index.py`.

## Regras

- **Nunca edite `md/*.md` à mão** — são gerados; qualquer edição some na próxima regeneração.
  Enriquecimento (frontmatter) vive em `_tools/metadata.json`; legendas de imagens capturadas
  vivem em `assets/_images_map.json` (campo `desc`).
- Ruído de captura recorrente (toasts, avisos de UI) → adicionar em `KNOWN_NOISE` no `convert.py`.
- Idioma: corpo em pt-BR; `tags` do frontmatter em inglês; nomes de parâmetros/eventos da API
  ficam como no original (inglês).
