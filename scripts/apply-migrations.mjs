/**
 * Reconcile the live database with packages/db/migrations.
 *
 * For each migration file, derives a marker object (first `create table
 * public.X`, else first `create function public.X`, else the storage bucket it
 * inserts) and checks the live catalogs (information_schema / pg_proc /
 * storage.buckets) — the source of truth, immune to PostgREST cache staleness.
 * Missing migrations are applied in order, each inside its own transaction,
 * and PostgREST is told to reload its schema cache at the end.
 *
 * Usage:  npm run db:migrate [-- --dry-run]
 *
 * Requires DATABASE_URL in apps/web/.env (or the environment) — use the
 * Supabase **Transaction Pooler** URI (port 6543); the script disables
 * prepared statements accordingly.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import postgres from "postgres";

const ROOT = path.resolve(import.meta.dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "packages", "db", "migrations");
const DRY_RUN = process.argv.includes("--dry-run");

/**
 * One-time data fixups that must run right before a given migration is applied
 * on a database where earlier sessions seeded rows out-of-band. Each statement
 * must be a no-op on a fresh database.
 */
const PRE_APPLY_FIXUPS = {
  // The diagnosis-engine assistant row was seeded via service-role upsert
  // before 0012 was ever applied; the migration's plain INSERT (no ON
  // CONFLICT) would collide with it. The migration file carries the canonical
  // prompt + config, so the live row is disposable.
  "0012_diagnoses.sql": ["delete from public.assistants where slug = 'diagnosis-engine'"],
};

/** Minimal .env loader — never overrides variables already set in the environment. */
async function loadEnv(file) {
  const raw = await readFile(file, "utf8").catch(() => "");
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

/** Derives the object whose existence marks this migration as applied. */
function deriveMarker(sqlText) {
  const table = /create table (?:if not exists )?public\.([a-z0-9_]+)/i.exec(sqlText);
  if (table) return { kind: "table", name: table[1] };
  const fn = /create (?:or replace )?function public\.([a-z0-9_]+)/i.exec(sqlText);
  if (fn) return { kind: "function", name: fn[1] };
  const bucket = /insert into storage\.buckets[^;]*?'([a-z0-9-]+)'/is.exec(sqlText);
  if (bucket) return { kind: "bucket", name: bucket[1] };
  return null;
}

async function markerExists(sql, marker) {
  if (marker.kind === "table") {
    const r = await sql`
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = ${marker.name} limit 1`;
    return r.length > 0;
  }
  if (marker.kind === "function") {
    const r = await sql`
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = ${marker.name} limit 1`;
    return r.length > 0;
  }
  if (marker.kind === "bucket") {
    const r = await sql`select 1 from storage.buckets where id = ${marker.name} limit 1`;
    return r.length > 0;
  }
  return false;
}

async function main() {
  await loadEnv(path.join(ROOT, "apps", "web", ".env"));
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (apps/web/.env). Use the Supabase Transaction Pooler URI (port 6543).");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 20 });

  try {
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    const pending = [];

    for (const file of files) {
      const text = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      const marker = deriveMarker(text);
      if (!marker) {
        console.warn(`SKIP ${file} — no marker object derivable; verify manually.`);
        continue;
      }
      const applied = await markerExists(sql, marker);
      console.log(`${applied ? "applied" : "MISSING"}  ${file}  (marker: ${marker.kind} ${marker.name})`);
      if (!applied) pending.push({ file, text });
    }

    if (pending.length === 0) {
      console.log("\nDatabase is up to date.");
      return;
    }
    if (DRY_RUN) {
      console.log(`\nDry run: ${pending.length} migration(s) would be applied: ${pending.map((p) => p.file).join(", ")}`);
      return;
    }

    for (const { file, text } of pending) {
      process.stdout.write(`Applying ${file} ... `);
      await sql.begin(async (tx) => {
        for (const fixup of PRE_APPLY_FIXUPS[file] ?? []) await tx.unsafe(fixup);
        await tx.unsafe(text);
      });
      console.log("done");
    }

    await sql.notify("pgrst", "reload schema");
    console.log(`\nApplied ${pending.length} migration(s); asked PostgREST to reload its schema cache.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(`\nFAILED: ${error.message}`);
  process.exit(1);
});
