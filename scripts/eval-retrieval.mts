/**
 * Measures readiness retrieval against a versioned golden set.
 *
 * Usage:  npm run eval:retrieval [-- --baseline] [-- --verbose]
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
 * — it embeds real queries and hits the real index, so it is NOT part of
 * `npm test` and never runs in CI. It is the gate you run deliberately, before
 * and after any change to chunking, the retrieval plan or the embedding model.
 *
 * WHY DOCUMENT-LEVEL RECALL, and only recall:
 * The consumer of this retrieval is not a human reading result #1 — it is an
 * LLM reading all of them to write a verdict. Rank inside the returned set
 * barely matters, which is what makes MRR close to useless here; what decides
 * the verdict is whether the one document that carries the rule made it into
 * the set at all. A dimension whose document is missing gets argued from
 * whatever else came back, and that is exactly the generic recommendation the
 * product forbids.
 *
 * `--baseline` additionally runs the pre-decomposition query (one string of
 * twelve subjects, 4 chunks per collection) so the two can be compared on the
 * same index, in the same minute. Without that comparison, "decomposition
 * helped" is a belief.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

import { planRetrievalPlan, planRetrievalQuery } from "../apps/web/src/lib/creative-plan/brief";
import { readinessRetrievalPlan } from "../apps/web/src/lib/readiness/brief";
import { embedQueries, resolveCollectionIds, searchKnowledge } from "@flyee/knowledge";

const ROOT = path.resolve(import.meta.dirname, "..");
const VERBOSE = process.argv.includes("--verbose");
const WITH_BASELINE = process.argv.includes("--baseline");

/** The query as it existed before decomposition — kept ONLY as the control. */
const LEGACY_QUERY =
  "prontidão antes de investir em tráfego pago: instalação de pixel e API de Conversões, escolha do evento de otimização, fase de aprendizado e volume mínimo, fricção de checkout e abandono, meios de pagamento PIX, equação de valor e garantia, prova social, message match entre anúncio e página, velocidade e experiência mobile, captura de contato e régua de follow-up, fundamentos de SEO e descoberta orgânica, criativos mínimos por ângulo antes da primeira campanha";

interface GoldenEntry {
  expect: string[];
  coverage?: string;
  note?: string;
}

async function loadEnv(file: string) {
  const raw = await readFile(file, "utf8").catch(() => "");
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

const pct = (found: number, total: number) => (total === 0 ? "—" : `${((found / total) * 100).toFixed(0)}%`);

async function main() {
  await loadEnv(path.join(ROOT, "apps", "web", ".env"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !process.env.GEMINI_API_KEY) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY (apps/web/.env).");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const golden = JSON.parse(
    await readFile(path.join(ROOT, "scripts", "knowledge-eval", "readiness-golden-set.json"), "utf8"),
  ) as {
    corpus_protocol: string;
    queries: Record<string, GoldenEntry>;
    creative_plan_queries?: Record<string, GoldenEntry>;
  };

  // A score against a corpus that is not the one the golden set was written
  // for is a number without meaning — say so instead of printing it.
  const { data: docs } = await supabase.from("knowledge_documents").select("status, metadata");
  const protocols = new Set(
    (docs ?? []).map((d) => (d.metadata as { embedding_protocol?: string })?.embedding_protocol),
  );
  const notReady = (docs ?? []).filter((d) => d.status !== "ready").length;
  console.log(`Corpus: ${docs?.length ?? 0} documentos, ${notReady} fora da busca.`);
  console.log(`Protocolo esperado: ${golden.corpus_protocol} | encontrado: ${[...protocols].join(", ")}`);
  if (notReady > 0) console.log("! Documentos fora da busca distorcem o recall para baixo.");
  if (!protocols.has(golden.corpus_protocol)) {
    console.log("! O corpus não está no protocolo do gabarito — reingira ou atualize o gabarito.");
  }

  const [metaIds, playbookIds] = await Promise.all([
    resolveCollectionIds(supabase, ["meta-ads-docs"]),
    resolveCollectionIds(supabase, ["growth-playbook"]),
  ]);

  // Slug lives in metadata; the search returns `source`, so map ids to slugs.
  const { data: allDocs } = await supabase.from("knowledge_documents").select("id, title, metadata");
  const slugById = new Map(
    (allDocs ?? []).map((d) => [d.id as string, (d.metadata as { slug?: string })?.slug ?? "?"]),
  );

  const plan = readinessRetrievalPlan(true, "trial_first");
  const vectors = await embedQueries(plan.map((query) => query.text));

  console.log("\n=== PLANO DECOMPOSTO (uma pergunta por dimensão) ===\n");
  let totalExpected = 0;
  let totalFound = 0;
  const misses: string[] = [];

  for (const [index, query] of plan.entries()) {
    const entry = golden.queries[query.key];
    if (!entry) {
      console.log(`${query.key.padEnd(24)} — sem gabarito, ignorado`);
      continue;
    }
    const results = (
      await Promise.all(
        [[metaIds, query.meta] as const, [playbookIds, query.playbook] as const]
          .filter(([ids, count]) => ids.length > 0 && count > 0)
          .map(([collectionIds, matchCount]) =>
            searchKnowledge(supabase, vectors[index], {
              collectionIds,
              matchCount,
              maxPerDocument: 1,
              // Mirrors production. `EVAL_DENSE_ONLY=1` drops the lexical half
              // so the two can be compared on the same index, same minute.
              ...(process.env.EVAL_DENSE_ONLY ? {} : { queryText: query.text }),
            }),
          ),
      )
    ).flat();

    const retrieved = new Set(results.map((r) => slugById.get(r.document_id) ?? "?"));
    const found = entry.expect.filter((slug) => retrieved.has(slug));
    const missing = entry.expect.filter((slug) => !retrieved.has(slug));
    totalExpected += entry.expect.length;
    totalFound += found.length;
    for (const slug of missing) misses.push(`${query.key} → ${slug}`);

    const label = entry.coverage === "none" ? "sem cobertura no corpus" : `${found.length}/${entry.expect.length}`;
    console.log(
      `${query.key.padEnd(24)} recall ${String(label).padEnd(24)} ${pct(found.length, entry.expect.length).padStart(4)}  (${results.length} trechos, ${retrieved.size} docs)`,
    );
    if (missing.length > 0) console.log(`${" ".repeat(26)}FALTOU: ${missing.join(", ")}`);
    if (entry.coverage === "none" && results.length > 0) {
      console.log(`${" ".repeat(26)}! recuperou ${results.length} trecho(s) numa dimensão sem cobertura — é ruído`);
    }
    if (VERBOSE) for (const slug of retrieved) console.log(`${" ".repeat(28)}· ${slug}`);
  }

  console.log(`\nRECALL GLOBAL: ${totalFound}/${totalExpected} = ${pct(totalFound, totalExpected)}`);

  if (WITH_BASELINE) {
    console.log("\n=== BASELINE (query única de 12 assuntos, 4+4) ===\n");
    const [legacyVector] = await embedQueries([LEGACY_QUERY]);
    const legacyResults = (
      await Promise.all(
        [metaIds, playbookIds].map((collectionIds) =>
          searchKnowledge(supabase, legacyVector, { collectionIds, matchCount: 4, maxPerDocument: 2 }),
        ),
      )
    ).flat();
    const legacyRetrieved = new Set(legacyResults.map((r) => slugById.get(r.document_id) ?? "?"));

    let legacyFound = 0;
    for (const [key, entry] of Object.entries(golden.queries)) {
      const found = entry.expect.filter((slug) => legacyRetrieved.has(slug));
      legacyFound += found.length;
      if (entry.expect.length > 0) {
        console.log(
          `${key.padEnd(24)} recall ${String(`${found.length}/${entry.expect.length}`).padEnd(24)} ${pct(found.length, entry.expect.length).padStart(4)}`,
        );
      }
    }
    console.log(`\nRECALL GLOBAL (baseline): ${legacyFound}/${totalExpected} = ${pct(legacyFound, totalExpected)}`);
    console.log(`Trechos: ${legacyResults.length} (baseline) vs decomposto acima.`);
    console.log(
      `\nDELTA: ${totalFound - legacyFound >= 0 ? "+" : ""}${totalFound - legacyFound} documentos-alvo recuperados.`,
    );
  }

  // ---- Creative Test Plan (fase 8), same gate, same corpus ----
  const planGolden = golden.creative_plan_queries ?? {};
  const planQueries = planRetrievalPlan();
  const planVectors = await embedQueries(planQueries.map((query) => query.text));

  console.log("\n=== PLANO DE TESTE CRIATIVO ===\n");
  let planExpected = 0;
  let planFound = 0;
  for (const [index, query] of planQueries.entries()) {
    const entry = planGolden[query.key];
    if (!entry) continue;
    const results = (
      await Promise.all(
        [[metaIds, query.meta] as const, [playbookIds, query.playbook] as const]
          .filter(([ids, count]) => ids.length > 0 && count > 0)
          .map(([collectionIds, matchCount]) =>
            searchKnowledge(supabase, planVectors[index], {
              collectionIds,
              matchCount,
              maxPerDocument: 1,
              ...(process.env.EVAL_DENSE_ONLY ? {} : { queryText: query.text }),
            }),
          ),
      )
    ).flat();
    const retrieved = new Set(results.map((r) => slugById.get(r.document_id) ?? "?"));
    const found = entry.expect.filter((slug) => retrieved.has(slug));
    const missing = entry.expect.filter((slug) => !retrieved.has(slug));
    planExpected += entry.expect.length;
    planFound += found.length;
    console.log(
      `${query.key.padEnd(24)} recall ${String(`${found.length}/${entry.expect.length}`).padEnd(24)} ${pct(found.length, entry.expect.length).padStart(4)}  (${results.length} trechos, ${retrieved.size} docs)`,
    );
    if (missing.length > 0) console.log(`${" ".repeat(26)}FALTOU: ${missing.join(", ")}`);
    if (VERBOSE) for (const slug of retrieved) console.log(`${" ".repeat(28)}· ${slug}`);
  }
  console.log(`\nRECALL GLOBAL (plano criativo): ${planFound}/${planExpected} = ${pct(planFound, planExpected)}`);

  if (WITH_BASELINE) {
    // The single five-subject string this plan replaced.
    const [legacyVector] = await embedQueries([planRetrievalQuery()]);
    const legacyResults = (
      await Promise.all(
        [metaIds, playbookIds].map((collectionIds) =>
          searchKnowledge(supabase, legacyVector, { collectionIds, matchCount: 4 }),
        ),
      )
    ).flat();
    const legacyRetrieved = new Set(legacyResults.map((r) => slugById.get(r.document_id) ?? "?"));
    let legacyFound = 0;
    for (const entry of Object.values(planGolden)) {
      if (!entry?.expect) continue;
      legacyFound += entry.expect.filter((slug) => legacyRetrieved.has(slug)).length;
    }
    console.log(
      `RECALL (plano criativo, query única): ${legacyFound}/${planExpected} = ${pct(legacyFound, planExpected)}`,
    );
  }

  if (misses.length > 0) {
    console.log("\nDocumentos-alvo não recuperados:");
    for (const miss of misses) console.log(`  - ${miss}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
