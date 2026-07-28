/**
 * Tests for the Creative Test Plan's pure domain (docs/PRODUCT.md phase 8).
 *
 * Usage:  npm run test:creative-plan
 *
 * What must never regress silently:
 *   1. output sanitization — the engine's slugs become library tags and
 *      idempotency keys, so an invented slug or a duplicated key would corrupt
 *      the creative taxonomy or silently merge two hypotheses;
 *   2. the brief blocks — they carry the module's two hard invariants into the
 *      prompt (cross-network metrics never ranked; organic signal orders paid
 *      hypotheses, never predicts them).
 *
 * The repo has no test runner; this follows the established `tsx scripts/*.mts`
 * convention. No network, no database, no keys — safe to run anywhere.
 */
import process from "node:process";

import {
  creativeEvidenceBlock,
  planCreativesBlock,
  planOrganicBlock,
  type PlanCreativeRow,
} from "../apps/web/src/lib/creative-plan/brief";
import {
  type CreativePlanOutput,
  isCreativePlanOutput,
  sanitizeCreativePlan,
  sanitizeHypothesisKey,
} from "../apps/web/src/lib/creative-plan/schema";

let passes = 0;
let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const got = JSON.stringify(actual);
  const want = JSON.stringify(expected);
  if (got === want) {
    passes += 1;
  } else {
    failures += 1;
    console.error(`FAIL ${name}\n  expected ${want}\n  got      ${got}`);
  }
}

function checkTrue(name: string, condition: boolean) {
  check(name, condition, true);
}

/* ------------------------------ key sanitizer ----------------------------- */

check("key: accents and spaces to kebab", sanitizeHypothesisKey("Prova Antes/Depois — Reels!", 0), "prova-antes-depois-reels");
check("key: empty falls back to index", sanitizeHypothesisKey("", 2), "hipotese-3");
check("key: non-string falls back", sanitizeHypothesisKey(42, 0), "hipotese-1");
check("key: trims leading/trailing dashes", sanitizeHypothesisKey("--já--", 0), "ja");
checkTrue("key: caps at 64 chars", sanitizeHypothesisKey("a".repeat(200), 0).length <= 64);

/* ----------------------------- plan sanitizer ----------------------------- */

const hypothesis = (overrides: Partial<CreativePlanOutput["hypotheses"][number]> = {}) => ({
  key: "prova-social-reels",
  angle: "Prova social de alunos reais",
  hook: "3 alunos, 3 resultados, 15 segundos",
  format: "reels",
  proof_type: "depoimento",
  emotion: "confianca",
  funnel_stage: "prova",
  rationale: "O contexto lista depoimentos como prova disponível.",
  prompt_brief: "Escreva um roteiro de Reels…",
  content_count: 5,
  success_criterion: "Salvamentos acima da mediana dos seus Reels do período.",
  technical_basis: [],
  ...overrides,
});

const basePlan: CreativePlanOutput = {
  diagnosis: "Biblioteca vazia; o plano parte do contexto.",
  evidence: [{ statement: "Sem criativos cadastrados.", source: "product_context" }],
  hypotheses: [hypothesis()],
  volume_note: "Publicando 3 por semana, ~2 a 4 semanas.",
  transfer_caveat: "Sinal orgânico ordena hipóteses; não prevê o pago.",
  confidence: "media",
  insufficient_data: false,
  missing_data: "",
};

checkTrue("guard: base plan validates", isCreativePlanOutput(basePlan));
checkTrue("guard: rejects missing transfer_caveat", !isCreativePlanOutput({ ...basePlan, transfer_caveat: 7 }));
checkTrue("guard: rejects non-array hypotheses", !isCreativePlanOutput({ ...basePlan, hypotheses: "x" }));

{
  const dirty = sanitizeCreativePlan({
    ...basePlan,
    hypotheses: [
      hypothesis({ key: "Mesma Chave", format: "tiktok-dance", emotion: "raiva total", funnel_stage: "invented" }),
      hypothesis({ key: "mesma chave", content_count: 1 }),
      hypothesis({ key: "", proof_type: "unicorn" }),
    ],
  });
  check("sanitize: invented format falls back to outro", dirty.hypotheses[0].format, "outro");
  check("sanitize: invented emotion falls back to outro", dirty.hypotheses[0].emotion, "outro");
  check("sanitize: invented proof falls back to outro", dirty.hypotheses[2].proof_type, "outro");
  check("sanitize: invented funnel stage falls back to descoberta", dirty.hypotheses[0].funnel_stage, "descoberta");
  check("sanitize: content_count clamps to cohort floor", dirty.hypotheses[1].content_count, 5);
  checkTrue(
    "sanitize: duplicate keys are made unique",
    new Set(dirty.hypotheses.map((h) => h.key)).size === dirty.hypotheses.length,
  );
  check("sanitize: empty key gets index fallback", dirty.hypotheses[2].key, "hipotese-3");
}

{
  const many = sanitizeCreativePlan({
    ...basePlan,
    hypotheses: Array.from({ length: 9 }, (_, i) => hypothesis({ key: `h-${i}` })),
  });
  check("sanitize: caps at 5 hypotheses", many.hypotheses.length, 5);
}

/* ------------------------------ brief blocks ------------------------------ */

const creativeRow = (overrides: Partial<PlanCreativeRow> = {}): PlanCreativeRow => ({
  name: "Depoimento MedChina",
  status: "testing",
  source: "planned",
  format: "reels",
  angle: "prova social",
  hook: "3 alunos",
  proof_type: "depoimento",
  emotion: "confianca",
  funnel_stage: "prova",
  result_summary: null,
  organic_count: 0,
  ...overrides,
});

checkTrue("brief: empty library states VAZIA", planCreativesBlock([]).includes("VAZIA"));
checkTrue("brief: library lines carry tags", planCreativesBlock([creativeRow()]).includes("gancho: 3 alunos"));
checkTrue(
  "brief: organic absence is missing data, not absence of publishing",
  planOrganicBlock({ contentCount: 0, platforms: [], latestPublishedAt: null, hasReview: false, reviewInsufficientData: null }).includes("NÃO significa que o negócio não publica"),
);
checkTrue(
  "brief: organic presence forbids cross-network ranking",
  planOrganicBlock({ contentCount: 3, platforms: ["instagram"], latestPublishedAt: null, hasReview: false, reviewInsufficientData: null }).includes("NUNCA compare métricas de redes diferentes"),
);

{
  const block = creativeEvidenceBlock([
    creativeRow({ organic_count: 6, hook: "gancho-a" }),
    creativeRow({ organic_count: 2, hook: "gancho-b" }),
    creativeRow({ organic_count: 0, hook: "gancho-c" }),
  ]);
  checkTrue("evidence: counts published creatives", block.includes("2 de 3"));
  checkTrue("evidence: flags below-cohort volume", block.includes("volume abaixo do mínimo"));
  checkTrue("evidence: order-not-predict invariant present", block.includes("ORDENAR, NÃO PARA PREVER"));
  checkTrue("evidence: unpublished tag stays out", !block.includes("gancho-c"));
}

checkTrue(
  "evidence: zero published suggests organic test first",
  creativeEvidenceBlock([creativeRow()]).includes("teste orgânico"),
);

console.log(
  failures === 0 ? `\nALL PASS — ${passes} assertions.` : `\n${failures} FAILURE(S) out of ${passes + failures}.`,
);
process.exit(failures === 0 ? 0 : 1);
