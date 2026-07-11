-- ============================================================
-- 0003_knowledge: knowledge base with trust levels + pgvector RAG.
-- Collections are global (org_id null, superadmin-managed) or
-- org-scoped (managed by org owners/admins). Documents carry a
-- trust_level (1 = most authoritative .. 5 = unverified opinion)
-- that retrieval uses to prioritize evidence.
-- ============================================================

create extension if not exists vector with schema extensions;

-- ---------- Collections ----------

create table public.knowledge_collections (
  id uuid primary key default gen_random_uuid(),
  -- null = global collection (superadmin-managed, visible to everyone).
  org_id uuid references public.organizations (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (org_id, slug)
);

-- ---------- Documents ----------

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.knowledge_collections (id) on delete cascade,
  title text not null,
  -- Where the content came from (URL, file name, "manual"...). Informational.
  source text,
  -- 1 official source, 2 verified first-party data, 3 reported results,
  -- 4 internal playbook, 5 unverified/opinion. Lower = more authoritative.
  trust_level smallint not null default 5 check (trust_level between 1 and 5),
  -- Raw text to be chunked + embedded by the ingestion job.
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_documents_collection_idx on public.knowledge_documents (collection_id);

-- ---------- Chunks (the retrieval unit) ----------

-- 768 dimensions: Gemini `gemini-embedding-001` with outputDimensionality=768
-- (see packages/knowledge/src/embeddings.ts). Keep the column and the model's
-- dimension in sync; swapping the model requires re-indexing every chunk.
create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  idx integer not null,
  content text not null,
  embedding extensions.vector(768) not null,
  created_at timestamptz not null default now()
);

create index knowledge_chunks_document_idx on public.knowledge_chunks (document_id);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- ---------- RLS ----------

alter table public.knowledge_collections enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

-- Who can manage a collection: superadmin for global, owner/admin for org-scoped.
create or replace function public.can_manage_collection(target_collection uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.knowledge_collections c
    where c.id = target_collection
      and (
        (c.org_id is null and public.is_superadmin())
        or (c.org_id is not null and public.has_org_role(c.org_id, array['owner', 'admin']::public.org_role[]))
      )
  );
$$;

create policy "knowledge_collections_select" on public.knowledge_collections for select to authenticated
  using (org_id is null or public.is_org_member(org_id) or public.is_superadmin());
create policy "knowledge_collections_write_global" on public.knowledge_collections for all to authenticated
  using (org_id is null and public.is_superadmin())
  with check (org_id is null and public.is_superadmin());
create policy "knowledge_collections_write_org" on public.knowledge_collections for all to authenticated
  using (org_id is not null and public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  with check (org_id is not null and public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy "knowledge_documents_select" on public.knowledge_documents for select to authenticated
  using (
    exists (
      select 1 from public.knowledge_collections c
      where c.id = collection_id
        and (c.org_id is null or public.is_org_member(c.org_id) or public.is_superadmin())
    )
  );
create policy "knowledge_documents_write" on public.knowledge_documents for all to authenticated
  using (public.can_manage_collection(collection_id))
  with check (public.can_manage_collection(collection_id));

create policy "knowledge_chunks_select" on public.knowledge_chunks for select to authenticated
  using (
    exists (
      select 1
      from public.knowledge_documents d
      join public.knowledge_collections c on c.id = d.collection_id
      where d.id = document_id
        and (c.org_id is null or public.is_org_member(c.org_id) or public.is_superadmin())
    )
  );
-- Chunk writes: whoever can manage the parent collection (inline ingestion
-- fallback runs as the user; the Inngest job uses the service role anyway).
create policy "knowledge_chunks_write" on public.knowledge_chunks for all to authenticated
  using (
    exists (
      select 1 from public.knowledge_documents d
      where d.id = document_id and public.can_manage_collection(d.collection_id)
    )
  )
  with check (
    exists (
      select 1 from public.knowledge_documents d
      where d.id = document_id and public.can_manage_collection(d.collection_id)
    )
  );

-- ---------- Retrieval RPC ----------

-- Security invoker: RLS decides which chunks the caller can see.
-- Ranking: cosine similarity plus a small bonus per trust level, so a
-- tier-1 chunk beats a tier-5 chunk of comparable relevance without
-- letting authoritative-but-irrelevant content crowd out good matches.
create or replace function public.knowledge_search(
  query_embedding extensions.vector(768),
  collections uuid[],
  match_count integer default 8,
  max_trust smallint default 5,
  min_similarity double precision default 0.25
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
  select
    ch.id as chunk_id,
    d.id as document_id,
    d.collection_id,
    d.title,
    d.source,
    d.trust_level,
    ch.content,
    1 - (ch.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.knowledge_chunks ch
  join public.knowledge_documents d on d.id = ch.document_id
  where d.collection_id = any (collections)
    and d.status = 'ready'
    and d.trust_level <= max_trust
    and 1 - (ch.embedding operator(extensions.<=>) query_embedding) >= min_similarity
  order by
    (1 - (ch.embedding operator(extensions.<=>) query_embedding)) + (5 - d.trust_level) * 0.03 desc
  limit greatest(match_count, 1);
$$;

-- ---------- updated_at maintenance ----------

create trigger knowledge_collections_updated_at
  before update on public.knowledge_collections
  for each row execute function public.set_updated_at();

create trigger knowledge_documents_updated_at
  before update on public.knowledge_documents
  for each row execute function public.set_updated_at();
