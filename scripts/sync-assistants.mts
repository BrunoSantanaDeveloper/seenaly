/**
 * Sync the live engine assistant rows with their migrations.
 *
 * Each engine's system prompt + config live in its migration as the canonical
 * source, but a migration's INSERT may never run live (the table can pre-exist,
 * and apply-migrations deletes the seed row before applying 0012 — see its
 * PRE_APPLY_FIXUPS). So the rows are kept in sync from here with a service-role
 * UPDATE. Run this after ANY edit to an engine prompt/config.
 *
 * The prompts ARE the product (docs/PRODUCT.md: instruction-driven assistants,
 * tunable at runtime in /admin/ai) — editing one must not require a deploy.
 *
 * Usage:  npm run db:sync-assistants
 *
 * Requires in apps/web/.env (or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Every instruction-driven engine and the migration that defines it. */
const ENGINES = [
  { slug: "diagnosis-engine", migration: "0012_diagnoses.sql" },
  { slug: "readiness-engine", migration: "0028_readiness.sql" },
  { slug: "creative-plan-engine", migration: "0033_creative_plan.sql" },
] as const;

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

interface EngineFields {
  provider: string;
  model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  credits_per_message: number;
  config: unknown;
}

/** Extract an engine's fields from its migration INSERT (canonical source). */
function parseEngine(sql: string, file: string): EngineFields {
  const prompt = /\$prompt\$([\s\S]*?)\$prompt\$/.exec(sql);
  if (!prompt) throw new Error(`Could not find the $prompt$...$prompt$ block in ${file}.`);
  const system_prompt = prompt[1];

  // provider, model are the two quoted values immediately before the prompt.
  const beforePrompt = /'([^']+)'\s*,\s*'([^']+)'\s*,\s*\$prompt\$/.exec(sql);
  if (!beforePrompt) throw new Error("Could not read provider/model before the prompt.");
  const [, provider, model] = beforePrompt;

  // After the prompt come temperature, max_tokens, credits, config — with SQL
  // line comments interleaved. Strip comments from the tail, then read them.
  const tail = sql
    .slice(prompt.index + prompt[0].length)
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
  const nums = /,\s*([\d.]+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'(\{[\s\S]*?\})'::jsonb/.exec(tail);
  if (!nums) throw new Error("Could not read temperature/max_tokens/credits/config after the prompt.");

  return {
    provider,
    model,
    system_prompt,
    temperature: Number(nums[1]),
    max_tokens: Number(nums[2]),
    credits_per_message: Number(nums[3]),
    config: JSON.parse(nums[4]),
  };
}

async function main() {
  await loadEnv(path.join(ROOT, "apps", "web", ".env"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (apps/web/.env).");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const engine of ENGINES) {
    const sql = await readFile(path.join(ROOT, "packages", "db", "migrations", engine.migration), "utf8");
    const fields = parseEngine(sql, engine.migration);

    const { data, error } = await supabase
      .from("assistants")
      .update({
        provider: fields.provider,
        model: fields.model,
        system_prompt: fields.system_prompt,
        temperature: fields.temperature,
        max_tokens: fields.max_tokens,
        credits_per_message: fields.credits_per_message,
        config: fields.config,
        is_active: true,
      })
      .eq("slug", engine.slug)
      .select("slug");
    if (error) throw new Error(`Updating ${engine.slug} failed: ${error.message}`);

    // No row yet = its migration has not been applied. Say so plainly rather
    // than reporting a sync that silently touched nothing.
    if (!data || data.length === 0) {
      console.warn(`SKIP '${engine.slug}' — no such row live. Apply ${engine.migration} first (npm run db:migrate).`);
      continue;
    }

    console.log(
      `Synced '${engine.slug}' from ${engine.migration}: model=${fields.model}, max_tokens=${fields.max_tokens}, credits=${fields.credits_per_message}, prompt=${fields.system_prompt.length} chars.`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
