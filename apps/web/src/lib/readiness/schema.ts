/**
 * The readiness verdict format (docs/PRODUCT.md phase 7), as a JSON Schema.
 *
 * A readiness answer is not one diagnosis — it is a prioritized audit across
 * the acquisition structure. But it obeys the same law as every other output in
 * this product: no claim without an anchored source, no recommendation without
 * a success criterion, and "I cannot conclude" as a first-class answer.
 *
 * Deliberately NOT a proprietary 0–100 score: the verdict is a labelled
 * judgement plus a named blocker list, so the user can disagree with a specific
 * line instead of with a number they cannot inspect.
 */

import type { Confidence, DiagnosisEvidence, DiagnosisTechnicalBasis, EvidenceSource } from "@/lib/diagnosis/schema";

export type { Confidence, DiagnosisEvidence, DiagnosisTechnicalBasis, EvidenceSource };

/** Ready to spend / cheap wins first / do not spend yet. */
export type ReadinessVerdict = "pronto" | "quase" | "nao_pronto";

/** Mirrors the audited dimensions in docs/PRODUCT.md. */
export type ReadinessDimension = "oferta" | "pagina" | "checkout" | "mensuracao" | "funil" | "descoberta" | "midia";

export type ReadinessStatus = "ok" | "atencao" | "critico" | "sem_dados";
export type ReadinessLevel = "baixo" | "medio" | "alto";

export interface ReadinessFinding {
  dimension: ReadinessDimension;
  status: ReadinessStatus;
  finding: string;
  evidence: DiagnosisEvidence[];
  technical_basis: DiagnosisTechnicalBasis[];
  recommended_action: string;
  /** Cost to fix — cheap-and-decisive is what gets done first. */
  effort: ReadinessLevel;
  impact: ReadinessLevel;
  success_criterion: string;
  /**
   * Checklist item keys this finding is about, so "I already fixed this" can
   * tick exactly the right boxes instead of a whole dimension.
   *
   * OPTIONAL on purpose: verdicts generated before this field existed are still
   * valid and must keep rendering. Consumers go through `resolvableItems()`
   * (lib/readiness/checklist.ts), which validates the keys and falls back to
   * the dimension's group when the field is missing.
   */
  related_items?: string[];
}

export interface ReadinessOutput {
  verdict: ReadinessVerdict;
  summary: string;
  findings: ReadinessFinding[];
  /** Only what makes ad spend predictably wasted. Empty is a valid answer. */
  blocking: string[];
  confidence: Confidence;
  insufficient_data: boolean;
  missing_data: string;
}

export const READINESS_SCHEMA_NAME = "seenaly_readiness";

const EVIDENCE_SOURCES = ["product_context", "campaign_data", "meta_docs", "growth_playbook"];

export const READINESS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    verdict: {
      type: "string",
      enum: ["pronto", "quase", "nao_pronto"],
      description:
        "pronto = sem bloqueadores e dimensões críticas confirmadas; quase = sem bloqueadores mas há ganhos baratos antes; nao_pronto = existe bloqueador e gastar agora desperdiça orçamento.",
    },
    summary: {
      type: "string",
      description: "Duas a quatro frases: o estado da estrutura e o que fazer primeiro. Fale direto com o usuário.",
    },
    findings: {
      type: "array",
      description:
        "Uma finding por dimensão relevante, ORDENADAS por alavancagem real (o que devolve mais dinheiro primeiro). No máximo 7.",
      items: {
        type: "object",
        properties: {
          dimension: {
            type: "string",
            enum: ["oferta", "pagina", "checkout", "mensuracao", "funil", "descoberta", "midia"],
          },
          status: {
            type: "string",
            enum: ["ok", "atencao", "critico", "sem_dados"],
            description: "sem_dados quando o checklist e o contexto não permitem avaliar esta dimensão.",
          },
          finding: { type: "string", description: "O que está bom ou o que está faltando, concreto." },
          evidence: {
            type: "array",
            description: "Cada afirmação ancorada em uma fonte. Nunca vazio quando status ≠ sem_dados.",
            items: {
              type: "object",
              properties: {
                statement: { type: "string" },
                source: { type: "string", enum: EVIDENCE_SOURCES },
              },
              required: ["statement", "source"],
            },
          },
          technical_basis: {
            type: "array",
            description:
              "Princípio do playbook de growth ou regra oficial da Meta que sustenta a finding, citando o trecho como [n]. Vazio quando nenhum trecho recuperado for pertinente — nunca force uma citação.",
            items: {
              type: "object",
              properties: {
                rule: { type: "string" },
                citation: { type: "string" },
              },
              required: ["rule", "citation"],
            },
          },
          recommended_action: { type: "string", description: "O que fazer agora, específico e executável." },
          effort: { type: "string", enum: ["baixo", "medio", "alto"] },
          impact: { type: "string", enum: ["baixo", "medio", "alto"] },
          success_criterion: { type: "string", description: "Como saber, de forma verificável, que foi resolvido." },
          related_items: {
            type: "array",
            description:
              "Chaves EXATAS do checklist de prontidão que esta finding trata, para o usuário poder marcar 'já resolvi' e o sistema saber o que virou verdade. Use apenas chaves válidas (ex.: pixelInstalled, conversionEventTested, paymentPix, seoBasics). Omita quando a finding não corresponder a nenhum item do checklist (oferta e mídia não têm itens).",
            items: { type: "string" },
          },
        },
        required: [
          "dimension",
          "status",
          "finding",
          "evidence",
          "technical_basis",
          "recommended_action",
          "effort",
          "impact",
          "success_criterion",
        ],
      },
    },
    blocking: {
      type: "array",
      description:
        "SOMENTE o que torna o gasto em anúncio previsivelmente desperdiçado (não há como medir conversão, não há página, não há como receber pagamento, a economia não fecha). Lista vazia quando não houver nenhum — e nesse caso o verdict não pode ser nao_pronto.",
      items: { type: "string" },
    },
    confidence: { type: "string", enum: ["baixa", "media", "alta"] },
    insufficient_data: {
      type: "boolean",
      description: "true quando o contexto do produto é raso demais para avaliar a prontidão.",
    },
    missing_data: {
      type: "string",
      description:
        "O que preencher ou confirmar para o veredito ficar mais firme. Preencha mesmo quando insufficient_data for false. String vazia apenas se nada relevante faltar.",
    },
  },
  required: ["verdict", "summary", "findings", "blocking", "confidence", "insufficient_data", "missing_data"],
};

const VERDICTS: ReadinessVerdict[] = ["pronto", "quase", "nao_pronto"];
const DIMENSIONS: ReadinessDimension[] = ["oferta", "pagina", "checkout", "mensuracao", "funil", "descoberta", "midia"];
const STATUSES: ReadinessStatus[] = ["ok", "atencao", "critico", "sem_dados"];
const LEVELS: ReadinessLevel[] = ["baixo", "medio", "alto"];

function isFinding(value: unknown): value is ReadinessFinding {
  if (!value || typeof value !== "object") return false;
  const finding = value as Record<string, unknown>;
  return (
    DIMENSIONS.includes(finding.dimension as ReadinessDimension) &&
    STATUSES.includes(finding.status as ReadinessStatus) &&
    typeof finding.finding === "string" &&
    Array.isArray(finding.evidence) &&
    Array.isArray(finding.technical_basis) &&
    typeof finding.recommended_action === "string" &&
    LEVELS.includes(finding.effort as ReadinessLevel) &&
    LEVELS.includes(finding.impact as ReadinessLevel) &&
    typeof finding.success_criterion === "string"
  );
}

/** Defensive check: the provider claims schema conformance, we verify it. */
export function isReadinessOutput(value: unknown): value is ReadinessOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Record<string, unknown>;
  return (
    VERDICTS.includes(output.verdict as ReadinessVerdict) &&
    typeof output.summary === "string" &&
    Array.isArray(output.findings) &&
    output.findings.length > 0 &&
    output.findings.every(isFinding) &&
    Array.isArray(output.blocking) &&
    output.blocking.every((item) => typeof item === "string") &&
    (output.confidence === "baixa" || output.confidence === "media" || output.confidence === "alta") &&
    typeof output.insufficient_data === "boolean" &&
    typeof output.missing_data === "string"
  );
}

/**
 * The model can contradict itself: claim "nao_pronto" while listing no blocker,
 * or the reverse. The prompt forbids both, but a schema cannot express the
 * cross-field rule — so we reconcile instead of rejecting an otherwise useful
 * answer, always in the direction that does NOT invent urgency.
 */
export function reconcileVerdict(output: ReadinessOutput): ReadinessOutput {
  if (output.verdict === "nao_pronto" && output.blocking.length === 0) {
    return { ...output, verdict: "quase" };
  }
  if (output.verdict === "pronto" && output.blocking.length > 0) {
    return { ...output, verdict: "nao_pronto" };
  }
  return output;
}
