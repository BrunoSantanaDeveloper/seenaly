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

const MAX_RETRIES = 8;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;

/**
 * Minimum spacing between embedding requests.
 *
 * Retrying is the wrong tool alone for a SUSTAINED quota. Ingesting the whole
 * corpus is ~217k tokens; against the free tier's 30k tokens/minute the job
 * physically cannot finish in under ~7 minutes, so firing as fast as possible
 * and backing off means every request races to fail. Pacing spends that time
 * up front instead, and backoff goes back to being what it should be — the
 * exception path. ~700ms keeps requests under the 100/minute ceiling too.
 *
 * Tune with `EMBED_MIN_INTERVAL_MS=0` once billing raises the limits; the
 * interactive paths (chat, how-to) issue one call at a time and never feel it.
 */
const MIN_INTERVAL_MS = Number(process.env.EMBED_MIN_INTERVAL_MS ?? 700);
let nextSlot = 0;

async function takeSlot() {
  if (MIN_INTERVAL_MS <= 0) return;
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait > 0) await sleep(wait);
}

/**
 * Two very different faults share HTTP 429, and only one is worth retrying.
 *
 * A rate limit ("you exceeded your current quota") is transient: the next
 * minute has fresh budget. Depleted prepaid credits are not — retrying just
 * burns time before failing anyway. Telling them apart matters most during a
 * bulk ingestion, where a rate limit silently turned 14 documents into
 * `status = 'error'` rows that the search RPC then filtered out of every
 * answer: a corpus with holes, reported as a successful run.
 *
 * Match ONLY the depletion wording. Both messages mention billing — the rate
 * limit says "check your plan and billing details" and the depletion links to
 * the billing docs — so keying off "billing" classifies every rate limit as
 * fatal and silently disables the retry, which is exactly what happened on the
 * first attempt at this.
 */
const isRetryableRateLimit = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (!/429|RESOURCE_EXHAUSTED/i.test(message)) return false;
  return !/credits are depleted/i.test(message);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function embed(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set — the knowledge base uses Gemini for embeddings.");
  }
  const client = new GoogleGenAI({ apiKey: key });

  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);
    let response;
    for (let attempt = 0; ; attempt++) {
      await takeSlot();
      try {
        response = await client.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: batch,
          config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
        });
        break;
      } catch (error) {
        if (attempt >= MAX_RETRIES || !isRetryableRateLimit(error)) throw error;
        // Exponential backoff, capped: per-minute quotas recover on their own,
        // so waiting is the correct response, not failing the document.
        await sleep(Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS));
      }
    }
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

/**
 * Embed several queries in ONE request.
 *
 * A retrieval plan that asks one focused question per audited dimension beats a
 * single averaged question, but only if the extra precision does not cost a
 * network round-trip per dimension. `embed` already batches up to BATCH_SIZE,
 * so N queries cost the same one call — decomposition ends up cheaper than the
 * previous code, which embedded the same string once per collection.
 */
export const embedQueries = (texts: string[]) => embed(texts, "RETRIEVAL_QUERY");
