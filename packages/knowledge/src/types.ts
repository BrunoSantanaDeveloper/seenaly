/** 1 = most authoritative, 5 = unverified opinion. */
export type TrustLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Generic labels — derived projects narrate their own tiers (e.g. a paid
 * acquisition product maps 1 to "official platform docs" and 2 to "real
 * campaign data") without changing the schema.
 */
export const TRUST_LEVEL_LABELS: Record<TrustLevel, string> = {
  1: "Official source",
  2: "Verified first-party data",
  3: "Reported results",
  4: "Internal playbook",
  5: "Unverified / opinion",
};

export interface KnowledgeSearchResult {
  chunk_id: string;
  document_id: string;
  collection_id: string;
  title: string;
  source: string | null;
  trust_level: TrustLevel;
  content: string;
  similarity: number;
}

export interface KnowledgeSearchOptions {
  /** Collection ids (uuid). Use resolveCollectionIds() to map slugs. */
  collectionIds: string[];
  matchCount?: number;
  /** Only return documents at this trust level or better (lower number). */
  maxTrust?: TrustLevel;
  minSimilarity?: number;
  /**
   * Cap how many chunks may come from the SAME document. Without it, one long
   * on-topic document routinely fills the whole window with near-duplicate
   * neighbours, and a second document that answers a different half of the
   * question never appears. Costs one wider query, then filters locally.
   */
  maxPerDocument?: number;
}

/**
 * Shape of `assistants.config.knowledge` — when present, the chat route
 * retrieves context from these collections before answering.
 */
export interface AssistantKnowledgeConfig {
  /** Collection slugs (global or belonging to the caller's org). */
  collections: string[];
  matchCount?: number;
  maxTrust?: TrustLevel;
}
