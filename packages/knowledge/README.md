# @flyee/knowledge

Knowledge base with **trust levels** and **pgvector** retrieval — the template's RAG layer.

## Concept

Content lives in **collections** (global, superadmin-managed at `/admin/knowledge`; or org-scoped, managed by org owners/admins). Each **document** carries a `trust_level`:

| Level | Default label | Example in a derived project |
|---|---|---|
| 1 | Official source | Platform/vendor documentation |
| 2 | Verified first-party data | Real campaign/product data |
| 3 | Reported results | Sales/funnel outcomes |
| 4 | Internal playbook | Validated internal processes |
| 5 | Unverified / opinion | Courses, posts, opinions |

Ingestion chunks the document (`chunkText`), embeds with **Gemini `gemini-embedding-001`** (truncated to 768 dims via `outputDimensionality`) and stores chunks in `knowledge_chunks`. Retrieval (`knowledge_search` RPC, security invoker — RLS applies) ranks by cosine similarity plus a small trust bonus, so authoritative content wins ties without crowding out relevance.

> **Changing the embedding model changes the vector space.** Documents embedded with a previous model become incomparable to new query embeddings — re-index every chunk (re-run ingestion) after a model swap. Google retired `text-embedding-004`/`embedding-001`; projects that ingested before the switch must re-index.

## Wiring into assistants

Set `config.knowledge` on an assistant row (editable in `/admin/ai`):

```json
{ "knowledge": { "collections": ["meta-ads-docs"], "matchCount": 8, "maxTrust": 5 } }
```

The chat route then embeds the user message, retrieves matching chunks and appends a grounded-context block (`buildKnowledgeContext`) to the system prompt, instructing the assistant to cite excerpts and never invent evidence.

## Ingestion path

`/admin/knowledge` (or your own code) inserts a `knowledge_documents` row, then:

1. `sendEvent("knowledge/document.ingest", { documentId })` — processed by the Inngest job (service role).
2. If the event cannot be queued (`sent: false`), callers fall back to `processDocument(supabase, documentId)` inline with the user's client (RLS requires collection-manage rights).

## Requirements

- Migration `packages/db/migrations/0003_knowledge.sql` (enables the `vector` extension).
- `GEMINI_API_KEY` — without it, ingestion/search fail with a clear hint; the rest of the app is unaffected.
