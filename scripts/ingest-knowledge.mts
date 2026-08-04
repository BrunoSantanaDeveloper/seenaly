/**
 * Bulk-ingest the documentation corpora under docs/ into global knowledge
 * collections. Each corpus maps a markdown directory to one collection with a
 * default trust level; individual documents can override it via a `trust:`
 * frontmatter field.
 *
 * Usage:  npm run knowledge:ingest [-- --corpus=<slug>] [-- --dry-run] [-- --force]
 *
 * Requires in apps/web/.env (or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
 *
 * Idempotent: documents are keyed by their file slug (metadata.slug); unchanged
 * content is skipped, changed content is re-chunked and re-embedded.
 *
 * "Unchanged" means unchanged IN EVERY INPUT, not just the text. A vector is
 * derived from the text AND from the embedding model AND from the chunker, so
 * the skip check carries INGEST_PROTOCOL (below) — otherwise swapping the model
 * or the splitter and re-running prints "130 unchanged" and leaves the whole
 * corpus in the old vector space, reporting success. That is the one failure
 * mode of a re-ingestion that looks exactly like a clean run.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, normalizeNewlines, processDocument } from "@flyee/knowledge";

const ROOT = path.resolve(import.meta.dirname, "..");

interface Corpus {
  slug: string;
  name: string;
  description: string;
  /** Directory of .md documents, relative to the repo root. */
  dir: string;
  /** Trust level applied when a document has no `trust:` frontmatter field. */
  defaultTrust: 1 | 2 | 3 | 4 | 5;
}

const CORPORA: Corpus[] = [
  {
    slug: "meta-ads-docs",
    name: "Documentação Meta Ads",
    description:
      "Documentação oficial da Meta (Central de Ajuda, Blueprint, políticas) capturada em docs/meta_ads/ — nível de confiança 1.",
    dir: "docs/meta_ads/md",
    defaultTrust: 1,
  },
  {
    slug: "growth-playbook",
    name: "Playbook de Growth (CRO, checkout, oferta)",
    description:
      "Corpus autoral em docs/growth/: princípios de CRO, checkout, oferta e funil sintetizados de pesquisa publicada e frameworks de mercado, com atribuição de fontes. Trust por documento (2 = pesquisa quantitativa publicada, 4 = playbook sintetizado).",
    dir: "docs/growth/md",
    defaultTrust: 4,
  },
];

/**
 * Identifies the vector space a document's chunks live in. Persisted per
 * document in `metadata.embedding_protocol` and compared on every run, so any
 * change here invalidates the ingestion cache automatically.
 *
 * BUMP THE SUFFIX whenever the chunking behaviour changes (`chunkText` params
 * or algorithm). The model and dimensions come from the constants, so those
 * invalidate on their own.
 */
const INGEST_PROTOCOL = `${EMBEDDING_MODEL}@${EMBEDDING_DIMENSIONS}/chunk-v3-titled`;

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const corpusArg = process.argv.find((arg) => arg.startsWith("--corpus="))?.slice("--corpus=".length);

/** Minimal .env loader — never overrides variables already set in the environment. */
async function loadEnv(file: string) {
  const raw = await readFile(file, "utf8").catch(() => "");
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

interface Frontmatter {
  title?: string;
  description?: string;
  tags: string[];
  related: string[];
  sources: string[];
  captured?: string;
  trust?: number;
}

/** Parses the corpus' flat YAML frontmatter (scalars + inline [a, b] lists). */
function parseFrontmatter(markdown: string): { front: Frontmatter; body: string } {
  const front: Frontmatter = { tags: [], related: [], sources: [] };
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(markdown);
  if (!match) return { front, body: markdown };

  for (const line of match[1].split(/\r?\n/)) {
    const entry = /^([a-zA-Z_]+):\s*(.*)$/.exec(line);
    if (!entry) continue;
    const [, key, rawValue] = entry;
    if (rawValue.startsWith("[")) {
      const items = rawValue
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      if (key === "tags") front.tags = items;
      if (key === "related") front.related = items;
      if (key === "sources") front.sources = items;
      continue;
    }
    const value = rawValue.replace(/^["']|["']$/g, "").trim();
    if (key === "title") front.title = value;
    if (key === "description") front.description = value;
    if (key === "captured") front.captured = value;
    if (key === "trust") front.trust = Number(value);
  }
  return { front, body: markdown.slice(match[0].length) };
}

function resolveTrust(front: Frontmatter, corpus: Corpus, file: string): 1 | 2 | 3 | 4 | 5 {
  if (front.trust === undefined) return corpus.defaultTrust;
  if (![1, 2, 3, 4, 5].includes(front.trust)) {
    throw new Error(`${file}: invalid frontmatter trust "${front.trust}" (expected 1-5)`);
  }
  return front.trust as 1 | 2 | 3 | 4 | 5;
}

/**
 * Drops human-only navigation; keeps everything else (image alt text is content).
 *
 * Newlines are normalized here so the stored `content` is LF regardless of how
 * the corpus was checked out — the chunker needs `\n\n` to see paragraphs at
 * all (see chunking.ts), and keeping the DB copy canonical also keeps the
 * skip-comparison below stable across machines.
 *
 * Link-only bullets are navigation, not content: a list of internal `.md`
 * links carries no rule, but it embeds as a dense list of topic names, which
 * scores well against a multi-topic retrieval query and burns evidence slots
 * that should hold an actual platform rule. Bullets that also carry prose are
 * left alone — the test is that the bullet is ONLY a link.
 */
function cleanBody(body: string): string {
  return normalizeNewlines(body)
    .replace(/^\[← Voltar[^\]]*\]\(INDEX\.md\)\s*/im, "")
    .replace(/^[ \t]*[-*][ \t]*\[[^\]]+\]\([^)]+\.md\)[ \t]*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Pure navigation documents ("índice do tópico") are excluded from ingestion.
 *
 * They are lists of topic titles with no rule in them, and that shape is
 * pathologically attractive to the readiness query, which is itself a list of
 * topics — high cosine similarity, zero citable content. The corpus already
 * self-declares them with the `index` tag, so no heuristic is needed.
 */
const isNavigationOnly = (front: Frontmatter) =>
  front.tags.includes("index") || /\(\s*[íi]ndice do t[óo]pico\s*\)/i.test(front.title ?? "");

async function ingestCorpus(supabase: ReturnType<typeof createClient>, corpus: Corpus) {
  const corpusDir = path.join(ROOT, corpus.dir);
  const files = (await readdir(corpusDir)).filter((file) => file.endsWith(".md") && file !== "INDEX.md").sort();
  console.log(`\n[${corpus.slug}] ${files.length} documents in ${corpus.dir}${DRY_RUN ? " (dry run)" : ""}`);

  if (DRY_RUN) {
    for (const file of files) {
      const { front, body } = parseFrontmatter(await readFile(path.join(corpusDir, file), "utf8"));
      const title = front.title ?? file.replace(/\.md$/, "");
      const trust = resolveTrust(front, corpus, file);
      if (isNavigationOnly(front)) {
        console.log(`- ${file}: SKIP (navegação) "${title}"`);
        continue;
      }
      console.log(
        `- ${file}: "${title}" (trust ${trust}, ${cleanBody(body).length} chars, tags: ${front.tags.join(", ") || "—"})`,
      );
    }
    return { ingested: 0, skipped: 0, failed: 0 };
  }

  // Global collection (org_id null) — service role bypasses RLS.
  const { data: existingCollection, error: collectionError } = await supabase
    .from("knowledge_collections")
    .select("id")
    .is("org_id", null)
    .eq("slug", corpus.slug)
    .maybeSingle();
  if (collectionError) throw new Error(`Collection lookup failed: ${collectionError.message}`);

  let collectionId = existingCollection?.id as string | undefined;
  if (!collectionId) {
    const { data: created, error: createError } = await supabase
      .from("knowledge_collections")
      .insert({ org_id: null, slug: corpus.slug, name: corpus.name, description: corpus.description })
      .select("id")
      .single();
    if (createError) throw new Error(`Collection creation failed: ${createError.message}`);
    collectionId = created.id as string;
    console.log(`Created global collection "${corpus.slug}"`);
  }

  let ingested = 0;
  let skipped = 0;
  let failed = 0;
  let navigation = 0;
  let removed = 0;

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const { front, body } = parseFrontmatter(await readFile(path.join(corpusDir, file), "utf8"));
    if (isNavigationOnly(front)) {
      navigation += 1;
      // Skipping is not enough: a document ingested before this rule existed
      // keeps its row AND its chunks, stays `ready`, and goes on being
      // retrieved — the exclusion would be a no-op against exactly the corpus
      // it was written for. Delete it; `knowledge_chunks` cascades
      // (0003_knowledge.sql:55), and re-running ingestion without the rule
      // recreates it, so nothing is lost that `docs/` cannot regenerate.
      const { data: stale } = await supabase
        .from("knowledge_documents")
        .select("id")
        .eq("collection_id", collectionId)
        .eq("metadata->>slug", slug)
        .maybeSingle();
      if (stale) {
        const { error } = await supabase.from("knowledge_documents").delete().eq("id", stale.id);
        if (error) {
          console.error(`✗ ${file}: could not remove navigation document — ${error.message}`);
          failed += 1;
        } else {
          console.log(`− ${file}: documento de navegação removido do corpus`);
          removed += 1;
        }
      }
      continue;
    }
    const content = cleanBody(body);
    const title = front.title ?? slug;
    const trust = resolveTrust(front, corpus, file);
    const metadata = {
      slug,
      description: front.description ?? null,
      tags: front.tags,
      related: front.related,
      sources: front.sources,
      captured: front.captured ?? null,
      embedding_protocol: INGEST_PROTOCOL,
    };

    const { data: existing, error: lookupError } = await supabase
      .from("knowledge_documents")
      .select("id, content, status, trust_level, metadata")
      .eq("collection_id", collectionId)
      .eq("metadata->>slug", slug)
      .maybeSingle();
    if (lookupError) {
      console.error(`✗ ${file}: lookup failed — ${lookupError.message}`);
      failed += 1;
      continue;
    }

    const storedProtocol = (existing?.metadata as { embedding_protocol?: string } | null)?.embedding_protocol;
    if (
      !FORCE &&
      existing &&
      existing.content === content &&
      existing.trust_level === trust &&
      existing.status === "ready" &&
      storedProtocol === INGEST_PROTOCOL
    ) {
      skipped += 1;
      continue;
    }

    let documentId = existing?.id as string | undefined;
    if (documentId) {
      const { error } = await supabase
        .from("knowledge_documents")
        .update({ title, content, metadata, trust_level: trust, source: `${corpus.dir}/${file}`, status: "pending" })
        .eq("id", documentId);
      if (error) {
        console.error(`✗ ${file}: update failed — ${error.message}`);
        failed += 1;
        continue;
      }
    } else {
      const { data: created, error } = await supabase
        .from("knowledge_documents")
        .insert({
          collection_id: collectionId,
          title,
          content,
          metadata,
          trust_level: trust,
          source: `${corpus.dir}/${file}`,
        })
        .select("id")
        .single();
      if (error) {
        console.error(`✗ ${file}: insert failed — ${error.message}`);
        failed += 1;
        continue;
      }
      documentId = created.id as string;
    }

    const result = await processDocument(supabase, documentId!);
    if (result.ok) {
      console.log(`✓ ${file}: ${result.chunks} chunks`);
      ingested += 1;
    } else {
      console.error(`✗ ${file}: ${result.error}`);
      failed += 1;
    }
  }

  if (navigation > 0) {
    console.log(`  (${navigation} documento(s) de navegação ignorado(s), ${removed} removido(s) do corpus)`);
  }
  return { ingested, skipped, failed, navigation };
}

/**
 * Fails the run unless the WHOLE corpus is searchable and on this protocol.
 *
 * This script is the only place that sees the whole corpus, so it is the right
 * place to assert the invariant — and the invariant has two halves, because
 * both failures are silent:
 *
 *  - a stale protocol mixes incompatible vector spaces, which has no symptom
 *    beyond quietly worse retrieval;
 *  - a document left in `status = 'error'` is filtered out by the search RPC
 *    (0003_knowledge.sql:176), so the corpus has a hole and every answer is
 *    written without it. A transient rate limit produced exactly this: 14
 *    documents dropped out of retrieval while the run reported success.
 */
async function assertCorpusHealthy(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.from("knowledge_documents").select("title, status, error, metadata");
  if (error) {
    console.error(`\n! Não foi possível verificar o corpus: ${error.message}`);
    return false;
  }
  const docs = data ?? [];
  const broken = docs.filter((doc) => doc.status !== "ready");
  const stale = docs.filter(
    (doc) =>
      doc.status === "ready" &&
      (doc.metadata as { embedding_protocol?: string } | null)?.embedding_protocol !== INGEST_PROTOCOL,
  );

  if (broken.length === 0 && stale.length === 0) {
    console.log(`\n✓ ${docs.length} documentos prontos, todos no protocolo ${INGEST_PROTOCOL}.`);
    return true;
  }

  if (broken.length > 0) {
    console.error(`\n✗ ${broken.length} documento(s) FORA da busca (status != ready):`);
    for (const doc of broken.slice(0, 10)) {
      console.error(`  - ${doc.title} [${doc.status}] ${(doc.error ?? "").slice(0, 120)}`);
    }
    if (broken.length > 10) console.error(`  … e mais ${broken.length - 10}.`);
    console.error("Rode novamente: documentos com falha são reprocessados (o skip exige status 'ready').");
  }
  if (stale.length > 0) {
    console.error(`\n✗ ${stale.length} documento(s) fora do protocolo ${INGEST_PROTOCOL}:`);
    for (const doc of stale.slice(0, 10)) {
      const proto = (doc.metadata as { embedding_protocol?: string } | null)?.embedding_protocol ?? "(nenhum)";
      console.error(`  - ${doc.title} — ${proto}`);
    }
    if (stale.length > 10) console.error(`  … e mais ${stale.length - 10}.`);
    console.error("A busca mistura espaços vetoriais incompatíveis. Rode novamente (ou com --force).");
  }
  return false;
}

async function main() {
  await loadEnv(path.join(ROOT, "apps", "web", ".env"));

  const corpora = corpusArg ? CORPORA.filter((corpus) => corpus.slug === corpusArg) : CORPORA;
  if (corpora.length === 0) {
    console.error(`Unknown corpus "${corpusArg}". Available: ${CORPORA.map((c) => c.slug).join(", ")}`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
    !process.env.GEMINI_API_KEY && "GEMINI_API_KEY",
  ].filter(Boolean);
  if (missing.length > 0 && !DRY_RUN) {
    console.error(`Missing env vars (apps/web/.env): ${missing.join(", ")}`);
    console.error("Configure Supabase + Gemini, apply migration 0003_knowledge.sql, then rerun.");
    process.exit(1);
  }

  const supabase = DRY_RUN ? (null as never) : createClient(url!, serviceKey!, { auth: { persistSession: false } });

  let ingested = 0;
  let skipped = 0;
  let failed = 0;
  let navigation = 0;
  for (const corpus of corpora) {
    const result = await ingestCorpus(supabase, corpus);
    ingested += result.ingested;
    skipped += result.skipped;
    failed += result.failed;
    navigation += result.navigation;
  }

  if (DRY_RUN) return;
  console.log(`\nDone: ${ingested} ingested, ${skipped} unchanged, ${navigation} navigation-only, ${failed} failed.`);
  console.log(`Protocolo: ${INGEST_PROTOCOL}`);

  // Only meaningful for a full run: ingesting one corpus legitimately leaves
  // the other on whatever protocol it already had.
  const consistent = corpusArg ? true : await assertCorpusHealthy(supabase);
  if (failed > 0 || !consistent) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
