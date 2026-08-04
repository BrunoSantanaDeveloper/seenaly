-- ============================================================
-- 0043_knowledge_hybrid_search: busca densa + lexical, fundidas por RRF.
--
-- Marker for scripts/apply-migrations.mjs = create function public.knowledge_search_hybrid
--
-- O DEFEITO, medido e não suposto. O gate de recuperação
-- (`npm run eval:retrieval`) mostra a busca puramente vetorial parando em
-- 12/14 documentos-alvo, e os dois que faltam têm a MESMA forma:
--
--   "Sobre a API de Conversões"      (dimensão mensuracao_instalacao)
--   "Sobre a fase de aprendizado"    (dimensão mensuracao_otimizacao)
--
-- São nomes próprios. O embedding trata "API de Conversões" como a média de
-- 'API' + 'de' + 'Conversões' e não distingue o documento QUE É sobre o
-- assunto de outros 90 que o mencionam de passagem — medido no corpus:
-- 'API de Conversões' aparece em 94 chunks, 'Advantage+' em 128, enquanto
-- 'orçamento mínimo' aparece em UM. Termo raro e exato é exatamente onde a
-- busca densa é fraca e a lexical é trivialmente forte, e vice-versa: por isso
-- fusão, nunca substituição.
--
-- Isso importa mais neste produto do que em um buscador comum. A regra de ouro
-- exige que toda recomendação CITE a regra de plataforma; quando o documento
-- que carrega a regra não é recuperado, o motor parafraseia de memória — que é
-- a resposta genérica que o produto existe para não dar.
--
-- DUAS CONFIGURAÇÕES DE BUSCA, unidas de propósito:
--   'portuguese' faz stemming pt-BR e remove stopwords — casa "conversão" com
--                "conversões", e joga fora "de"/"a"/"para".
--   'simple'     não faz stemming nenhum — preserva as formas exatas que o
--                stemmer destrói: 'InitiateCheckout', 'CAPI', 'Advantage'.
-- Sozinha, cada uma erra metade do corpus (que é técnico E em português).
--
-- NENHUMA RE-INGESTÃO: as colunas são GENERATED sobre o texto já persistido.
-- ============================================================

-- ---------- sinal lexical no chunk ----------

alter table public.knowledge_chunks
  add column if not exists content_tsv tsvector
  generated always as (
    to_tsvector('pg_catalog.portuguese'::regconfig, content) ||
    to_tsvector('pg_catalog.simple'::regconfig, content)
  ) stored;

create index if not exists knowledge_chunks_tsv_idx
  on public.knowledge_chunks using gin (content_tsv);

-- ---------- sinal lexical no documento ----------
--
-- Peso 'A' no título: uma consulta por "API de Conversões" deve privilegiar o
-- documento CHAMADO "Sobre a API de Conversões" sobre um chunk qualquer que
-- cita a sigla de passagem. É o mesmo metadado que o embedding passou a ver
-- (título + caminho de headings); aqui ele fica alcançável por termo exato.

alter table public.knowledge_documents
  add column if not exists doc_tsv tsvector
  generated always as (
    setweight(to_tsvector('pg_catalog.portuguese'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('pg_catalog.portuguese'::regconfig, coalesce(metadata ->> 'description', '')), 'B')
  ) stored;

create index if not exists knowledge_documents_tsv_idx
  on public.knowledge_documents using gin (doc_tsv);

-- ---------- busca híbrida ----------
--
-- Security invoker, como `knowledge_search`: a RLS decide o que o chamador vê.
--
-- POR QUE RRF E NÃO SOMA DE SCORES: similaridade de cosseno e ts_rank_cd vivem
-- em escalas diferentes e incomparáveis, e a escala do ts_rank depende da
-- frequência do termo no corpus. Somar exige normalizar duas distribuições que
-- mudam a cada consulta. RRF ignora os valores e usa só a POSIÇÃO em cada
-- lista, que é o que torna a fusão estável sem calibração.
--
-- O BÔNUS DE TRUST FOI REESCALADO. Em `knowledge_search` ele é +0,03 por nível
-- sobre similaridade de cosseno (0..1). No espaço RRF a distância entre duas
-- posições vizinhas é ~0,00026 (1/61 - 1/62), então o mesmo 0,03 empurraria um
-- documento por mais de cem posições — o trust deixaria de desempatar e
-- passaria a decidir sozinho, e um case promocional trust 1 enterraria a regra
-- que responde a pergunta. 0,0002 por nível mantém o papel original: desempate
-- entre relevâncias comparáveis, nunca substituto da relevância.

create or replace function public.knowledge_search_hybrid(
  query_embedding extensions.vector(768),
  query_text text,
  collections uuid[],
  match_count integer default 8,
  max_trust smallint default 5,
  min_similarity double precision default 0.25,
  candidates integer default 30,
  rrf_k integer default 60
)
returns table (
  chunk_id uuid,
  document_id uuid,
  collection_id uuid,
  title text,
  source text,
  trust_level smallint,
  content text,
  similarity double precision
)
language sql
stable
set search_path = ''
as $$
  -- OR, não AND. `websearch_to_tsquery` junta os termos com `&`, então uma
  -- pergunta de treze palavras vira "todos os treues radicais no MESMO chunk" e
  -- casa exatamente ZERO documentos — medido: 0 de 498, o que fazia a metade
  -- lexical devolver vazio e a busca híbrida ser idêntica à densa. Trocando
  -- por `|` os mesmos termos casam 412 chunks e o ranking sobe justamente os
  -- documentos-alvo. Recuperação quer o melhor PARCIAL, não o exato: quem
  -- decide o corte é o ts_rank_cd e a fusão, não a conjunção.
  with q as (
    select
      replace(
        websearch_to_tsquery('pg_catalog.portuguese'::regconfig, coalesce(query_text, ''))::text, '&', '|'
      )::tsquery as q_pt,
      replace(
        websearch_to_tsquery('pg_catalog.simple'::regconfig, coalesce(query_text, ''))::text, '&', '|'
      )::tsquery as q_simple
  ),
  dense as (
    select
      ch.id as chunk_id,
      1 - (ch.embedding operator(extensions.<=>) query_embedding) as sim,
      row_number() over (order by ch.embedding operator(extensions.<=>) query_embedding) as rank
    from public.knowledge_chunks ch
    join public.knowledge_documents d on d.id = ch.document_id
    where d.collection_id = any (collections)
      and d.status = 'ready'
      and d.trust_level <= max_trust
      and 1 - (ch.embedding operator(extensions.<=>) query_embedding) >= min_similarity
    order by ch.embedding operator(extensions.<=>) query_embedding
    limit greatest(candidates, match_count)
  ),
  lexical as (
    select
      ch.id as chunk_id,
      row_number() over (
        order by
          ts_rank_cd(ch.content_tsv, q.q_pt) + ts_rank_cd(ch.content_tsv, q.q_simple) +
          0.5 * (ts_rank_cd(d.doc_tsv, q.q_pt) + ts_rank_cd(d.doc_tsv, q.q_simple)) desc
      ) as rank
    from public.knowledge_chunks ch
    join public.knowledge_documents d on d.id = ch.document_id
    cross join q
    where d.collection_id = any (collections)
      and d.status = 'ready'
      and d.trust_level <= max_trust
      -- Sem piso de similaridade aqui de propósito: o termo exato que a busca
      -- densa não alcança é justamente o que esta metade existe para achar.
      and (ch.content_tsv @@ q.q_pt or ch.content_tsv @@ q.q_simple
           or d.doc_tsv @@ q.q_pt or d.doc_tsv @@ q.q_simple)
    order by
      ts_rank_cd(ch.content_tsv, q.q_pt) + ts_rank_cd(ch.content_tsv, q.q_simple) +
      0.5 * (ts_rank_cd(d.doc_tsv, q.q_pt) + ts_rank_cd(d.doc_tsv, q.q_simple)) desc
    limit greatest(candidates, match_count)
  ),
  fused as (
    select
      coalesce(dense.chunk_id, lexical.chunk_id) as chunk_id,
      coalesce(1.0 / (rrf_k + dense.rank), 0) + coalesce(1.0 / (rrf_k + lexical.rank), 0) as score,
      coalesce(dense.sim, 0) as sim
    from dense
    full outer join lexical on lexical.chunk_id = dense.chunk_id
  )
  select
    ch.id as chunk_id,
    d.id as document_id,
    d.collection_id,
    d.title,
    d.source,
    d.trust_level,
    ch.content,
    fused.sim as similarity
  from fused
  join public.knowledge_chunks ch on ch.id = fused.chunk_id
  join public.knowledge_documents d on d.id = ch.document_id
  order by fused.score + (5 - d.trust_level) * 0.0002 desc
  limit greatest(match_count, 1);
$$;

grant execute on function public.knowledge_search_hybrid(
  extensions.vector, text, uuid[], integer, smallint, double precision, integer, integer
) to authenticated, anon;
