# @flyee/knowledge

Knowledge base with **trust levels** and **pgvector** retrieval — the template's RAG layer.

## Concept

Content lives in **collections** (global, superadmin-managed at `/admin/knowledge`; or org-scoped, managed by org owners/admins). Each **document** carries a `trust_level`:

| Level | Default label             | Example in a derived project  |
| ----- | ------------------------- | ----------------------------- |
| 1     | Official source           | Platform/vendor documentation |
| 2     | Verified first-party data | Real campaign/product data    |
| 3     | Reported results          | Sales/funnel outcomes         |
| 4     | Internal playbook         | Validated internal processes  |
| 5     | Unverified / opinion      | Courses, posts, opinions      |

Ingestion chunks the document (`chunkText`), embeds with **Gemini `gemini-embedding-001`** (truncated to 768 dims via `outputDimensionality`) and stores chunks in `knowledge_chunks`. Retrieval (`knowledge_search` RPC, security invoker — RLS applies) ranks by cosine similarity plus a small trust bonus, so authoritative content wins ties without crowding out relevance.

> **Changing the embedding model changes the vector space.** Documents embedded with a previous model become incomparable to new query embeddings — re-index every chunk (re-run ingestion) after a model swap. Google retired `text-embedding-004`/`embedding-001`; projects that ingested before the switch must re-index.

`chunkText` normalizes CRLF/CR to LF before splitting. This is load-bearing, not cosmetic: the paragraph split looks for two consecutive `\n`, which CRLF text never contains, so a CRLF document collapses into one "paragraph" and is sliced blind at fixed character offsets — mid-word, mid-table, mid-procedure. It is silent (chunks still exist, retrieval still returns rows) and environment-dependent, so it never reproduces in CI. `.gitattributes` pins the corpus to LF on checkout; the normalization here covers text that never touches git (admin console paste, connector payloads).

### Retrieval

`searchKnowledge(supabase, query, options)` accepts **text or a pre-computed vector**. Pass a vector when you issue several queries, or the same query across several collections — the vector does not change per collection, so embedding inside a per-collection loop pays the API once per slug for one answer. `embedQueries(texts)` embeds a whole set in a single request.

Prefer one focused question per subject over a single question that lists many. An embedding of a multi-topic string is the centroid of those topics and close to none of them, which is the worst possible match for a corpus filed by subject. `apps/web/src/lib/readiness/brief.ts` (`readinessRetrievalPlan`) is the reference implementation: one question per audited dimension, each with its own per-collection budget.

An **empty** result is not an error and not a success — decide explicitly. `buildKnowledgeContext([])` returns an empty string, so a caller that ignores the case silently ships an answer with no grounding that looks exactly like a grounded one. Seenaly's engines fail with a distinct code when the whole retrieval comes back empty, while tolerating individual questions that return nothing (an honest "the corpus does not cover this").

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

### Bulk corpus ingestion (`npm run knowledge:ingest`)

`scripts/ingest-knowledge.mts` loads the `docs/` corpora. It is idempotent, and "unchanged" means unchanged in **every input** — text, trust level, and `INGEST_PROTOCOL` (`model@dims/chunker`), persisted per document in `metadata.embedding_protocol`.

That last part is what makes a model or chunker swap safe. Without it, changing either and re-running compares only the text, finds it identical, prints `130 unchanged` and leaves the entire corpus in the old vector space — a failed migration whose output is indistinguishable from a clean run. **Bump the protocol suffix whenever chunking behaviour changes**; the model and dimensions invalidate on their own. `--force` re-embeds regardless, and the script exits non-zero if any ready document is left on a different protocol.

## Requirements

- Migration `packages/db/migrations/0003_knowledge.sql` (enables the `vector` extension).
- `GEMINI_API_KEY` — without it, ingestion/search fail with a clear hint; the rest of the app is unaffected.
