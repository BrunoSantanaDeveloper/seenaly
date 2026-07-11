/** Shared shapes for the experiment memory (docs/PRODUCT.md — key differentiator). */

export type ExperimentStatus = "planned" | "running" | "concluded" | "abandoned";

export interface ExperimentInput {
  id?: string;
  orgId: string;
  productId: string;
  diagnosisId: string | null;

  title: string;
  status: ExperimentStatus;

  hypothesis: string;
  changeMade: string;
  reason: string;
  periodStart: string; // "" or YYYY-MM-DD
  periodEnd: string;
  budget: number | null;
  primaryMetric: string;
  secondaryMetric: string;
  result: string;
  conclusion: string;
  nextStep: string;
  notes: string;

  creativeIds: string[];
}

export interface ExperimentWithId extends Omit<ExperimentInput, "orgId" | "productId"> {
  id: string;
  orgId: string;
  productId: string;
}
