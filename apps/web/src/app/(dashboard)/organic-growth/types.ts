export type OrganicPlatform = "instagram" | "tiktok" | "youtube" | "linkedin";
export type RecommendationFeedback = "useful" | "not_useful" | "incorrect";

export interface OrganicSetupInput {
  orgId: string;
  productId: string;
  platform: OrganicPlatform;
  accountName: string;
  accountHandle: string;
  objective: string;
  desiredAction: string;
  analysisWindowDays: number;
}

export interface OrganicImportInput {
  orgId: string;
  productId: string;
  socialAccountId: string;
  csv: string;
  fileName: string;
}

export interface OrganicClassificationInput {
  orgId: string;
  contentId: string;
  productId: string;
  correctedFromId?: string | null;
  funnelStage: string;
  strategicIntent: string;
  narrativeType: string;
  theme: string;
  hook: string;
  angle: string;
  promise: string;
  pain: string;
  desire: string;
  objection: string;
  proof: string;
  cta: string;
  audience: string;
  visualStyle: string;
  toneOfVoice: string;
}

export interface OrganicReviewRequest {
  orgId: string;
  productId: string;
  socialAccountId: string;
  periodStart: string;
  periodEnd: string;
}

export interface OrganicRecommendationRow {
  id: string;
  kind: string;
  diagnosis: string;
  context: Record<string, unknown>;
  hypothesis: string;
  recommended_action: string;
  priority: "critica" | "alta" | "media" | "baixa";
  estimated_effort: "baixo" | "medio" | "alto";
  expected_impact: "baixo" | "medio" | "alto";
  risk: string;
  confidence: "baixa" | "media" | "alta";
  success_criterion: string;
  next_review: string;
  status: string;
  rank: number;
  experiment_id?: string | null;
  evidence?: OrganicEvidenceRow[];
  feedback?: RecommendationFeedback | null;
}

export interface OrganicEvidenceRow {
  id?: string;
  kind: string;
  fact: string;
  content_id?: string | null;
  metric?: string | null;
  value?: Record<string, unknown> | number | string | null;
  observed_at?: string | null;
}

export interface OrganicReviewRow {
  id: string;
  product_id: string;
  social_account_id: string | null;
  period_start: string;
  period_end: string;
  status: string;
  summary: string | null;
  insufficient_data: boolean;
  missing_data: string[] | string | null;
  confidence: "baixa" | "media" | "alta" | null;
  data_quality: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  created_at: string;
}

export type OrganicActionResult = { ok: true } | { ok: false; code: string; details?: string };

export type OrganicIdResult = { ok: true; id: string } | { ok: false; code: string; details?: string };

export type OrganicImportResult =
  | { ok: true; id: string; imported: number; updated: number; rejected: number; errors: string[] }
  | { ok: false; code: string; details?: string; errors?: string[] };
