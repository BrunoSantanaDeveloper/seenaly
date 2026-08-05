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

import { type FunnelModel, groupsForModel, stagesForModel } from "./checklist";

import type { Confidence, DiagnosisEvidence, DiagnosisTechnicalBasis, EvidenceSource } from "@/lib/diagnosis/schema";

export type { Confidence, DiagnosisEvidence, DiagnosisTechnicalBasis, EvidenceSource };

/** Ready to spend / cheap wins first / do not spend yet. */
export type ReadinessVerdict = "pronto" | "quase" | "nao_pronto";

/** Mirrors the audited dimensions in docs/PRODUCT.md. `ativacao` exists only
 *  for trial-first funnels (post-login structure: signup friction, activation
 *  moment, trial→paid, upgrade path) — the brief forbids it elsewhere. */
export type ReadinessDimension =
  | "oferta"
  | "pagina"
  | "checkout"
  | "mensuracao"
  | "ativacao"
  | "funil"
  | "descoberta"
  | "midia";

export type ReadinessStatus = "ok" | "atencao" | "critico" | "sem_dados";
export type ReadinessLevel = "baixo" | "medio" | "alto";

export interface ReadinessFinding {
  dimension: ReadinessDimension;
  status: ReadinessStatus;
  finding: string;
  evidence: DiagnosisEvidence[];
  technical_basis: DiagnosisTechnicalBasis[];
  recommended_action: string;
  /**
   * WHERE the fix lands: the journey stage, and a concrete screen locator.
   *
   * OPTIONAL on the type for the same reason as `related_items` — verdicts
   * stored before these fields existed must keep validating and rendering.
   * REQUIRED in the schema going forward, so every new finding commits to a
   * place instead of falling back to "na sua página".
   */
  stage?: string;
  where?: string;
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
  /**
   * When to re-read (R1): the model proposes, the server GUARANTEES — unlike
   * the campaign diagnosis, a readiness verdict always gets a next_review_at
   * (see readinessNextReviewDays), because the reminder IS the loop's engine.
   * OPTIONAL on the type for the same reason as related_items: verdicts stored
   * before these fields existed must keep validating and rendering.
   */
  next_review?: string;
  next_review_days?: number;
}

export const READINESS_SCHEMA_NAME = "seenaly_readiness";

const EVIDENCE_SOURCES = ["product_context", "campaign_data", "meta_docs", "growth_playbook"];

/**
 * The verdict schema, SCOPED to the business's funnel model.
 *
 * `related_items` carries an enum generated from the checklist definition
 * instead of a free string list whose valid names were repeated in the
 * assistant prompt. That prose copy drifted the moment migration 0034 added
 * the four activation keys without touching the prompt, leaving the engine
 * with two authoritative instructions that disagreed — the prompt forbidding
 * keys the briefing demanded. The phase-8 creative-plan engine already works
 * this way (`enum: [...CREATIVE_FORMATS]`); this aligns phase 7 with it.
 *
 * Scoping beats a global list: a direct-sale business is not even offered an
 * activation key, so the model cannot pick one by association.
 *
 * What the enum does NOT do: stop a VALID-but-wrong key (an activation key on
 * a `pagina` finding). Only the briefing teaches that, and `resolvableItems`
 * keeps its per-dimension fallback as the net.
 */
export function readinessJsonSchema(funnelModel: FunnelModel | null): Record<string, unknown> {
  const itemKeys = groupsForModel(funnelModel).flatMap((group) => group.items.map((item) => item.key));
  return {
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
              enum: ["oferta", "pagina", "checkout", "mensuracao", "ativacao", "funil", "descoberta", "midia"],
              description: "Use `ativacao` SOMENTE quando o modelo declarado for trial-first (estrutura pós-login).",
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
            stage: {
              type: "string",
              enum: stagesForModel(funnelModel),
              description:
                "QUANDO este problema custa dinheiro na jornada declarada — o momento em que a receita é ganha ou perdida por causa dele. NÃO é a tela onde o texto vai ser escrito: essa é a pergunta do campo `where`, e responder a mesma coisa nos dois desperdiça um dos campos. Exemplo: um aviso de garantia exibido na página de planos, que reduz o risco de ASSINAR, tem stage=`upgrade` e where=`página de planos` — nunca stage=`pagina`. Escolha pelo dinheiro: se o argumento é sobre risco de pagar, a etapa é aquela em que se paga, não o cadastro gratuito nem a página que hospeda o texto.",
            },
            where: {
              type: "string",
              description:
                "EM QUE TELA e em que ponto dela, concreto o bastante para a pessoa ir até lá e olhar (ex.: 'card do plano Pro na página de planos, abaixo do preço'). PROIBIDO responder apenas 'na sua página' ou 'no seu site' quando o negócio tem mais de uma superfície. PROIBIDO TAMBÉM hesitar entre duas telas com um 'ou': se você precisa escrever 'na página X ou na página Y', é porque não sabe qual existe — então escolha a mais provável, diga que é uma suposição, e PEÇA A URL da outra em missing_data. Nunca invente uma localização.",
            },
            related_items: {
              type: "array",
              description:
                "Chaves EXATAS do checklist que esta finding trata, para o usuário marcar 'já resolvi' e o sistema saber o que virou verdade. Cada chave aparece ao lado do seu item no bloco do checklist. Seja PRECISO: se a finding é só sobre o Pixel, liste apenas pixelInstalled e conversionEventTested, nunca o grupo inteiro — listar demais faz o usuário consertar uma coisa e a finding continuar pendente. Omita quando a finding não corresponder a nenhum item (oferta e mídia não têm itens).",
              items: { type: "string", enum: itemKeys },
            },
          },
          required: [
            "dimension",
            "status",
            "finding",
            "evidence",
            "technical_basis",
            "recommended_action",
            "stage",
            "where",
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
      next_review: {
        type: "string",
        description: "Quando reconferir a prontidão (janela de tempo, em linguagem natural), coerente com o veredito.",
      },
      next_review_days: {
        type: "integer",
        minimum: 1,
        maximum: 60,
        description:
          "Em quantos dias reconferir, coerente com o esforço das findings: bloqueadores pedem dias, higiene pede semanas.",
      },
    },
    required: [
      "verdict",
      "summary",
      "findings",
      "blocking",
      "confidence",
      "insufficient_data",
      "missing_data",
      "next_review",
      "next_review_days",
    ],
  };
}

const VERDICTS: ReadinessVerdict[] = ["pronto", "quase", "nao_pronto"];
const DIMENSIONS: ReadinessDimension[] = [
  "oferta",
  "pagina",
  "checkout",
  "mensuracao",
  "ativacao",
  "funil",
  "descoberta",
  "midia",
];
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
    typeof output.missing_data === "string" &&
    // Tolerant on purpose (diagnosis precedent): the JSON schema REQUIRES the
    // review fields going forward, but stored verdicts predate them.
    (output.next_review === undefined || typeof output.next_review === "string") &&
    (output.next_review_days === undefined || typeof output.next_review_days === "number")
  );
}

/**
 * How many days until this verdict should be re-read. The model proposes
 * (clamped to [1, 60] — a structural audit older than two months predates
 * page/checkout changes too easily); a missing or nonsense value falls back
 * by verdict: nao_pronto carries day-scale blocker fixes and the user is one
 * decision from spending anyway (7 keeps momentum), quase means 1–3 cheap
 * wins (~2 weeks), pronto only needs hygiene because the campaign loop takes
 * over (30).
 */
export function readinessNextReviewDays(output: ReadinessOutput): number {
  const proposed = output.next_review_days;
  if (typeof proposed === "number" && Number.isFinite(proposed) && proposed > 0) {
    return Math.min(60, Math.max(1, Math.round(proposed)));
  }
  if (output.verdict === "nao_pronto") return 7;
  if (output.verdict === "quase") return 14;
  return 30;
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

/**
 * Which retrieved excerpts the verdict actually CITED, as 1-based indexes.
 *
 * The engine is told to cite excerpts as `[n]` and it does — into
 * `technical_basis[].citation` — but nothing ever resolved those numbers back
 * to a document, so the "Fundamentado em" chips listed everything RETRIEVED.
 * That is a claim the product cannot back: the user reads it as "these are the
 * sources behind your verdict" when several were merely fetched and possibly
 * never read. In a product whose whole promise is that a recommendation cites
 * its rule, showing unread sources as grounding is the one lie that costs the
 * most.
 *
 * Tolerant on purpose — `[3]`, `[1, 2]`, `[1][2]` and `trecho [4]` all appear
 * in practice, and the citation is a free-text field. Indexes outside the
 * retrieved range are dropped rather than trusted.
 */
export function citedExcerptIndexes(output: ReadinessOutput, retrievedCount: number): Set<number> {
  const cited = new Set<number>();
  for (const finding of output.findings ?? []) {
    for (const basis of finding.technical_basis ?? []) {
      for (const match of String(basis.citation ?? "").matchAll(/\[?\s*(\d{1,2})\s*\]?/g)) {
        const index = Number(match[1]);
        if (index >= 1 && index <= retrievedCount) cited.add(index);
      }
    }
  }
  return cited;
}
