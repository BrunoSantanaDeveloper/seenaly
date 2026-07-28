/**
 * The Creative Test Plan format (docs/PRODUCT.md phase 8), as a JSON Schema.
 *
 * A plan is not a list of content ideas — it is a set of FALSIFIABLE
 * hypotheses about why a creative would convert this audience, each cheap to
 * test organically before any paid spend. It obeys the same law as every other
 * engine output: no claim without an anchored source, no hypothesis without a
 * success criterion, and "I cannot conclude" as a first-class answer.
 *
 * Two invariants are structural here, not stylistic:
 *  - the transfer caveat is a REQUIRED field — organic signal prioritizes
 *    hypotheses for the paid test, it never predicts the paid result;
 *  - every taxonomy value is a canonical slug, sanitized against the same
 *    vocabulary the creative library stores — model output is never trusted.
 */

// Relative imports on purpose: `scripts/test-creative-plan.mts` (tsx, no path
// alias) imports this module directly, like the readiness test suite does.
import { CREATIVE_EMOTIONS, CREATIVE_FORMATS, CREATIVE_FUNNEL_STAGES, PROOF_TYPES } from "../creative-taxonomy";
import type { Confidence, DiagnosisEvidence, DiagnosisTechnicalBasis, EvidenceSource } from "../diagnosis/schema";

import { MINIMUM_ORGANIC_COHORT_SIZE } from "@flyee/organic-growth";

export type { Confidence, DiagnosisEvidence, DiagnosisTechnicalBasis, EvidenceSource };

export interface CreativePlanHypothesis {
  /** Stable ascii-kebab slug — the idempotency key for materialization. */
  key: string;
  /** Short, product-specific free text (same shape the library stores). */
  angle: string;
  hook: string;
  /** Canonical taxonomy slugs — sanitized, never free text. */
  format: string;
  proof_type: string;
  emotion: string;
  funnel_stage: string;
  /** Why THIS hypothesis for THIS product, anchored in context + playbook. */
  rationale: string;
  /** Copiable prompt for an external AI tool. Never real-person likeness. */
  prompt_brief: string;
  /** Pieces to publish before a cohort read is possible (≥ cohort minimum). */
  content_count: number;
  /** Relative signal within the user's own account — never cross-network. */
  success_criterion: string;
  technical_basis: DiagnosisTechnicalBasis[];
}

export interface CreativePlanOutput {
  diagnosis: string;
  evidence: DiagnosisEvidence[];
  hypotheses: CreativePlanHypothesis[];
  /** The conditional math: pace assumption → reading window as a RANGE. */
  volume_note: string;
  /** Organic signal orders paid hypotheses; it never predicts paid results. */
  transfer_caveat: string;
  confidence: Confidence;
  insufficient_data: boolean;
  missing_data: string;
}

export const CREATIVE_PLAN_SCHEMA_NAME = "seenaly_creative_plan";

const EVIDENCE_SOURCES = ["product_context", "campaign_data", "meta_docs", "growth_playbook"];

export const CREATIVE_PLAN_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    diagnosis: {
      type: "string",
      description:
        "Duas a quatro frases: que evidência criativa este produto já tem e que lacuna o plano cobre. Fale direto com o usuário.",
    },
    evidence: {
      type: "array",
      description: "Cada afirmação ancorada em uma fonte. Nunca vazio.",
      items: {
        type: "object",
        properties: {
          statement: { type: "string" },
          source: { type: "string", enum: EVIDENCE_SOURCES },
        },
        required: ["statement", "source"],
      },
    },
    hypotheses: {
      type: "array",
      description:
        "3 a 5 hipóteses falsificáveis, ordenadas pela mais promissora primeiro. MENOS (ou nenhuma) quando o contexto não sustentar — nunca invente para cumprir contagem.",
      items: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description: "Slug estável ascii minúsculo com hífens, único no plano. Ex.: prova-antes-depois-reels.",
          },
          angle: { type: "string", description: "O ângulo da mensagem, específico deste produto." },
          hook: {
            type: "string",
            description: "O gancho de abertura, concreto — o que prende nos 2 primeiros segundos.",
          },
          format: { type: "string", enum: [...CREATIVE_FORMATS] },
          proof_type: { type: "string", enum: [...PROOF_TYPES] },
          emotion: { type: "string", enum: [...CREATIVE_EMOTIONS] },
          funnel_stage: { type: "string", enum: [...CREATIVE_FUNNEL_STAGES] },
          rationale: {
            type: "string",
            description:
              "Por que esta hipótese para este produto: promessa, objeção ou prova do contexto + trechos citados como [n] quando pertinentes.",
          },
          prompt_brief: {
            type: "string",
            description:
              "Prompt pronto em português para ferramenta de IA externa, carregando promessa, dor, objeção e formato. PROIBIDO sugerir imagem/nome/semelhança de pessoas reais.",
          },
          content_count: {
            type: "integer",
            minimum: MINIMUM_ORGANIC_COHORT_SIZE,
            maximum: 20,
            description: `Conteúdos a publicar desta hipótese para haver leitura de coorte (mínimo ${MINIMUM_ORGANIC_COHORT_SIZE}).`,
          },
          success_criterion: {
            type: "string",
            description:
              "Sinal RELATIVO dentro da própria conta (mediana dos próprios conteúdos equivalentes). Nunca benchmark absoluto, nunca comparação entre redes.",
          },
          technical_basis: {
            type: "array",
            description:
              "Princípio do playbook ou regra oficial que sustenta a hipótese, citando [n]. Vazio quando nenhum trecho for pertinente — nunca force.",
            items: {
              type: "object",
              properties: {
                rule: { type: "string" },
                citation: { type: "string" },
              },
              required: ["rule", "citation"],
            },
          },
        },
        required: [
          "key",
          "angle",
          "hook",
          "format",
          "proof_type",
          "emotion",
          "funnel_stage",
          "rationale",
          "prompt_brief",
          "content_count",
          "success_criterion",
          "technical_basis",
        ],
      },
    },
    volume_note: {
      type: "string",
      description:
        "A conta condicional e honesta: com o total de conteúdos e um ritmo suposto de publicação, a janela de leitura em FAIXA (ex.: 'publicando 3 por semana, ~4 a 6 semanas'). Declare a suposição. Nunca prometa prazo.",
    },
    transfer_caveat: {
      type: "string",
      description:
        "Reafirme com suas palavras: sinal orgânico (audiência morna) ordena as hipóteses para o teste pago (audiência fria); não prevê o resultado pago.",
    },
    confidence: { type: "string", enum: ["baixa", "media", "alta"] },
    insufficient_data: {
      type: "boolean",
      description: "true quando o contexto do produto é raso demais para sustentar hipóteses específicas.",
    },
    missing_data: {
      type: "string",
      description:
        "O que preencher ou importar para um plano mais firme (contexto do produto, conteúdo orgânico ainda não importado). Preencha mesmo quando insufficient_data for false. Vazio apenas se nada faltar.",
    },
  },
  required: [
    "diagnosis",
    "evidence",
    "hypotheses",
    "volume_note",
    "transfer_caveat",
    "confidence",
    "insufficient_data",
    "missing_data",
  ],
};

/* -------------------------------------------------------------------------- */
/*  Validation + sanitization — model output is never trusted                  */
/* -------------------------------------------------------------------------- */

const formatSet = new Set<string>(CREATIVE_FORMATS);
const proofSet = new Set<string>(PROOF_TYPES);
const emotionSet = new Set<string>(CREATIVE_EMOTIONS);
const funnelSet = new Set<string>(CREATIVE_FUNNEL_STAGES);

/** `outro` is a legal library value, so it is the honest fallback for a slug
 *  the model invented — the hypothesis survives, the bad tag does not. */
const fallbackSlug = (value: unknown, allowed: Set<string>): string =>
  typeof value === "string" && allowed.has(value) ? value : "outro";

/** Funnel has no `outro`; an invented stage falls back to discovery, the only
 *  stage every organic test passes through. */
const fallbackFunnel = (value: unknown): string =>
  typeof value === "string" && funnelSet.has(value) ? value : "descoberta";

/** Keys become idempotency anchors and DOM ids — force them into shape. */
export function sanitizeHypothesisKey(value: unknown, index: number): string {
  const slug =
    typeof value === "string"
      ? value
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 64)
      : "";
  return slug || `hipotese-${index + 1}`;
}

function isHypothesisShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const h = value as Record<string, unknown>;
  return (
    typeof h.angle === "string" &&
    typeof h.hook === "string" &&
    typeof h.rationale === "string" &&
    typeof h.prompt_brief === "string" &&
    typeof h.success_criterion === "string" &&
    typeof h.content_count === "number" &&
    Array.isArray(h.technical_basis)
  );
}

/** Defensive check: the provider claims schema conformance, we verify it. */
export function isCreativePlanOutput(value: unknown): value is CreativePlanOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Record<string, unknown>;
  return (
    typeof output.diagnosis === "string" &&
    Array.isArray(output.evidence) &&
    Array.isArray(output.hypotheses) &&
    output.hypotheses.every(isHypothesisShape) &&
    typeof output.volume_note === "string" &&
    typeof output.transfer_caveat === "string" &&
    (output.confidence === "baixa" || output.confidence === "media" || output.confidence === "alta") &&
    typeof output.insufficient_data === "boolean" &&
    typeof output.missing_data === "string"
  );
}

/**
 * Normalize a conforming output before persisting: slugs forced into the
 * canonical vocabulary, keys deduplicated (a repeated key would silently merge
 * two hypotheses at materialization time), counts clamped to the cohort floor.
 */
export function sanitizeCreativePlan(output: CreativePlanOutput): CreativePlanOutput {
  const seen = new Set<string>();
  const hypotheses = output.hypotheses.slice(0, 5).map((h, index) => {
    let key = sanitizeHypothesisKey(h.key, index);
    while (seen.has(key)) key = `${key}-${index + 1}`;
    seen.add(key);
    return {
      ...h,
      key,
      format: fallbackSlug(h.format, formatSet),
      proof_type: fallbackSlug(h.proof_type, proofSet),
      emotion: fallbackSlug(h.emotion, emotionSet),
      funnel_stage: fallbackFunnel(h.funnel_stage),
      content_count: Math.min(20, Math.max(MINIMUM_ORGANIC_COHORT_SIZE, Math.round(h.content_count))),
    };
  });
  return { ...output, hypotheses };
}
