/**
 * Sync the live `diagnosis-engine` assistant row with migration 0012.
 *
 * The engine's system prompt + config live in packages/db/migrations/0012_diagnoses.sql
 * as the canonical source, but that migration's INSERT never ran live (the
 * table pre-existed, and apply-migrations deletes the seed row before applying
 * 0012 — see its PRE_APPLY_FIXUPS). So the row is kept in sync from here with a
 * service-role UPDATE. Run this after ANY edit to the 0012 prompt/config.
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
const MIGRATION = path.join(ROOT, "packages", "db", "migrations", "0012_diagnoses.sql");
const SLUG = "diagnosis-engine";

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

/** Extract the engine's fields from the 0012 INSERT (canonical source). */
function parseEngine(sql: string): EngineFields {
  const prompt = /\$prompt\$([\s\S]*?)\$prompt\$/.exec(sql);
  if (!prompt) throw new Error("Could not find the $prompt$...$prompt$ block in 0012.");
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

  const sql = await readFile(MIGRATION, "utf8");
  const fields = parseEngine(sql);

  const { error } = await supabase
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
    .eq("slug", SLUG);
  if (error) throw new Error(`Updating ${SLUG} failed: ${error.message}`);

  console.log(
    `Synced '${SLUG}' from 0012: model=${fields.model}, max_tokens=${fields.max_tokens}, credits=${fields.credits_per_message}, prompt=${fields.system_prompt.length} chars.`,
  );
}

main().catch((error: unknown) => {
  console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
