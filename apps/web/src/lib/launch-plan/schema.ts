/**
 * The Launch Plan format (docs/PRODUCT.md phase 9), as a JSON Schema.
 *
 * This is the bridge between "your structure is ready" (Prontidão, phase 7)
 * and "we can read your campaign data" (the paid diagnosis, phase 3) — the
 * penhasco the product used to go silent on. It answers ONE question: with
 * the structure proved, the creatives on hand and the economics declared,
 * what is the SMALLEST bet that produces reliable learning, and what must
 * stay untouched while it runs?
 *
 * Same law as every other engine output here: no claim without an anchored
 * source, no step without a precondition, "não comece ainda" as a first-class
 * answer. What is DIFFERENT from every sibling engine: `optimization_event`
 * and `budget` are NOT the model's to decide — they are computed by
 * `lib/launch-plan/math.ts` and handed to the model as authoritative brief
 * text. The JSON Schema still asks for them (so the model's prose stays
 * consistent with numbers it can see), but `sanitizeLaunchPlan` overwrites
 * them unconditionally before persistence — mirroring how the creative-plan
 * sanitizer never trusts an invented taxonomy slug.
 */

import { sanitizeHypothesisKey } from "../creative-plan/schema";

import type { Confidence, DiagnosisEvidence, DiagnosisTechnicalBasis, EvidenceSource } from "@/lib/diagnosis/schema";
import type {
  LearningPhaseFloorResult,
  OptimizationEventBasis,
  OptimizationEventResolution,
} from "@/lib/launch-plan/math";

export type { Confidence, DiagnosisEvidence, DiagnosisTechnicalBasis, EvidenceSource };

export const TARGETING_POSTURES = ["amplo", "detalhado"] as const;
export type TargetingPosture = (typeof TARGETING_POSTURES)[number];

export interface LaunchPlanOptimizationEvent {
  event: string;
  basis: OptimizationEventBasis;
  rationale: string;
}

export interface LaunchPlanBudget {
  daily_floor_per_adset: number;
  adset_count: number;
  /** The open arithmetic, one line per step. Server-computed, never re-derived. */
  arithmetic: string[];
}

export interface LaunchPlanStructure {
  campaigns: number;
  /** Always forced to equal budget.adset_count by the sanitizer. */
  adsets: number;
  targeting_posture: TargetingPosture;
  creatives_per_adset: number;
  /** Creative Test Plan hypothesis keys this structure allocates — sanitized
   *  against the product's REAL hypotheses, never an invented key. */
  hypothesis_keys: string[];
}

export interface LaunchPlanStep {
  /** Stable ascii-kebab slug — the idempotency anchor for materialization. */
  key: string;
  title: string;
  action: string;
  /** What must be true before this step starts. Empty string for step 1. */
  precondition: string;
  /** The observable signal that means "move to the next step". */
  signal_to_advance: string;
  technical_basis: DiagnosisTechnicalBasis[];
}

export interface LaunchPlanJudgement {
  window_days: number;
  do_not_touch: string[];
}

export interface LaunchPlanOutput {
  diagnosis: string;
  evidence: DiagnosisEvidence[];
  /** Whether a viable first bet exists given the declared economics. Server-computed. */
  viable: boolean;
  /** Filled when !viable: what would need to change. Server falls back when empty. */
  what_would_change: string;
  optimization_event: LaunchPlanOptimizationEvent;
  budget: LaunchPlanBudget;
  structure: LaunchPlanStructure;
  steps: LaunchPlanStep[];
  judgement: LaunchPlanJudgement;
  risk: string;
  confidence: Confidence;
  success_criterion: string;
  next_review: string;
  next_review_days?: number;
  insufficient_data: boolean;
  missing_data: string;
}

export const LAUNCH_PLAN_SCHEMA_NAME = "seenaly_launch_plan";

const EVIDENCE_SOURCES = ["product_context", "campaign_data", "meta_docs", "growth_playbook"];
const EVENT_BASIS_VALUES: OptimizationEventBasis[] = ["proved", "declared", "missing"];

export const LAUNCH_PLAN_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    diagnosis: {
      type: "string",
      description:
        "Duas a quatro frases: qual é a menor aposta que produz aprendizado confiável para este produto, dado o que a Prontidão provou e a economia declarada. Fale direto com o usuário.",
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
    viable: {
      type: "boolean",
      description:
        "Preencha para bater com a VIABILIDADE já computada no briefing — o servidor usa o valor computado, não este, mas seu texto deve ser consistente com ele.",
    },
    what_would_change: {
      type: "string",
      description:
        "Quando viable=false: o que mudaria isso (orçamento, evento de otimização, CAC alvo). String vazia quando viable=true.",
    },
    optimization_event: {
      type: "object",
      description: "O evento de otimização JÁ RESOLVIDO no briefing — reafirme-o, nunca escolha outro.",
      properties: {
        event: { type: "string" },
        basis: { type: "string", enum: EVENT_BASIS_VALUES },
        rationale: {
          type: "string",
          description: "Por que este evento, com a honestidade da base (proved/declared/missing) explícita no texto.",
        },
      },
      required: ["event", "basis", "rationale"],
    },
    budget: {
      type: "object",
      description: "Os números JÁ CALCULADOS no briefing — reproduza-os, nunca recalcule.",
      properties: {
        daily_floor_per_adset: { type: "number" },
        adset_count: { type: "integer" },
        arithmetic: { type: "array", items: { type: "string" } },
      },
      required: ["daily_floor_per_adset", "adset_count", "arithmetic"],
    },
    structure: {
      type: "object",
      properties: {
        campaigns: { type: "integer", minimum: 0, maximum: 3 },
        adsets: { type: "integer", minimum: 0, description: "Deve igualar budget.adset_count." },
        targeting_posture: {
          type: "string",
          enum: [...TARGETING_POSTURES],
          description:
            "amplo (deixar o algoritmo achar o público) ou detalhado (segmentação manual) — justifique pela documentação.",
        },
        creatives_per_adset: { type: "integer", minimum: 0, maximum: 6 },
        hypothesis_keys: {
          type: "array",
          description:
            "Chaves de hipóteses do Plano de Teste Criativo alocadas a este conjunto — EXATAS, do briefing. Vazio se não houver plano criativo.",
          items: { type: "string" },
        },
      },
      required: ["campaigns", "adsets", "targeting_posture", "creatives_per_adset", "hypothesis_keys"],
    },
    steps: {
      type: "array",
      description:
        "Etapas EM ORDEM, cada uma com pré-condição declarada. A etapa 1 é sempre o lançamento inicial (precondition vazia). O remarketing é SEMPRE uma etapa própria (nunca a etapa 1), com a pré-condição de acúmulo de tráfego declarada qualitativamente — NUNCA prometa uma data ou um número de visitantes que não esteja nos trechos recuperados.",
      items: {
        type: "object",
        properties: {
          key: { type: "string", description: "Slug estável ascii minúsculo com hífens, único no plano." },
          title: { type: "string" },
          action: {
            type: "string",
            description: "O que fazer, concreto e executável — nunca um botão que opera a conta.",
          },
          precondition: {
            type: "string",
            description: "O que precisa ser verdade antes. String vazia para a etapa 1.",
          },
          signal_to_advance: {
            type: "string",
            description: "O sinal observável de que é hora de passar para a próxima etapa.",
          },
          technical_basis: {
            type: "array",
            items: {
              type: "object",
              properties: { rule: { type: "string" }, citation: { type: "string" } },
              required: ["rule", "citation"],
            },
          },
        },
        required: ["key", "title", "action", "precondition", "signal_to_advance", "technical_basis"],
      },
    },
    judgement: {
      type: "object",
      properties: {
        window_days: {
          type: "integer",
          minimum: 3,
          maximum: 14,
          description:
            "Dias mínimos antes de qualquer decisão de otimização, ancorado na documentação da fase de aprendizado.",
        },
        do_not_touch: {
          type: "array",
          description:
            "O que NÃO editar enquanto a janela corre (edições que resetam o aprendizado), ancorado nos trechos recuperados.",
          items: { type: "string" },
        },
      },
      required: ["window_days", "do_not_touch"],
    },
    risk: { type: "string", description: "O que pode dar errado ao seguir este plano." },
    confidence: { type: "string", enum: ["baixa", "media", "alta"] },
    success_criterion: {
      type: "string",
      description:
        "Como saber que a etapa 1 aprendeu o que devia — relativo à própria conta, nunca benchmark de mercado.",
    },
    next_review: { type: "string", description: "Quando reler este plano (janela de tempo ou volume de eventos)." },
    next_review_days: { type: "integer", minimum: 1, maximum: 30 },
    insufficient_data: {
      type: "boolean",
      description: "true quando o contexto do produto é raso demais para sustentar um plano específico.",
    },
    missing_data: {
      type: "string",
      description:
        "O que preencher ou confirmar para um plano mais firme (contexto do produto, rodar a Prontidão, gerar o Plano de Teste Criativo). Preencha mesmo quando insufficient_data for false.",
    },
  },
  required: [
    "diagnosis",
    "evidence",
    "viable",
    "what_would_change",
    "optimization_event",
    "budget",
    "structure",
    "steps",
    "judgement",
    "risk",
    "confidence",
    "success_criterion",
    "next_review",
    "insufficient_data",
    "missing_data",
  ],
};

/* -------------------------------------------------------------------------- */
/*  Validation + sanitization — model output is never trusted on FACTS         */
/* -------------------------------------------------------------------------- */

function isStepShape(value: unknown): value is LaunchPlanStep {
  if (!value || typeof value !== "object") return false;
  const step = value as Record<string, unknown>;
  return (
    typeof step.title === "string" &&
    typeof step.action === "string" &&
    typeof step.precondition === "string" &&
    typeof step.signal_to_advance === "string" &&
    Array.isArray(step.technical_basis)
  );
}

/**
 * Which retrieved excerpts the plan actually CITED, as 1-based indexes —
 * mirrors `citedExcerptIndexes` in `lib/readiness/schema.ts`, walking
 * `steps[].technical_basis` instead of `findings[].technical_basis` (the
 * launch plan has no `findings` array). Same reason it exists there: showing
 * every RETRIEVED excerpt as "Fundamentado em" would credit chunks the model
 * fetched but never read.
 */
export function citedLaunchPlanExcerptIndexes(output: LaunchPlanOutput, retrievedCount: number): Set<number> {
  const cited = new Set<number>();
  for (const step of output.steps ?? []) {
    for (const basis of step.technical_basis ?? []) {
      for (const match of String(basis.citation ?? "").matchAll(/\[?\s*(\d{1,2})\s*\]?/g)) {
        const index = Number(match[1]);
        if (index >= 1 && index <= retrievedCount) cited.add(index);
      }
    }
  }
  return cited;
}

/** Defensive check: the provider claims schema conformance, we verify it. */
export function isLaunchPlanOutput(value: unknown): value is LaunchPlanOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Record<string, unknown>;
  if (
    typeof output.diagnosis !== "string" ||
    !Array.isArray(output.evidence) ||
    typeof output.what_would_change !== "string" ||
    !output.optimization_event ||
    typeof output.optimization_event !== "object" ||
    !output.budget ||
    typeof output.budget !== "object" ||
    !output.structure ||
    typeof output.structure !== "object" ||
    !Array.isArray(output.steps) ||
    !output.steps.every(isStepShape) ||
    !output.judgement ||
    typeof output.judgement !== "object" ||
    typeof output.risk !== "string" ||
    (output.confidence !== "baixa" && output.confidence !== "media" && output.confidence !== "alta") ||
    typeof output.success_criterion !== "string" ||
    typeof output.next_review !== "string" ||
    typeof output.insufficient_data !== "boolean" ||
    typeof output.missing_data !== "string"
  ) {
    return false;
  }
  return true;
}

/**
 * Overwrite every FACT the server already computed — `viable`, the
 * optimization event, the budget numbers and `structure.adsets` — with the
 * authoritative values from `lib/launch-plan/math.ts`. The model's job was
 * only ever to narrate and justify them; trusting its copy would let a single
 * bad token silently misinform the one number this whole phase exists to get
 * right. `hypothesis_keys` and step keys are sanitized the same way the
 * creative-plan sanitizer never trusts an invented taxonomy slug.
 */
export function sanitizeLaunchPlan(
  output: LaunchPlanOutput,
  authoritative: {
    optimizationEvent: OptimizationEventResolution;
    floor: LearningPhaseFloorResult;
    validHypothesisKeys: string[];
  },
): LaunchPlanOutput {
  const validKeys = new Set(authoritative.validHypothesisKeys);
  const seenStepKeys = new Set<string>();
  const steps = output.steps.map((step, index) => {
    let key = sanitizeHypothesisKey(step.key, index);
    while (seenStepKeys.has(key)) key = `${key}-${index + 1}`;
    seenStepKeys.add(key);
    return { ...step, key };
  });

  return {
    ...output,
    viable: authoritative.floor.viable,
    what_would_change: authoritative.floor.viable
      ? ""
      : output.what_would_change?.trim() || authoritative.floor.whatWouldChange,
    optimization_event: {
      event: authoritative.optimizationEvent.event,
      basis: authoritative.optimizationEvent.basis,
      rationale: output.optimization_event?.rationale?.trim() || authoritative.optimizationEvent.note,
    },
    budget: {
      daily_floor_per_adset: authoritative.floor.dailyFloorPerAdset ?? 0,
      adset_count: authoritative.floor.adsetCount,
      arithmetic: authoritative.floor.arithmetic,
    },
    structure: {
      ...output.structure,
      adsets: authoritative.floor.adsetCount,
      hypothesis_keys: (output.structure.hypothesis_keys ?? []).filter((key) => validKeys.has(key)),
    },
    steps,
  };
}
