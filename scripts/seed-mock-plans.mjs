/**
 * Seed the Seenaly mock plan catalog (no payment provider yet): Free / Pro /
 * Scale as real `plans` rows with pt-BR copy and the limits the app reads
 * (`members`, `organic_growth`, `organic_social_accounts`). `provider_refs`
 * stays empty on purpose — checkout is intentionally disabled until a
 * Stripe/Asaas account exists; prices are storefront placeholders, editable
 * any time in /admin/billing.
 *
 * Optionally moves an organization onto a plan and grants beta credits:
 *
 *   npm run db:seed-plans                                  # plans only
 *   npm run db:seed-plans -- --org=<uuid> --to=pro --credits=500
 *
 * Idempotent: plans upsert by slug; the org move is skipped when the org is
 * already on the target plan; credits are granted at most once per org+reason.
 *
 * Requires in apps/web/.env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");

const PLANS = [
  {
    slug: "free",
    name: "Free",
    description: "Comece grátis: contexto de produto, diagnóstico guiado e memória de experimentos.",
    kind: "recurring",
    period: "monthly",
    price_cents: 0,
    currency: "BRL",
    is_free: true,
    is_active: true,
    trial_days: 0,
    limits: { members: 1 },
    sort: 0,
  },
  {
    slug: "pro",
    name: "Pro",
    description: "Para quem roda tráfego todo dia: Organic Growth incluído e diagnósticos com dados da conta.",
    kind: "recurring",
    period: "monthly",
    price_cents: 19700,
    currency: "BRL",
    is_free: false,
    is_active: true,
    trial_days: 14,
    limits: { members: 3, organic_growth: true, organic_social_accounts: 1 },
    sort: 1,
  },
  {
    slug: "scale",
    name: "Scale",
    description: "Para equipes e contas maiores: mais assentos, mais contas orgânicas, mesmo motor de decisão.",
    kind: "recurring",
    period: "monthly",
    price_cents: 49700,
    currency: "BRL",
    is_free: false,
    is_active: true,
    trial_days: 14,
    limits: { members: 10, organic_growth: true, organic_social_accounts: 3 },
    sort: 2,
  },
];

const CREDIT_GRANT_REASON = "Beta seed (mock billing)";

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

function arg(name) {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
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

  const { error: planError } = await supabase.from("plans").upsert(PLANS, { onConflict: "slug" });
  if (planError) throw new Error(`plans upsert failed: ${planError.message}`);
  console.log(`Upserted ${PLANS.length} plans: ${PLANS.map((p) => p.slug).join(", ")}`);

  const orgId = arg("org");
  if (!orgId) return;

  const targetSlug = arg("to") ?? "pro";
  const plan = PLANS.find((p) => p.slug === targetSlug);
  if (!plan) throw new Error(`unknown target plan: ${targetSlug}`);

  const { data: planRow, error: planRowError } = await supabase
    .from("plans")
    .select("id")
    .eq("slug", targetSlug)
    .single();
  if (planRowError) throw new Error(planRowError.message);

  const { data: live, error: liveError } = await supabase
    .from("subscriptions")
    .select("id, plan_id, status")
    .eq("org_id", orgId)
    .in("status", ["trialing", "active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (liveError) throw new Error(liveError.message);

  if (live?.plan_id === planRow.id) {
    console.log(`Org ${orgId} already on '${targetSlug}'.`);
  } else {
    if (live) {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("id", live.id);
      if (error) throw new Error(`cancel current subscription failed: ${error.message}`);
    }
    const { error } = await supabase.from("subscriptions").insert({
      org_id: orgId,
      plan_id: planRow.id,
      status: "active",
      period: plan.period,
    });
    if (error) throw new Error(`insert subscription failed: ${error.message}`);
    console.log(`Org ${orgId} moved to '${targetSlug}'.`);
  }

  const credits = Number(arg("credits") ?? 0);
  if (credits > 0) {
    const { data: existing, error: existingError } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("org_id", orgId)
      .eq("kind", "grant")
      .eq("description", CREDIT_GRANT_REASON)
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      console.log(`Credit grant already exists for org ${orgId} — skipped.`);
    } else {
      const { error } = await supabase
        .from("credit_transactions")
        .insert({ org_id: orgId, amount: credits, kind: "grant", description: CREDIT_GRANT_REASON });
      if (error) throw new Error(`credit grant failed: ${error.message}`);
      console.log(`Granted ${credits} credits to org ${orgId}.`);
    }
  }
}

main().catch((error) => {
  console.error(`\nFAILED: ${error.message}`);
  process.exit(1);
});
