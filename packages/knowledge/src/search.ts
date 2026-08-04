import type { SupabaseClient } from "@supabase/supabase-js";

import { embedQuery } from "./embeddings";
import { TRUST_LEVEL_LABELS, type KnowledgeSearchOptions, type KnowledgeSearchResult } from "./types";

/** Map collection slugs to ids (global collections plus the caller's orgs, per RLS). */
export async function resolveCollectionIds(supabase: SupabaseClient, slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const { data } = await supabase.from("knowledge_collections").select("id").in("slug", slugs);
  return (data ?? []).map((row) => row.id as string);
}

/**
 * Run the trust-weighted vector search (RLS applies).
 *
 * `query` accepts a pre-computed vector as well as text. Callers that issue
 * several queries should embed them in one batch (`embedQueries`) and pass the
 * vectors here — otherwise each search pays its own round-trip, and a caller
 * that searches the same text across N collections pays N times for one vector.
 */
export async function searchKnowledge(
  supabase: SupabaseClient,
  query: string | number[],
  options: KnowledgeSearchOptions,
): Promise<KnowledgeSearchResult[]> {
  if (options.collectionIds.length === 0) return [];
  const matchCount = options.matchCount ?? 8;
  const perDocument = options.maxPerDocument;
  const embedding = typeof query === "string" ? await embedQuery(query) : query;
  const { data, error } = await supabase.rpc("knowledge_search", {
    query_embedding: JSON.stringify(embedding),
    collections: options.collectionIds,
    // Over-fetch when diversifying: the cap discards chunks, so asking for the
    // final count would return fewer than requested.
    match_count: perDocument ? matchCount * 4 : matchCount,
    max_trust: options.maxTrust ?? 5,
    min_similarity: options.minSimilarity ?? 0.25,
  });
  if (error) throw new Error(`knowledge_search failed: ${error.message}`);

  const results = (data ?? []) as KnowledgeSearchResult[];
  if (!perDocument) return results;

  // Results arrive already ranked, so a single pass keeps the best chunks of
  // each document and drops that document's tail once the cap is reached.
  const seen = new Map<string, number>();
  const diversified: KnowledgeSearchResult[] = [];
  for (const result of results) {
    if (diversified.length >= matchCount) break;
    const used = seen.get(result.document_id) ?? 0;
    if (used >= perDocument) continue;
    seen.set(result.document_id, used + 1);
    diversified.push(result);
  }
  return diversified;
}

/**
 * Format retrieved chunks as a context block to append to a system prompt.
 * Each excerpt is labeled with its trust level so the assistant can weigh
 * (and cite) evidence instead of answering generically.
 */
export function buildKnowledgeContext(results: KnowledgeSearchResult[]): string {
  if (results.length === 0) return "";
  const excerpts = results
    .map((result, index) => {
      const label = TRUST_LEVEL_LABELS[result.trust_level] ?? `level ${result.trust_level}`;
      const source = result.source ? ` — ${result.source}` : "";
      return `[${index + 1}] (trust ${result.trust_level}: ${label}) ${result.title}${source}\n${result.content}`;
    })
    .join("\n\n---\n\n");
  return [
    "\n\n## Retrieved knowledge",
    "Ground your answer in the excerpts below. Prefer lower trust-level numbers (1 is most authoritative).",
    "Cite excerpts as [n] and say when the excerpts do not cover the question — never invent evidence.",
    "",
    excerpts,
  ].join("\n");
}
