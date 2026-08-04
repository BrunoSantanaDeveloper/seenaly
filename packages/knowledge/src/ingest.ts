import type { SupabaseClient } from "@supabase/supabase-js";

import { chunkDocument, embedTextFor } from "./chunking";
import { embedDocuments } from "./embeddings";

export type IngestResult = { ok: true; chunks: number } | { ok: false; error: string };

/**
 * Chunk + embed + store one knowledge document. Idempotent: previous chunks
 * are replaced. Runs under whatever client it is given — the Inngest job
 * passes the service client; the inline fallback passes the user's client
 * (RLS then requires collection-manage rights).
 */
export async function processDocument(supabase: SupabaseClient, documentId: string): Promise<IngestResult> {
  const { data: document, error: loadError } = await supabase
    .from("knowledge_documents")
    .select("id, title, content")
    .eq("id", documentId)
    .maybeSingle();
  if (loadError || !document) return { ok: false, error: loadError?.message ?? "Document not found." };

  await supabase.from("knowledge_documents").update({ status: "processing", error: null }).eq("id", documentId);

  try {
    const chunks = chunkDocument(document.content);
    if (chunks.length === 0) throw new Error("Document has no content to index.");
    // Embed the chunk WITH its document title and section path; store the body
    // alone. What is retrieved and what is shown are different strings on
    // purpose: the prefix gives the vector an identity, and would be noise in
    // the prompt, where the excerpt is already labelled with its source.
    const embeddings = await embedDocuments(chunks.map((chunk) => embedTextFor(document.title as string, chunk)));

    await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);
    const { error: insertError } = await supabase.from("knowledge_chunks").insert(
      chunks.map((chunk, idx) => ({
        document_id: documentId,
        idx,
        content: chunk.content,
        // pgvector accepts the '[1,2,3]' text representation.
        embedding: JSON.stringify(embeddings[idx]),
      })),
    );
    if (insertError) throw new Error(insertError.message);

    await supabase.from("knowledge_documents").update({ status: "ready" }).eq("id", documentId);
    return { ok: true, chunks: chunks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("knowledge_documents").update({ status: "error", error: message }).eq("id", documentId);
    return { ok: false, error: message };
  }
}
