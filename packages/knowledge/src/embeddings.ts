import { GoogleGenAI } from "@google/genai";

/**
 * Google retired `text-embedding-004` (and `embedding-001`): the Gemini API
 * now 404s them on embedContent. `gemini-embedding-001` is the successor; it
 * defaults to 3072 dims but honors `outputDimensionality`, so we keep 768 and
 * the `vector(768)` column from migration 0003 unchanged. Documents and
 * queries both go through embed() below, so they can never drift apart.
 *
 * Truncated (non-3072) vectors are not unit-normalized. That is fine here:
 * retrieval uses cosine distance (`vector_cosine_ops` / `<=>`), which is
 * magnitude-invariant. Normalize first if you ever switch the index to an
 * inner-product operator.
 *
 * Changing this model changes the embedding space — chunks embedded with a
 * previous model must be RE-INDEXED, or queries will retrieve nonsense.
 */
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

export const isEmbeddingConfigured = () => Boolean(process.env.GEMINI_API_KEY);

const BATCH_SIZE = 100;

async function embed(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set — the knowledge base uses Gemini for embeddings.");
  }
  const client = new GoogleGenAI({ apiKey: key });

  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);
    const response = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batch,
      config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
    });
    for (const embedding of response.embeddings ?? []) {
      if (!embedding.values) throw new Error("Gemini returned an empty embedding.");
      vectors.push(embedding.values);
    }
  }
  if (vectors.length !== texts.length) {
    throw new Error(`Expected ${texts.length} embeddings, got ${vectors.length}.`);
  }
  return vectors;
}

export const embedDocuments = (texts: string[]) => embed(texts, "RETRIEVAL_DOCUMENT");
export const embedQuery = async (text: string) => (await embed([text], "RETRIEVAL_QUERY"))[0];
