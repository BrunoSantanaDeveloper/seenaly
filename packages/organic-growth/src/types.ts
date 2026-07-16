export type SocialPlatform = "instagram" | "tiktok" | "youtube" | "linkedin";

export type FunnelStage =
  | "descoberta"
  | "conscientizacao_do_problema"
  | "educacao"
  | "consideracao"
  | "demonstracao"
  | "comparacao"
  | "prova"
  | "quebra_de_objecao"
  | "oferta"
  | "urgencia"
  | "conversao"
  | "retencao"
  | "indicacao"
  | "comunidade";

export type StrategicIntent =
  | "gerar_alcance"
  | "gerar_autoridade"
  | "gerar_confianca"
  | "gerar_conversa"
  | "gerar_salvamento"
  | "gerar_compartilhamento"
  | "gerar_visita_ao_perfil"
  | "gerar_clique"
  | "gerar_lead"
  | "gerar_venda"
  | "recuperar_demanda"
  | "apoiar_remarketing";

export type NarrativeType =
  | "historia"
  | "tutorial"
  | "demonstracao"
  | "bastidores"
  | "opiniao"
  | "lista"
  | "comparacao"
  | "estudo_de_caso"
  | "depoimento"
  | "transformacao"
  | "erro_comum"
  | "mito"
  | "tendencia"
  | "resposta_a_comentario"
  | "conteudo_de_fundador"
  | "oferta_direta";

export type OrganicDataSource = "manual" | "connector";
export type AnalysisConfidence = "baixa" | "media" | "alta";
export type RecommendationPriority = "critica" | "alta" | "media" | "baixa";
export type RecommendationEffort = "baixo" | "medio" | "alto";
export type RecommendationImpact = "baixo" | "medio" | "alto";
export type AgeBand = "0_7d" | "8_30d" | "31_90d" | "91_180d" | "181d_plus";

export interface OrganicContentMetrics {
  impressions?: number;
  reach?: number;
  views?: number;
  plays?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  profileVisits?: number;
  linkClicks?: number;
  leads?: number;
  assistedConversions?: number;
  averageWatchPercentage?: number;
  averageWatchTimeSeconds?: number;
}

export interface OrganicContentRecord {
  /** Stable within its workspace. The CSV parser prefers external ID, then URL. */
  id: string;
  rowNumber?: number;
  externalId?: string;
  url?: string;
  publishedAt: string;
  observedAt?: string;
  platform: SocialPlatform;
  account: string;
  format: string;
  title?: string;
  caption?: string;
  durationSeconds?: number;
  funnelStage?: FunnelStage;
  strategicIntent?: StrategicIntent;
  narrativeType?: NarrativeType;
  theme?: string;
  hook?: string;
  promise?: string;
  cta?: string;
  proof?: string;
  classificationConfidence?: AnalysisConfidence;
  source: OrganicDataSource;
  metrics: OrganicContentMetrics;
}

export interface OrganicClassificationOutput {
  funnel_stage: FunnelStage;
  strategic_intent: StrategicIntent;
  narrative_type: NarrativeType;
  theme: string;
  hook: string;
  angle: string;
  promise: string;
  pain: string;
  desire: string;
  objection: string;
  cta: string;
  proof: string;
  audience: string;
  visual_style: string;
  tone_of_voice: string;
  confidence: AnalysisConfidence;
}

export type CsvDelimiter = "," | ";";

export type CsvIssueCode =
  | "empty_file"
  | "invalid_csv"
  | "too_many_rows"
  | "duplicate_header"
  | "missing_header"
  | "unknown_header"
  | "too_many_columns"
  | "missing_value"
  | "invalid_platform"
  | "invalid_date"
  | "invalid_url"
  | "invalid_number"
  | "unsafe_number"
  | "invalid_taxonomy"
  | "duplicate_content";

export interface CsvIssue {
  row: number;
  column?: string;
  code: CsvIssueCode;
  message: string;
  value?: string;
}

export interface ParseConciergeCsvOptions {
  delimiter?: CsvDelimiter;
  defaultPlatform?: SocialPlatform;
  defaultAccount?: string;
  source?: OrganicDataSource;
  /** Per-import limit, capped by the package's absolute limit of 500 rows. */
  maxRows?: number;
}

export interface ConciergeCsvResult {
  delimiter: CsvDelimiter;
  headers: string[];
  rows: OrganicContentRecord[];
  errors: CsvIssue[];
  warnings: CsvIssue[];
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  fatal: boolean;
}

export interface OrganicAnalysisPeriod {
  start: string;
  end: string;
}

export interface OrganicAnalysisContext {
  productId?: string;
  productName: string;
  audience: string;
  objective: string;
  offerOrDesiredAction: string;
  platform: SocialPlatform;
  account: string;
  period: OrganicAnalysisPeriod;
}

export interface CohortFilter {
  dimension: "platform" | "account" | "format" | "strategic_intent" | "age_band";
  value: string;
}

export interface ComparableCohort {
  platform: SocialPlatform;
  account: string;
  format: string;
  strategicIntent?: StrategicIntent;
  ageBand?: AgeBand;
  size: number;
  minimumRequired: number;
  eligibleForPercentiles: boolean;
  filters: CohortFilter[];
  contentIds: string[];
}

export interface TransparentScoreSignal {
  key: string;
  label: string;
  available: boolean;
  rawValue: number | string | null;
  normalizedValue: number | null;
  normalizedUnit?: string;
  percentile: number | null;
  comparableValues: number;
  weight: number;
  /** Points in the final 0–100 score; all contributions sum to score. */
  contribution: number;
  basis: string;
}

export interface TransparentScore {
  kind: "content_intent" | "paid_repurpose";
  score: number | null;
  confidence: AnalysisConfidence;
  cohort: ComparableCohort;
  signals: TransparentScoreSignal[];
  availableWeight: number;
  missing: string[];
  methodology: string;
}

export interface ContentAnalysis {
  contentId: string;
  cohort: ComparableCohort;
  contentIntent: TransparentScore;
  paidRepurpose: TransparentScore;
}

export interface FunnelStageCoverage {
  stage: FunnelStage;
  count: number;
  share: number;
}

export interface FunnelCoverage {
  totalContents: number;
  classifiedContents: number;
  unclassifiedContents: number;
  stages: FunnelStageCoverage[];
  gaps: FunnelStage[];
  dominantStage: FunnelStage | null;
}

export interface OrganicDataQuality {
  score: number;
  contextCompleteness: number;
  classificationCoverage: number;
  performanceMetricCoverage: number;
  comparableCohortCoverage: number;
  scopedContents: number;
  excludedContents: number;
  issues: string[];
}

export type SufficiencyStatus = "insuficiente" | "parcial" | "suficiente";

export interface OrganicSufficiency {
  status: SufficiencyStatus;
  recommendationsApproved: boolean;
  reasons: string[];
  missingData: string[];
}

export type RecommendationEvidenceSource =
  | "product_context"
  | "organic_content"
  | "organic_metrics"
  | "experiment_data"
  | "platform_docs"
  | "growth_playbook";

export interface OrganicRecommendationEvidence {
  statement: string;
  source: RecommendationEvidenceSource;
  kind: "fato" | "inferencia";
  contentId?: string;
  metric?: string;
  value?: number | string;
  period?: OrganicAnalysisPeriod;
}

export interface OrganicRecommendationContext {
  product: string;
  audience: string;
  platform: SocialPlatform;
  account: string;
  funnelStage?: FunnelStage;
  period: OrganicAnalysisPeriod;
}

export interface OrganicTechnicalBasis {
  rule: string;
  citation: string;
}

export interface OrganicRecommendationSource {
  type: RecommendationEvidenceSource | "taxonomy";
  reference: string;
  version?: string;
}

export interface OrganicRecommendation {
  id: string;
  diagnosis: string;
  evidence: OrganicRecommendationEvidence[];
  context: OrganicRecommendationContext;
  technical_basis: OrganicTechnicalBasis[];
  hypothesis: string;
  recommended_action: string;
  priority: RecommendationPriority;
  estimated_effort: RecommendationEffort;
  expected_impact: RecommendationImpact;
  risk: string;
  confidence: AnalysisConfidence;
  success_criterion: string;
  next_review: string;
  sources: OrganicRecommendationSource[];
  insufficient_data: false;
  missing_data: string;
}

export interface GenerateOrganicReviewOptions {
  generatedAt?: string | Date;
  minimumCohortSize?: number;
}

export interface OrganicAnalysisOptions {
  now?: string | Date;
  minimumCohortSize?: number;
}

export interface BuildOrganicReviewInput extends GenerateOrganicReviewOptions {
  context: OrganicAnalysisContext;
  contents: readonly OrganicContentRecord[];
}

export interface OrganicGrowthReview {
  version: "organic-growth-review/v1";
  generatedAt: string;
  context: OrganicAnalysisContext;
  summary: string;
  dataQuality: OrganicDataQuality;
  sufficiency: OrganicSufficiency;
  funnelCoverage: FunnelCoverage;
  contentAnalyses: ContentAnalysis[];
  recommendations: OrganicRecommendation[];
  approvedRecommendationCount: number;
  insufficient_data: boolean;
  missing_data: string[];
}
