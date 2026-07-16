import { FUNNEL_STAGE_LABELS, FUNNEL_STAGES, ORGANIC_TAXONOMY_VERSION, normalizeTaxonomyValue } from "./taxonomy";
import type {
  AgeBand,
  AnalysisConfidence,
  BuildOrganicReviewInput,
  ComparableCohort,
  ContentAnalysis,
  FunnelCoverage,
  FunnelStage,
  GenerateOrganicReviewOptions,
  OrganicAnalysisContext,
  OrganicAnalysisOptions,
  OrganicContentMetrics,
  OrganicContentRecord,
  OrganicDataQuality,
  OrganicGrowthReview,
  OrganicRecommendation,
  OrganicSufficiency,
  TransparentScore,
  TransparentScoreSignal,
} from "./types";

export const MINIMUM_ORGANIC_COHORT_SIZE = 5;

const commercialCoverageStages: readonly FunnelStage[] = ["demonstracao", "prova", "quebra_de_objecao", "oferta"];
const exposureMetrics = [
  "reach",
  "impressions",
  "views",
  "plays",
] as const satisfies readonly (keyof OrganicContentMetrics)[];

type NumericMetric = keyof OrganicContentMetrics;
type ExposureMetric = (typeof exposureMetrics)[number];

interface MetricSignalDefinition {
  key: string;
  label: string;
  metric: NumericMetric;
  weight: number;
  mode: "per_thousand" | "direct";
  missingLabel: string;
}

interface ScoredSignal {
  signal: TransparentScoreSignal;
  signalScore: number | null;
  missing?: string;
}

const intentSignalDefinitions: readonly MetricSignalDefinition[] = [
  {
    key: "link_click_rate",
    label: "Cliques por mil exposições",
    metric: "linkClicks",
    weight: 0.25,
    mode: "per_thousand",
    missingLabel: "cliques e seu denominador de exposição",
  },
  {
    key: "lead_rate",
    label: "Leads por mil exposições",
    metric: "leads",
    weight: 0.25,
    mode: "per_thousand",
    missingLabel: "leads e seu denominador de exposição",
  },
  {
    key: "assisted_conversion_rate",
    label: "Conversões assistidas por mil exposições",
    metric: "assistedConversions",
    weight: 0.2,
    mode: "per_thousand",
    missingLabel: "conversões assistidas e seu denominador de exposição",
  },
  {
    key: "profile_visit_rate",
    label: "Visitas ao perfil por mil exposições",
    metric: "profileVisits",
    weight: 0.1,
    mode: "per_thousand",
    missingLabel: "visitas ao perfil e seu denominador de exposição",
  },
  {
    key: "save_rate",
    label: "Salvamentos por mil exposições",
    metric: "saves",
    weight: 0.1,
    mode: "per_thousand",
    missingLabel: "salvamentos e seu denominador de exposição",
  },
  {
    key: "share_rate",
    label: "Compartilhamentos por mil exposições",
    metric: "shares",
    weight: 0.1,
    mode: "per_thousand",
    missingLabel: "compartilhamentos e seu denominador de exposição",
  },
];

const paidMetricSignalDefinitions: readonly MetricSignalDefinition[] = [
  {
    key: "watch_percentage",
    label: "Percentual médio assistido",
    metric: "averageWatchPercentage",
    weight: 0.2,
    mode: "direct",
    missingLabel: "percentual médio assistido",
  },
  {
    key: "share_rate",
    label: "Compartilhamentos por mil exposições",
    metric: "shares",
    weight: 0.15,
    mode: "per_thousand",
    missingLabel: "compartilhamentos e seu denominador de exposição",
  },
  {
    key: "save_rate",
    label: "Salvamentos por mil exposições",
    metric: "saves",
    weight: 0.1,
    mode: "per_thousand",
    missingLabel: "salvamentos e seu denominador de exposição",
  },
  {
    key: "comment_rate",
    label: "Comentários por mil exposições",
    metric: "comments",
    weight: 0.05,
    mode: "per_thousand",
    missingLabel: "comentários e seu denominador de exposição",
  },
  {
    key: "link_click_rate",
    label: "Cliques por mil exposições",
    metric: "linkClicks",
    weight: 0.1,
    mode: "per_thousand",
    missingLabel: "cliques e seu denominador de exposição",
  },
];

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function minimumCohortSize(value?: number): number {
  if (!Number.isFinite(value)) return MINIMUM_ORGANIC_COHORT_SIZE;
  return Math.max(MINIMUM_ORGANIC_COHORT_SIZE, Math.trunc(value as number));
}

function toDate(value: string | Date | undefined, fallback = new Date(0)): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : value ? new Date(value) : fallback;
  return Number.isFinite(date.getTime()) ? date : fallback;
}

function deterministicAnalysisDate(contents: readonly OrganicContentRecord[], explicit?: string | Date): Date {
  if (explicit !== undefined) return toDate(explicit);
  const timestamps = contents.flatMap((content) => {
    const value = Date.parse(content.observedAt ?? content.publishedAt);
    return Number.isFinite(value) ? [value] : [];
  });
  return new Date(timestamps.length > 0 ? Math.max(...timestamps) : 0);
}

function ageBandFor(content: OrganicContentRecord, now: Date): AgeBand | undefined {
  const published = new Date(content.publishedAt);
  if (!Number.isFinite(published.getTime())) return undefined;
  const ageDays = Math.max(0, Math.floor((now.getTime() - published.getTime()) / 86_400_000));
  if (ageDays <= 7) return "0_7d";
  if (ageDays <= 30) return "8_30d";
  if (ageDays <= 90) return "31_90d";
  if (ageDays <= 180) return "91_180d";
  return "181d_plus";
}

function safeMetric(content: OrganicContentRecord, metric: NumericMetric): number | undefined {
  const value = content.metrics[metric];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
    ? value
    : undefined;
}

function targetExposureMetric(content: OrganicContentRecord): ExposureMetric | undefined {
  return exposureMetrics.find((metric) => {
    const value = safeMetric(content, metric);
    return value !== undefined && value > 0;
  });
}

function percentileRank(value: number, values: readonly number[]): number {
  const lower = values.filter((candidate) => candidate < value).length;
  const equal = values.filter((candidate) => candidate === value).length;
  return round(((lower + equal * 0.5) / values.length) * 100, 1);
}

function normalizeFormat(value: string): string {
  return normalizeTaxonomyValue(value);
}

/**
 * Chooses a cohort in a strict hierarchy. Platform + format are mandatory.
 * Strategic intent and then age band are retained only while at least five
 * comparable contents remain. Therefore a cohort can never become cross-platform.
 */
export function selectComparableCohort(
  target: OrganicContentRecord,
  contents: readonly OrganicContentRecord[],
  options: OrganicAnalysisOptions = {},
): ComparableCohort {
  const now = deterministicAnalysisDate(contents, options.now);
  const minimum = minimumCohortSize(options.minimumCohortSize);
  const format = normalizeFormat(target.format);
  const account = target.account.trim().toLocaleLowerCase("pt-BR");
  let selected = contents.filter(
    (content) =>
      content.platform === target.platform &&
      content.account.trim().toLocaleLowerCase("pt-BR") === account &&
      normalizeFormat(content.format) === format,
  );
  const filters: ComparableCohort["filters"] = [
    { dimension: "platform", value: target.platform },
    { dimension: "account", value: account },
    { dimension: "format", value: format },
  ];

  if (target.strategicIntent) {
    const sameIntent = selected.filter((content) => content.strategicIntent === target.strategicIntent);
    if (sameIntent.length >= minimum) {
      selected = sameIntent;
      filters.push({ dimension: "strategic_intent", value: target.strategicIntent });
    }
  }

  const targetAgeBand = ageBandFor(target, now);
  if (targetAgeBand) {
    const sameAge = selected.filter((content) => ageBandFor(content, now) === targetAgeBand);
    if (sameAge.length >= minimum) {
      selected = sameAge;
      filters.push({ dimension: "age_band", value: targetAgeBand });
    }
  }

  return {
    platform: target.platform,
    account: target.account,
    format,
    ...(filters.some((filter) => filter.dimension === "strategic_intent") && target.strategicIntent
      ? { strategicIntent: target.strategicIntent }
      : {}),
    ...(filters.some((filter) => filter.dimension === "age_band") && targetAgeBand ? { ageBand: targetAgeBand } : {}),
    size: selected.length,
    minimumRequired: minimum,
    eligibleForPercentiles: selected.length >= minimum,
    filters,
    contentIds: selected.map((content) => content.id),
  };
}

function normalizedMetricValue(
  content: OrganicContentRecord,
  definition: MetricSignalDefinition,
  exposureMetric?: ExposureMetric,
): number | undefined {
  const numerator = safeMetric(content, definition.metric);
  if (numerator === undefined) return undefined;
  if (definition.mode === "direct") return numerator;
  if (!exposureMetric) return undefined;
  const denominator = safeMetric(content, exposureMetric);
  if (denominator === undefined || denominator <= 0) return undefined;
  return (numerator / denominator) * 1_000;
}

function metricSignal(
  target: OrganicContentRecord,
  cohortContents: readonly OrganicContentRecord[],
  cohort: ComparableCohort,
  definition: MetricSignalDefinition,
): ScoredSignal {
  const rawValue = safeMetric(target, definition.metric);
  const exposureMetric = definition.mode === "per_thousand" ? targetExposureMetric(target) : undefined;
  const normalizedValue = normalizedMetricValue(target, definition, exposureMetric);
  const comparableValues = cohortContents
    .map((content) => normalizedMetricValue(content, definition, exposureMetric))
    .filter((value): value is number => value !== undefined);

  if (rawValue === undefined) {
    return {
      signal: {
        key: definition.key,
        label: definition.label,
        available: false,
        rawValue: null,
        normalizedValue: null,
        percentile: null,
        comparableValues: comparableValues.length,
        weight: definition.weight,
        contribution: 0,
        basis: "Métrica ausente no conteúdo.",
      },
      signalScore: null,
      missing: definition.missingLabel,
    };
  }

  if (normalizedValue === undefined) {
    return {
      signal: {
        key: definition.key,
        label: definition.label,
        available: false,
        rawValue,
        normalizedValue: null,
        percentile: null,
        comparableValues: comparableValues.length,
        weight: definition.weight,
        contribution: 0,
        basis: "Não há denominador de exposição compatível para normalizar a métrica.",
      },
      signalScore: null,
      missing: definition.missingLabel,
    };
  }

  if (!cohort.eligibleForPercentiles || comparableValues.length < cohort.minimumRequired) {
    return {
      signal: {
        key: definition.key,
        label: definition.label,
        available: false,
        rawValue,
        normalizedValue: round(normalizedValue),
        ...(definition.mode === "per_thousand" ? { normalizedUnit: `por_mil_${exposureMetric}` } : {}),
        percentile: null,
        comparableValues: comparableValues.length,
        weight: definition.weight,
        contribution: 0,
        basis: `Percentil omitido: são necessários ${cohort.minimumRequired} valores comparáveis.`,
      },
      signalScore: null,
      missing: `${definition.missingLabel} em pelo menos ${cohort.minimumRequired} conteúdos comparáveis`,
    };
  }

  const percentile = percentileRank(normalizedValue, comparableValues);
  return {
    signal: {
      key: definition.key,
      label: definition.label,
      available: true,
      rawValue,
      normalizedValue: round(normalizedValue),
      ...(definition.mode === "per_thousand" ? { normalizedUnit: `por_mil_${exposureMetric}` } : {}),
      percentile,
      comparableValues: comparableValues.length,
      weight: definition.weight,
      contribution: 0,
      basis: `Percentil calculado somente dentro da coorte ${target.platform}/${target.account}/${normalizeFormat(target.format)}.`,
    },
    signalScore: percentile,
  };
}

function qualitativeSignal(key: string, label: string, value: string | undefined, weight: number): ScoredSignal {
  const present = Boolean(value?.trim());
  return {
    signal: {
      key,
      label,
      available: true,
      rawValue: present ? (value?.trim() ?? "presente") : "ausente",
      normalizedValue: present ? 1 : 0,
      percentile: null,
      comparableValues: 0,
      weight,
      contribution: 0,
      basis: present ? "Elemento identificado no conteúdo." : "Elemento não identificado no conteúdo.",
    },
    signalScore: present ? 100 : 0,
    ...(present ? {} : { missing: `${label.toLocaleLowerCase("pt-BR")} identificado` }),
  };
}

function scoreConfidence(cohort: ComparableCohort, availableWeight: number): AnalysisConfidence {
  if (cohort.size >= 10 && availableWeight >= 0.7) return "alta";
  if (cohort.eligibleForPercentiles && availableWeight >= 0.4) return "media";
  return "baixa";
}

function finalizeScore(
  kind: TransparentScore["kind"],
  cohort: ComparableCohort,
  scoredSignals: readonly ScoredSignal[],
  methodology: string,
): TransparentScore {
  const availableWeight = scoredSignals.reduce(
    (sum, item) => sum + (item.signalScore === null ? 0 : item.signal.weight),
    0,
  );
  const weightedTotal = scoredSignals.reduce(
    (sum, item) => sum + (item.signalScore === null ? 0 : item.signalScore * item.signal.weight),
    0,
  );
  const score = availableWeight > 0 ? round(weightedTotal / availableWeight, 1) : null;
  const signals = scoredSignals.map(({ signal, signalScore }) => ({
    ...signal,
    contribution:
      score !== null && signalScore !== null ? round((signalScore * signal.weight) / availableWeight, 1) : 0,
  }));

  return {
    kind,
    score,
    confidence: scoreConfidence(cohort, availableWeight),
    cohort,
    signals,
    availableWeight: round(availableWeight, 2),
    missing: [...new Set(scoredSignals.flatMap((item) => (item.missing ? [item.missing] : [])))],
    methodology,
  };
}

function membersOfCohort(cohort: ComparableCohort, contents: readonly OrganicContentRecord[]): OrganicContentRecord[] {
  const ids = new Set(cohort.contentIds);
  return contents.filter((content) => ids.has(content.id));
}

export function calculateContentIntentScore(
  target: OrganicContentRecord,
  contents: readonly OrganicContentRecord[],
  options: OrganicAnalysisOptions = {},
): TransparentScore {
  const cohort = selectComparableCohort(target, contents, options);
  const members = membersOfCohort(cohort, contents);
  const signals = intentSignalDefinitions.map((definition) => metricSignal(target, members, cohort, definition));
  return finalizeScore(
    "content_intent",
    cohort,
    signals,
    "Média ponderada de percentis relativos à própria conta. Cada taxa usa o mesmo denominador de exposição do conteúdo-alvo e exige ao menos cinco valores na mesma plataforma, conta e formato.",
  );
}

export function calculatePaidRepurposeScore(
  target: OrganicContentRecord,
  contents: readonly OrganicContentRecord[],
  options: OrganicAnalysisOptions = {},
): TransparentScore {
  const cohort = selectComparableCohort(target, contents, options);
  const members = membersOfCohort(cohort, contents);
  const signals: ScoredSignal[] = [
    ...paidMetricSignalDefinitions.map((definition) => metricSignal(target, members, cohort, definition)),
    qualitativeSignal("hook_present", "Gancho", target.hook, 0.15),
    qualitativeSignal("promise_present", "Promessa", target.promise, 0.1),
    qualitativeSignal("cta_present", "CTA", target.cta, 0.05),
    qualitativeSignal("proof_present", "Prova", target.proof, 0.1),
  ];
  return finalizeScore(
    "paid_repurpose",
    cohort,
    signals,
    "Combina sinais de desempenho normalizados na própria coorte (60% do peso possível) com presença transparente de gancho, promessa, CTA e prova (40%). Não estima causalidade nem performance futura.",
  );
}

export function calculateFunnelCoverage(contents: readonly OrganicContentRecord[]): FunnelCoverage {
  const counts = new Map<FunnelStage, number>(FUNNEL_STAGES.map((stage) => [stage, 0]));
  for (const content of contents) {
    if (content.funnelStage) counts.set(content.funnelStage, (counts.get(content.funnelStage) ?? 0) + 1);
  }
  const classifiedContents = contents.filter((content) => content.funnelStage).length;
  const stages = FUNNEL_STAGES.map((stage) => ({
    stage,
    count: counts.get(stage) ?? 0,
    share: classifiedContents > 0 ? round((counts.get(stage) ?? 0) / classifiedContents, 4) : 0,
  }));
  const maximum = Math.max(0, ...stages.map((stage) => stage.count));

  return {
    totalContents: contents.length,
    classifiedContents,
    unclassifiedContents: contents.length - classifiedContents,
    stages,
    gaps: commercialCoverageStages.filter((stage) => (counts.get(stage) ?? 0) === 0),
    dominantStage: maximum > 0 ? (stages.find((stage) => stage.count === maximum)?.stage ?? null) : null,
  };
}

function periodTimestamp(value: string, end: boolean): number | null {
  const normalized = /^\d{4}-\d{2}-\d{2}$/u.test(value) ? `${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z` : value;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function scopedContents(
  context: OrganicAnalysisContext,
  contents: readonly OrganicContentRecord[],
): OrganicContentRecord[] {
  const start = periodTimestamp(context.period.start, false);
  const end = periodTimestamp(context.period.end, true);
  const account = context.account.trim().toLocaleLowerCase("pt-BR");
  return contents.filter((content) => {
    const publishedAt = Date.parse(content.publishedAt);
    return (
      content.platform === context.platform &&
      content.account.trim().toLocaleLowerCase("pt-BR") === account &&
      Number.isFinite(publishedAt) &&
      start !== null &&
      end !== null &&
      publishedAt >= start &&
      publishedAt <= end
    );
  });
}

function hasPerformanceSignals(content: OrganicContentRecord): boolean {
  const exposure = targetExposureMetric(content);
  if (!exposure) return false;
  return [
    "comments",
    "shares",
    "saves",
    "profileVisits",
    "linkClicks",
    "leads",
    "assistedConversions",
    "averageWatchPercentage",
  ].some((metric) => safeMetric(content, metric as NumericMetric) !== undefined);
}

function validContextFields(context: OrganicAnalysisContext): { valid: number; total: number; issues: string[] } {
  const issues: string[] = [];
  const values = [
    [context.productName, "nome do produto"],
    [context.audience, "público"],
    [context.objective, "objetivo"],
    [context.offerOrDesiredAction, "oferta ou ação desejada"],
    [context.account, "conta de origem"],
  ] as const;
  let valid = 0;
  for (const [value, label] of values) {
    if (value.trim()) valid += 1;
    else issues.push(`Contexto ausente: ${label}.`);
  }
  const start = periodTimestamp(context.period.start, false);
  const end = periodTimestamp(context.period.end, true);
  if (start !== null && end !== null && start <= end) valid += 1;
  else issues.push("Período de análise inválido ou invertido.");
  return { valid, total: values.length + 1, issues };
}

export function assessOrganicDataQuality(
  context: OrganicAnalysisContext,
  contents: readonly OrganicContentRecord[],
  options: OrganicAnalysisOptions = {},
): OrganicDataQuality {
  const scoped = scopedContents(context, contents);
  const contextFields = validContextFields(context);
  const contextCompleteness = contextFields.valid / contextFields.total;
  const classificationCoverage =
    scoped.length > 0
      ? scoped.filter((content) => content.funnelStage && content.strategicIntent && content.narrativeType).length /
        scoped.length
      : 0;
  const performanceMetricCoverage =
    scoped.length > 0 ? scoped.filter((content) => hasPerformanceSignals(content)).length / scoped.length : 0;
  const comparableCohortCoverage =
    scoped.length > 0
      ? scoped.filter((content) => selectComparableCohort(content, scoped, options).eligibleForPercentiles).length /
        scoped.length
      : 0;
  const issues = [...contextFields.issues];
  if (scoped.length === 0) issues.push("Nenhum conteúdo pertence à plataforma, conta e período selecionados.");
  if (classificationCoverage < 0.6)
    issues.push("Menos de 60% dos conteúdos possuem classificação estratégica completa.");
  if (performanceMetricCoverage < 0.4)
    issues.push("Menos de 40% dos conteúdos possuem exposição e sinal de desempenho utilizável.");
  if (comparableCohortCoverage < 0.6)
    issues.push("Menos de 60% dos conteúdos pertencem a uma coorte com cinco comparáveis.");
  if (new Set(scoped.map((content) => content.id)).size !== scoped.length)
    issues.push("Há IDs de conteúdo duplicados na análise.");
  if (contents.length > scoped.length) {
    issues.push(`${contents.length - scoped.length} conteúdo(s) foram excluídos por plataforma, conta ou período.`);
  }

  return {
    score: round(
      (contextCompleteness * 0.25 +
        classificationCoverage * 0.25 +
        performanceMetricCoverage * 0.3 +
        comparableCohortCoverage * 0.2) *
        100,
      0,
    ),
    contextCompleteness: round(contextCompleteness, 3),
    classificationCoverage: round(classificationCoverage, 3),
    performanceMetricCoverage: round(performanceMetricCoverage, 3),
    comparableCohortCoverage: round(comparableCohortCoverage, 3),
    scopedContents: scoped.length,
    excludedContents: contents.length - scoped.length,
    issues,
  };
}

export function assessOrganicSufficiency(
  context: OrganicAnalysisContext,
  contents: readonly OrganicContentRecord[],
  options: OrganicAnalysisOptions = {},
): OrganicSufficiency {
  const quality = assessOrganicDataQuality(context, contents, options);
  const scoped = scopedContents(context, contents);
  const minimum = minimumCohortSize(options.minimumCohortSize);
  const hasIntentEvidence = scoped.some((content) => {
    const score = calculateContentIntentScore(content, scoped, options);
    return score.score !== null && score.confidence !== "baixa";
  });
  const reasons: string[] = [];
  const missingData: string[] = [];

  if (quality.contextCompleteness < 1) {
    reasons.push("O contexto mínimo do produto está incompleto.");
    missingData.push("Complete produto, público, objetivo, oferta/ação, conta e período.");
  }
  if (scoped.length < minimum) {
    reasons.push(`Há ${scoped.length} conteúdos no escopo; são necessários ao menos ${minimum}.`);
    missingData.push(`Importe ao menos ${minimum - scoped.length} conteúdo(s) adicional(is) da mesma conta e período.`);
  }
  if (quality.classificationCoverage < 0.6) {
    reasons.push("A cobertura de classificação estratégica é inferior a 60%.");
    missingData.push("Revise etapa do funil, intenção e tipo narrativo dos conteúdos ainda não classificados.");
  }
  if (quality.performanceMetricCoverage < 0.4) {
    reasons.push("A cobertura de métricas de desempenho é inferior a 40%.");
    missingData.push(
      "Inclua exposição e ao menos um sinal entre compartilhamentos, salvamentos, visitas, cliques ou conversões.",
    );
  }
  if (quality.comparableCohortCoverage < 0.6) {
    reasons.push("Não há cobertura suficiente de coortes comparáveis.");
    missingData.push(`Reúna pelo menos ${minimum} conteúdos da mesma plataforma e formato.`);
  }
  if (!hasIntentEvidence) {
    reasons.push("Nenhum Content Intent Score possui sinais comparáveis suficientes.");
    missingData.push(
      "Preencha a mesma métrica e o mesmo denominador de exposição em ao menos cinco conteúdos comparáveis.",
    );
  }

  const recommendationsApproved = reasons.length === 0;
  return {
    status: recommendationsApproved ? "suficiente" : scoped.length > 0 ? "parcial" : "insuficiente",
    recommendationsApproved,
    reasons: recommendationsApproved
      ? ["Contexto, volume, classificações, métricas e coortes sustentam recomendações comparativas."]
      : reasons,
    missingData: [...new Set(missingData)],
  };
}

function recommendationContext(context: OrganicAnalysisContext, funnelStage?: FunnelStage) {
  return {
    product: context.productName,
    audience: context.audience,
    platform: context.platform,
    account: context.account,
    ...(funnelStage ? { funnelStage } : {}),
    period: context.period,
  };
}

function stableIdPart(value: string): string {
  return normalizeTaxonomyValue(value).slice(0, 72) || "conteudo";
}

function bestSignal(score: TransparentScore): TransparentScoreSignal | undefined {
  return [...score.signals]
    .filter((signal) => signal.available && signal.percentile !== null)
    .sort((left, right) => right.contribution - left.contribution || left.key.localeCompare(right.key))[0];
}

function funnelRecommendation(context: OrganicAnalysisContext, coverage: FunnelCoverage): OrganicRecommendation | null {
  const gap = coverage.gaps[0];
  if (!gap || coverage.classifiedContents === 0) return null;
  const label = FUNNEL_STAGE_LABELS[gap];
  return {
    id: `organic-funnel-${gap}`,
    diagnosis: `Há uma lacuna de ${label.toLocaleLowerCase("pt-BR")} no período analisado.`,
    evidence: [
      {
        statement: `Nenhum dos ${coverage.classifiedContents} conteúdos classificados foi marcado como ${label}.`,
        source: "organic_content",
        kind: "fato",
        metric: "content_count",
        value: 0,
        period: context.period,
      },
    ],
    context: recommendationContext(context, gap),
    technical_basis: [],
    hypothesis: `A ausência de ${label.toLocaleLowerCase("pt-BR")} pode deixar o público sem a evidência necessária para avançar no funil.`,
    recommended_action: `Produza dois conteúdos de ${label.toLocaleLowerCase("pt-BR")} para ${context.productName}, cada um tratando uma objeção ou evidência diferente e mantendo um único CTA para ${context.offerOrDesiredAction}.`,
    priority: gap === "prova" || gap === "oferta" ? "alta" : "media",
    estimated_effort: "medio",
    expected_impact: "medio",
    risk: "A lacuna observada é descritiva; novos conteúdos podem não alterar intenção se a oferta ou a mensagem estiverem desalinhadas.",
    confidence: coverage.classifiedContents >= 10 ? "alta" : "media",
    success_criterion:
      "Publicar dois conteúdos da etapa ausente e obter, em sete dias, ao menos um sinal de intenção mensurável por peça.",
    next_review: "Após sete dias ou quando os dois novos conteúdos tiverem métricas comparáveis.",
    sources: [
      { type: "organic_content", reference: `funnel-coverage:${context.period.start}:${context.period.end}` },
      { type: "taxonomy", reference: "funnel_stage", version: ORGANIC_TAXONOMY_VERSION },
    ],
    insufficient_data: false,
    missing_data: "Dados de conversão assistida aumentariam a confiança sobre o impacto comercial da lacuna.",
  };
}

function intentRecommendation(
  context: OrganicAnalysisContext,
  content: OrganicContentRecord,
  score: TransparentScore,
): OrganicRecommendation | null {
  const signal = bestSignal(score);
  if (score.score === null || score.confidence === "baixa" || !signal || signal.percentile === null) return null;
  return {
    id: `organic-intent-${stableIdPart(content.id)}`,
    diagnosis: `O conteúdo ${content.title || content.externalId || content.id} apresenta o maior sinal relativo de intenção comercial da amostra.`,
    evidence: [
      {
        statement: `Content Intent ${score.score}/100, com ${signal.label.toLocaleLowerCase("pt-BR")} no percentil ${signal.percentile} de ${signal.comparableValues} conteúdos comparáveis.`,
        source: "organic_metrics",
        kind: "fato",
        contentId: content.id,
        metric: signal.key,
        value: signal.normalizedValue ?? signal.rawValue ?? "disponível",
        period: context.period,
      },
    ],
    context: recommendationContext(context, content.funnelStage),
    technical_basis: [],
    hypothesis:
      "O elemento de mensagem preservado nessa peça pode estar associado a uma resposta comercial acima da coorte.",
    recommended_action: `Crie uma variação do conteúdo ${content.title || content.externalId || content.id}, preservando ${content.hook ? `o gancho “${content.hook}”` : "a mensagem central"} e alterando apenas o CTA para ${context.offerOrDesiredAction}.`,
    priority: score.score >= 75 ? "alta" : "media",
    estimated_effort: "baixo",
    expected_impact: "medio",
    risk: "O score é relativo e correlacional; mudar mais de uma variável impediria atribuir o resultado à mensagem preservada.",
    confidence: score.confidence,
    success_criterion: `A variação deve alcançar ao menos o percentil ${Math.max(50, Math.round(signal.percentile))} em ${signal.label.toLocaleLowerCase("pt-BR")} na mesma coorte.`,
    next_review: "Após sete dias ou ao atingir cinco conteúdos comparáveis na nova janela.",
    sources: [
      { type: "organic_metrics", reference: `content:${content.id}` },
      { type: "product_context", reference: context.productId ?? context.productName },
    ],
    insufficient_data: false,
    missing_data: score.missing.slice(0, 3).join("; "),
  };
}

function paidRecommendation(
  context: OrganicAnalysisContext,
  content: OrganicContentRecord,
  score: TransparentScore,
): OrganicRecommendation | null {
  const performanceSignals = score.signals.filter((signal) => signal.percentile !== null);
  const signal = bestSignal(score);
  if (
    score.score === null ||
    score.score < 60 ||
    score.confidence === "baixa" ||
    performanceSignals.length < 2 ||
    !signal ||
    signal.percentile === null
  ) {
    return null;
  }

  return {
    id: `organic-paid-${stableIdPart(content.id)}`,
    diagnosis: `O conteúdo ${content.title || content.externalId || content.id} tem sinais suficientes para um experimento de reaproveitamento pago, não para uma promessa de performance.`,
    evidence: [
      {
        statement: `Paid Repurpose ${score.score}/100; ${signal.label.toLocaleLowerCase("pt-BR")} está no percentil ${signal.percentile} da coorte e há ${performanceSignals.length} sinais de performance comparáveis.`,
        source: "organic_metrics",
        kind: "fato",
        contentId: content.id,
        metric: signal.key,
        value: signal.normalizedValue ?? signal.rawValue ?? "disponível",
        period: context.period,
      },
    ],
    context: recommendationContext(context, content.funnelStage),
    technical_basis: [],
    hypothesis:
      "O gancho e a resposta relativa observada no orgânico podem fornecer uma base mais informada para um teste pago.",
    recommended_action: `Registre um experimento pago com a peça ${content.title || content.externalId || content.id}; preserve gancho e promessa e teste uma única variação de CTA vinculada a ${context.offerOrDesiredAction}.`,
    priority: score.score >= 75 ? "alta" : "media",
    estimated_effort: "medio",
    expected_impact: "medio",
    risk: "Distribuição orgânica e paga têm mecanismos diferentes; o resultado orgânico não garante resposta no leilão.",
    confidence: score.confidence,
    success_criterion:
      "Comparar a variação com um controle sob o mesmo público, orçamento e janela, usando a métrica principal definida no experimento.",
    next_review: "Após o volume mínimo definido no experimento pago, nunca apenas por visualizações iniciais.",
    sources: [
      { type: "organic_metrics", reference: `content:${content.id}` },
      { type: "product_context", reference: context.productId ?? context.productName },
    ],
    insufficient_data: false,
    missing_data: score.missing.slice(0, 3).join("; "),
  };
}

function buildReviewInternal(
  context: OrganicAnalysisContext,
  contents: readonly OrganicContentRecord[],
  options: GenerateOrganicReviewOptions = {},
): OrganicGrowthReview {
  if (contents.length > 500) throw new RangeError("Organic Growth aceita no máximo 500 conteúdos por Review.");
  const endOfPeriod = periodTimestamp(context.period.end, true);
  const generatedAt =
    options.generatedAt !== undefined
      ? toDate(options.generatedAt)
      : new Date(endOfPeriod ?? deterministicAnalysisDate(contents).getTime());
  const analysisOptions: OrganicAnalysisOptions = {
    now: generatedAt,
    ...(options.minimumCohortSize ? { minimumCohortSize: options.minimumCohortSize } : {}),
  };
  const scoped = scopedContents(context, contents);
  const dataQuality = assessOrganicDataQuality(context, contents, analysisOptions);
  const sufficiency = assessOrganicSufficiency(context, contents, analysisOptions);
  const funnelCoverage = calculateFunnelCoverage(scoped);
  const contentAnalyses: ContentAnalysis[] = scoped.map((content) => {
    const cohort = selectComparableCohort(content, scoped, analysisOptions);
    return {
      contentId: content.id,
      cohort,
      contentIntent: calculateContentIntentScore(content, scoped, analysisOptions),
      paidRepurpose: calculatePaidRepurposeScore(content, scoped, analysisOptions),
    };
  });

  let recommendations: OrganicRecommendation[] = [];
  if (sufficiency.recommendationsApproved) {
    const byIntent = [...contentAnalyses]
      .filter((analysis) => analysis.contentIntent.score !== null)
      .sort(
        (left, right) =>
          (right.contentIntent.score ?? -1) - (left.contentIntent.score ?? -1) ||
          left.contentId.localeCompare(right.contentId),
      )[0];
    const byPaid = [...contentAnalyses]
      .filter((analysis) => analysis.paidRepurpose.score !== null)
      .sort(
        (left, right) =>
          (right.paidRepurpose.score ?? -1) - (left.paidRepurpose.score ?? -1) ||
          left.contentId.localeCompare(right.contentId),
      )[0];
    const byId = new Map(scoped.map((content) => [content.id, content]));
    const candidates = [
      funnelRecommendation(context, funnelCoverage),
      byIntent && byId.get(byIntent.contentId)
        ? intentRecommendation(context, byId.get(byIntent.contentId) as OrganicContentRecord, byIntent.contentIntent)
        : null,
      byPaid && byId.get(byPaid.contentId)
        ? paidRecommendation(context, byId.get(byPaid.contentId) as OrganicContentRecord, byPaid.paidRepurpose)
        : null,
    ];
    recommendations = candidates.filter((candidate): candidate is OrganicRecommendation => candidate !== null);
  }

  const summary = sufficiency.recommendationsApproved
    ? `Foram analisados ${scoped.length} conteúdos de ${context.account}. O Review aprovou ${recommendations.length} recomendação(ões) sustentada(s) pela amostra; a ausência de três indica que não havia três oportunidades distintas com evidência suficiente.`
    : `Foram encontrados ${scoped.length} conteúdos no escopo, mas os dados ainda não sustentam recomendações aprovadas. O Review preserva as lacunas e o próximo passo de coleta sem fabricar conclusões.`;

  return {
    version: "organic-growth-review/v1",
    generatedAt: generatedAt.toISOString(),
    context,
    summary,
    dataQuality,
    sufficiency,
    funnelCoverage,
    contentAnalyses,
    recommendations,
    approvedRecommendationCount: recommendations.length,
    insufficient_data: !sufficiency.recommendationsApproved,
    missing_data: sufficiency.missingData,
  };
}

export function buildOrganicReview(input: BuildOrganicReviewInput): OrganicGrowthReview;
export function buildOrganicReview(
  context: OrganicAnalysisContext,
  contents: readonly OrganicContentRecord[],
  options?: GenerateOrganicReviewOptions,
): OrganicGrowthReview;
export function buildOrganicReview(
  contents: readonly OrganicContentRecord[],
  context: OrganicAnalysisContext,
  options?: GenerateOrganicReviewOptions,
): OrganicGrowthReview;
export function buildOrganicReview(
  first: BuildOrganicReviewInput | OrganicAnalysisContext | readonly OrganicContentRecord[],
  second?: OrganicAnalysisContext | readonly OrganicContentRecord[],
  third: GenerateOrganicReviewOptions = {},
): OrganicGrowthReview {
  if (Array.isArray(first)) {
    if (!second || Array.isArray(second)) throw new TypeError("Informe o contexto após a lista de conteúdos.");
    return buildReviewInternal(second as OrganicAnalysisContext, first, third);
  }
  if ("context" in first && "contents" in first) {
    return buildReviewInternal(first.context, first.contents, {
      ...(first.generatedAt ? { generatedAt: first.generatedAt } : {}),
      ...(first.minimumCohortSize ? { minimumCohortSize: first.minimumCohortSize } : {}),
    });
  }
  if (!second || !Array.isArray(second)) throw new TypeError("Informe os conteúdos após o contexto.");
  return buildReviewInternal(first as OrganicAnalysisContext, second, third);
}

export const generateOrganicGrowthReview = buildOrganicReview;
