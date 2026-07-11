/**
 * The fixed answer format from docs/PRODUCT.md, expressed as a JSON Schema.
 *
 * This schema IS the "nothing generic" law: the model cannot return a
 * diagnosis without evidence anchored to a source, a technical basis citing
 * the retrieved Meta docs, a falsifiable success criterion and an honest
 * confidence level. `insufficient_data` makes "I cannot conclude yet" a
 * first-class, valid answer instead of an invented one.
 */

export type Confidence = "baixa" | "media" | "alta";

/** Where a claim is anchored — mirrors the trust tiers in docs/PRODUCT.md. */
export type EvidenceSource = "product_context" | "campaign_data" | "meta_docs" | "growth_playbook";

export interface DiagnosisEvidence {
  statement: string;
  source: EvidenceSource;
}

export interface DiagnosisTechnicalBasis {
  rule: string;
  /** Citation into the retrieved excerpts, e.g. "[3]". */
  citation: string;
}

export interface DiagnosisOutput {
  diagnosis: string;
  evidence: DiagnosisEvidence[];
  technical_basis: DiagnosisTechnicalBasis[];
  hypothesis: string;
  recommended_action: string;
  risk: string;
  confidence: Confidence;
  success_criterion: string;
  next_review: string;
  insufficient_data: boolean;
  /**
   * Data that would sharpen the diagnosis or separate competing hypotheses
   * (page vs checkout vs price). Independent of `insufficient_data`: a
   * confident diagnosis can still be unable to discriminate between causes.
   */
  missing_data: string;
}

export const DIAGNOSIS_SCHEMA_NAME = "seenaly_diagnosis";

export const DIAGNOSIS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    diagnosis: { type: "string", description: "O que está acontecendo, em uma a três frases." },
    evidence: {
      type: "array",
      description: "Cada afirmação ancorada em uma fonte. Nunca vazio.",
      items: {
        type: "object",
        properties: {
          statement: { type: "string" },
          source: { type: "string", enum: ["product_context", "campaign_data", "meta_docs", "growth_playbook"] },
        },
        required: ["statement", "source"],
      },
    },
    technical_basis: {
      type: "array",
      description:
        "Regras da documentação oficial da Meta ou princípios do playbook de growth que se aplicam, citando o trecho como [n].",
      items: {
        type: "object",
        properties: {
          rule: { type: "string" },
          citation: { type: "string" },
        },
        required: ["rule", "citation"],
      },
    },
    hypothesis: { type: "string", description: "Por que isso pode estar acontecendo." },
    recommended_action: { type: "string", description: "O que fazer agora, concreto e específico." },
    risk: { type: "string", description: "O que pode dar errado ao seguir a ação." },
    confidence: { type: "string", enum: ["baixa", "media", "alta"] },
    success_criterion: { type: "string", description: "Como saber, de forma mensurável, se funcionou." },
    next_review: { type: "string", description: "Quando reavaliar (janela de tempo ou volume de eventos)." },
    insufficient_data: {
      type: "boolean",
      description:
        "true quando não há base suficiente para concluir (fase de aprendizado, sem conta conectada, volume baixo).",
    },
    missing_data: {
      type: "string",
      description:
        "Quais dados faltam para concluir com mais firmeza OU para separar hipóteses concorrentes (ex.: página vs checkout vs preço). Preencha mesmo quando insufficient_data for false. String vazia apenas se nada relevante faltar.",
    },
  },
  required: [
    "diagnosis",
    "evidence",
    "technical_basis",
    "hypothesis",
    "recommended_action",
    "risk",
    "confidence",
    "success_criterion",
    "next_review",
    "insufficient_data",
    "missing_data",
  ],
};

/** Defensive check: the provider claims schema conformance, we verify it. */
export function isDiagnosisOutput(value: unknown): value is DiagnosisOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Record<string, unknown>;
  return (
    typeof output.diagnosis === "string" &&
    Array.isArray(output.evidence) &&
    Array.isArray(output.technical_basis) &&
    typeof output.hypothesis === "string" &&
    typeof output.recommended_action === "string" &&
    typeof output.risk === "string" &&
    (output.confidence === "baixa" || output.confidence === "media" || output.confidence === "alta") &&
    typeof output.success_criterion === "string" &&
    typeof output.next_review === "string" &&
    typeof output.insufficient_data === "boolean" &&
    typeof output.missing_data === "string"
  );
}
