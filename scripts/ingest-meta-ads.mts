/**
 * Bulk-ingest the Meta Ads documentation corpus (docs/meta_ads/md) into the
 * global `meta-ads-docs` knowledge collection at trust level 1.
 *
 * Usage:  npm run knowledge:ingest [-- --dry-run]
 *
 * Requires in apps/web/.env (or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
 *
 * Idempotent: documents are keyed by their file slug (metadata.slug); unchanged
 * content is skipped, changed content is re-chunked and re-embedded.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

import { processDocument } from "@flyee/knowledge";

const ROOT = path.resolve(import.meta.dirname, "..");
const CORPUS_DIR = path.join(ROOT, "docs", "meta_ads", "md");
const COLLECTION_SLUG = "meta-ads-docs";
const COLLECTION_NAME = "Documentação Meta Ads";
const COLLECTION_DESCRIPTION =
  "Documentação oficial da Meta (Central de Ajuda, Blueprint, políticas) capturada em docs/meta_ads/ — nível de confiança 1.";
const TRUST_LEVEL = 1;

const DRY_RUN = process.argv.includes("--dry-run");

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
  captured?: string;
}

/** Parses the corpus' flat YAML frontmatter (scalars + inline [a, b] lists). */
function parseFrontmatter(markdown: string): { front: Frontmatter; body: string } {
  const front: Frontmatter = { tags: [], related: [] };
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
      continue;
    }
    const value = rawValue.replace(/^["']|["']$/g, "").trim();
    if (key === "title") front.title = value;
    if (key === "description") front.description = value;
    if (key === "captured") front.captured = value;
  }
  return { front, body: markdown.slice(match[0].length) };
}

/** Drops the human-only navigation line; keeps everything else (image alt text is content). */
function cleanBody(body: string): string {
  return body.replace(/^\[← Voltar ao índice\]\(INDEX\.md\)\s*/m, "").trim();
}

async function main() {
  await loadEnv(path.join(ROOT, "apps", "web", ".env"));

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

  const files = (await readdir(CORPUS_DIR)).filter((file) => file.endsWith(".md") && file !== "INDEX.md").sort();
  console.log(`${files.length} documents in ${path.relative(ROOT, CORPUS_DIR)}${DRY_RUN ? " (dry run)" : ""}`);

  if (DRY_RUN) {
    for (const file of files) {
      const { front, body } = parseFrontmatter(await readFile(path.join(CORPUS_DIR, file), "utf8"));
      const title = front.title ?? file.replace(/\.md$/, "");
      console.log(`- ${file}: "${title}" (${cleanBody(body).length} chars, tags: ${front.tags.join(", ") || "—"})`);
    }
    return;
  }

  const supabase = createClient(url!, serviceKey!, { auth: { persistSession: false } });

  // Global collection (org_id null) — service role bypasses RLS.
  const { data: existingCollection, error: collectionError } = await supabase
    .from("knowledge_collections")
    .select("id")
    .is("org_id", null)
    .eq("slug", COLLECTION_SLUG)
    .maybeSingle();
  if (collectionError) throw new Error(`Collection lookup failed: ${collectionError.message}`);

  let collectionId = existingCollection?.id as string | undefined;
  if (!collectionId) {
    const { data: created, error: createError } = await supabase
      .from("knowledge_collections")
      .insert({ org_id: null, slug: COLLECTION_SLUG, name: COLLECTION_NAME, description: COLLECTION_DESCRIPTION })
      .select("id")
      .single();
    if (createError) throw new Error(`Collection creation failed: ${createError.message}`);
    collectionId = created.id;
    console.log(`Created global collection "${COLLECTION_SLUG}"`);
  }

  let ingested = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const { front, body } = parseFrontmatter(await readFile(path.join(CORPUS_DIR, file), "utf8"));
    const content = cleanBody(body);
    const title = front.title ?? slug;
    const metadata = {
      slug,
      description: front.description ?? null,
      tags: front.tags,
      related: front.related,
      captured: front.captured ?? null,
    };

    const { data: existing, error: lookupError } = await supabase
      .from("knowledge_documents")
      .select("id, content, status")
      .eq("collection_id", collectionId)
      .eq("metadata->>slug", slug)
      .maybeSingle();
    if (lookupError) {
      console.error(`✗ ${file}: lookup failed — ${lookupError.message}`);
      failed += 1;
      continue;
    }

    if (existing && existing.content === content && existing.status === "ready") {
      skipped += 1;
      continue;
    }

    let documentId = existing?.id as string | undefined;
    if (documentId) {
      const { error } = await supabase
        .from("knowledge_documents")
        .update({ title, content, metadata, trust_level: TRUST_LEVEL, source: `docs/meta_ads/md/${file}`, status: "pending" })
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
          trust_level: TRUST_LEVEL,
          source: `docs/meta_ads/md/${file}`,
        })
        .select("id")
        .single();
      if (error) {
        console.error(`✗ ${file}: insert failed — ${error.message}`);
        failed += 1;
        continue;
      }
      documentId = created.id;
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

  console.log(`\nDone: ${ingested} ingested, ${skipped} unchanged, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
