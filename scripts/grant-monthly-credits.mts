/**
 * Grant this month's plan credits to every active paid org — the operator
 * fallback for the billing Inngest cron (packages/billing/src/jobs.ts) while
 * INNGEST_* keys are not configured. Same logic, same idempotency (once per
 * org per calendar month), so running it and the cron together is safe.
 *
 * Usage:  npm run db:grant-credits
 *
 * Requires in apps/web/.env (or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

import { grantMonthlyCredits } from "@flyee/billing";

const ROOT = path.resolve(import.meta.dirname, "..");

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

async function main() {
  await loadEnv(path.join(ROOT, "apps", "web", ".env"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (apps/web/.env).");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const result = await grantMonthlyCredits(supabase);
  console.log(
    `Month ${result.month}: ${result.eligibleOrgs} eligible org(s), ${result.granted} granted, ${result.skipped} already had this month's credits.`,
  );
}

main().catch((error: unknown) => {
  console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
