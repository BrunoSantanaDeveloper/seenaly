import assert from "node:assert/strict";
import test from "node:test";

import {
  CLASSIFICATION_JSON_SCHEMA,
  ORGANIC_CSV_MAX_ROWS,
  ORGANIC_FUNNEL_STAGES,
  ORGANIC_NARRATIVE_TYPES,
  ORGANIC_STRATEGIC_INTENTS,
  buildOrganicReview,
  calculateContentIntentScore,
  isOrganicClassificationOutput,
  parseOrganicCsv,
  selectComparableCohort,
} from "../src/index";
import type { OrganicAnalysisContext, OrganicContentRecord, SocialPlatform } from "../src/types";

function content(index: number, overrides: Partial<OrganicContentRecord> = {}): OrganicContentRecord {
  return {
    id: `content-${index}`,
    externalId: `external-${index}`,
    publishedAt: `2026-07-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
    platform: "instagram",
    account: "@seenaly",
    format: "reel",
    caption: `Conteúdo ${index}`,
    funnelStage: "educacao",
    strategicIntent: "gerar_clique",
    narrativeType: "tutorial",
    theme: "Aquisição",
    hook: `Gancho ${index}`,
    promise: "Melhorar a decisão",
    cta: "Conheça a oferta",
    proof: "Demonstração observável",
    classificationConfidence: "alta",
    source: "manual",
    metrics: {
      reach: 1_000,
      shares: index + 1,
      saves: index + 2,
      comments: index + 1,
      profileVisits: index + 3,
      linkClicks: index + 4,
      leads: index + 1,
      assistedConversions: index,
      averageWatchPercentage: 45 + index * 5,
    },
    ...overrides,
  };
}

const context: OrganicAnalysisContext = {
  productId: "product-1",
  productName: "Seenaly",
  audience: "Fundadores de produtos digitais",
  objective: "Gerar demanda qualificada",
  offerOrDesiredAction: "Solicitar uma demonstração",
  platform: "instagram",
  account: "@seenaly",
  period: { start: "2026-07-01", end: "2026-07-31" },
};

test("expõe a taxonomia canônica e valida a saída de classificação", () => {
  assert.equal(ORGANIC_FUNNEL_STAGES.length, 14);
  assert.equal(ORGANIC_STRATEGIC_INTENTS.length, 12);
  assert.equal(ORGANIC_NARRATIVE_TYPES.length, 16);
  assert.equal(CLASSIFICATION_JSON_SCHEMA.type, "object");

  const valid = {
    funnel_stage: "prova",
    strategic_intent: "gerar_confianca",
    narrative_type: "estudo_de_caso",
    theme: "Resultados",
    hook: "Veja o antes e depois",
    angle: "Antes e depois",
    promise: "Decidir melhor",
    pain: "Decisões sem evidência",
    desire: "Crescer com clareza",
    objection: "Complexidade da análise",
    cta: "Conheça",
    proof: "Estudo de caso",
    audience: "Gestores de growth",
    visual_style: "",
    tone_of_voice: "Didático",
    confidence: "alta",
  };
  assert.equal(isOrganicClassificationOutput(valid), true);
  assert.equal(isOrganicClassificationOutput({ ...valid, funnel_stage: "topo" }), false);
  assert.equal(isOrganicClassificationOutput({ ...valid, extra: true }), false);
});

test("parseia CSV com vírgulas, aspas escapadas e quebras de linha", () => {
  const csv = [
    "external_content_id,url,published_at,platform,account,format,caption,reach,shares",
    'post-1,https://example.com/p/1,2026-07-01,instagram,@seenaly,reel,"Gancho, com ""aspas""\ne continuação",1000,21',
  ].join("\n");

  const result = parseOrganicCsv(csv);
  assert.equal(result.fatal, false);
  assert.equal(result.errors.length, 0);
  assert.equal(result.acceptedRows, 1);
  assert.match(result.rows[0].caption ?? "", /aspas/);
  assert.equal(result.rows[0].metrics.shares, 21);
});

test("detecta ponto e vírgula e aceita decimal com vírgula", () => {
  const csv = [
    "external_content_id;published_at;platform;account;format;caption;reach;average_watch_percentage",
    "post-1;2026-07-01;instagram;@seenaly;reel;Demonstração;1200;62,5",
  ].join("\r\n");
  const result = parseOrganicCsv(csv);
  assert.equal(result.delimiter, ";");
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0].metrics.averageWatchPercentage, 62.5);
});

test("rejeita somente linhas inválidas e nunca aceita números inseguros", () => {
  const csv = [
    "external_content_id,published_at,platform,account,format,caption,reach",
    "ok,2026-07-01,instagram,@seenaly,reel,Válido,1000",
    "negative,2026-07-02,instagram,@seenaly,reel,Inválido,-1",
    "unsafe,2026-07-03,instagram,@seenaly,reel,Inválido,9007199254740992",
    "ok,2026-07-01,instagram,@seenaly,reel,Duplicado,1000",
  ].join("\n");
  const result = parseOrganicCsv(csv);
  assert.equal(result.fatal, false);
  assert.equal(result.acceptedRows, 1);
  assert.equal(result.rejectedRows, 3);
  assert.ok(result.errors.some((error) => error.code === "invalid_number"));
  assert.ok(result.errors.some((error) => error.code === "unsafe_number"));
  assert.ok(result.errors.some((error) => error.code === "duplicate_content"));
});

test("limite de linhas é fatal e nunca retorna importação parcial", () => {
  const header = "external_content_id,published_at,platform,account,format,caption";
  const rows = Array.from(
    { length: ORGANIC_CSV_MAX_ROWS + 1 },
    (_, index) => `id-${index},2026-07-01,instagram,@seenaly,reel,Conteúdo ${index}`,
  );
  const result = parseOrganicCsv([header, ...rows].join("\n"));
  assert.equal(result.fatal, true);
  assert.equal(result.rows.length, 0);
  assert.equal(result.errors[0].code, "too_many_rows");

  const customLimit = parseOrganicCsv([header, ...rows.slice(0, 3)].join("\n"), { maxRows: 2 });
  assert.equal(customLimit.fatal, true);
  assert.equal(customLimit.rows.length, 0);
});

test("coortes nunca cruzam plataformas e preferem intenção e idade quando há amostra", () => {
  const instagram = Array.from({ length: 5 }, (_, index) => content(index));
  const otherIntent = Array.from({ length: 5 }, (_, index) =>
    content(index + 10, { strategicIntent: "gerar_alcance" }),
  );
  const tiktok = Array.from({ length: 8 }, (_, index) => content(index + 20, { platform: "tiktok" as SocialPlatform }));
  const otherAccount = Array.from({ length: 8 }, (_, index) => content(index + 30, { account: "@outra-conta" }));
  const cohort = selectComparableCohort(instagram[0], [...instagram, ...otherIntent, ...tiktok, ...otherAccount], {
    now: "2026-07-15T00:00:00.000Z",
  });

  assert.equal(cohort.platform, "instagram");
  assert.equal(cohort.account, "@seenaly");
  assert.equal(cohort.size, 5);
  assert.equal(cohort.strategicIntent, "gerar_clique");
  assert.equal(cohort.ageBand, "8_30d");
  assert.ok(cohort.contentIds.every((id) => instagram.some((item) => item.id === id)));
});

test("não calcula percentis com menos de cinco valores comparáveis", () => {
  const contents = Array.from({ length: 4 }, (_, index) => content(index));
  const score = calculateContentIntentScore(contents[0], contents, {
    now: "2026-07-15T00:00:00.000Z",
  });
  assert.equal(score.score, null);
  assert.equal(score.confidence, "baixa");
  assert.ok(score.signals.every((signal) => signal.percentile === null));
  assert.ok(score.missing.length > 0);
});

test("Review insuficiente aprova zero recomendações e lista dados ausentes", () => {
  const review = buildOrganicReview({
    context,
    contents: [content(0, { metrics: {} }), content(1, { metrics: {} })],
    generatedAt: "2026-07-15T00:00:00.000Z",
  });
  assert.equal(review.insufficient_data, true);
  assert.equal(review.sufficiency.recommendationsApproved, false);
  assert.equal(review.recommendations.length, 0);
  assert.ok(review.missing_data.length > 0);
});

test("Review suficiente é determinístico, transparente e mantém no máximo oportunidades reais", () => {
  const contents = Array.from({ length: 6 }, (_, index) => content(index));
  const input = {
    context,
    contents,
    generatedAt: "2026-07-15T00:00:00.000Z",
  } as const;
  const first = buildOrganicReview(input);
  const second = buildOrganicReview(input);

  assert.deepEqual(first, second);
  assert.equal(first.insufficient_data, false);
  assert.equal(first.sufficiency.recommendationsApproved, true);
  assert.equal(first.recommendations.length, 3);
  assert.ok(first.recommendations.every((recommendation) => recommendation.evidence.length > 0));
  assert.ok(first.recommendations.every((recommendation) => recommendation.insufficient_data === false));
  assert.ok(first.contentAnalyses.every((analysis) => analysis.cohort.platform === context.platform));
});
