/**
 * Briefing blocks for the Launch Plan engine (docs/PRODUCT.md phase 9).
 *
 * Pure text assembly over already-fetched rows — no I/O — mirroring
 * `lib/readiness/brief.ts` and `lib/creative-plan/brief.ts` so all three
 * engine modes stay testable without a database or a network call.
 */

import type { LearningPhaseFloorResult, OptimizationEventResolution } from "./math";

import type { ReadinessEvaluation, ReadinessItemKey } from "@/lib/readiness/checklist";
import type { ReadinessOutput } from "@/lib/readiness/schema";

/** Human labels for the deterministic blockers (lib/readiness/checklist.ts) —
 *  engine-facing prose, not UI copy, so it stays a plain pt-BR literal here
 *  the same way productContextBlock's row labels do. */
const BLOCKER_LABEL: Record<string, string> = {
  "no-page": "não há página de destino declarada",
  "no-measurement": "não há como medir conversão (nem Pixel, nem CAPI)",
  "event-untested": "o evento de conversão nunca foi testado",
  "no-checkout": "não há checkout",
  "no-payment": "não há meio de pagamento configurado",
  "no-price": "não há preço declarado, logo não há teto de CAC",
  "trial-conversion-unmeasured": "a conversão trial → pagante não é medida",
};

/**
 * The Prontidão summary — what the launch plan is allowed to treat as PROVED
 * versus merely declared. This is the input the optimization-event resolution
 * in `math.ts` is built from, restated here so the model sees the same facts
 * it is forbidden from re-deciding.
 */
export function launchPlanReadinessBlock(
  evaluation: ReadinessEvaluation | null,
  verdict: ReadinessOutput | null,
): string {
  if (!evaluation) {
    return [
      "Não existe um perfil de Prontidão para este produto — nada foi declarado nem escaneado.",
      "Isto NÃO impede o plano (a Prontidão é input, não pré-requisito), mas todo evento de otimização é tratado como suposição (basis=missing) até que a Prontidão exista. Recomende rodar a Prontidão em missing_data.",
    ].join("\n");
  }
  const verifiedKeys = new Set<ReadinessItemKey>(evaluation.verified);
  const lines = [
    verdict
      ? `Último veredito de Prontidão: ${verdict.verdict}.`
      : "Existe um perfil de Prontidão, mas nenhum veredito foi gerado ainda.",
    `Pixel: ${verifiedKeys.has("pixelInstalled") ? "PROVADO pelo scan da página" : "não provado pelo scan"}.`,
    evaluation.blockers.length > 0
      ? `Bloqueadores abertos na Prontidão: ${evaluation.blockers.map((b) => BLOCKER_LABEL[b] ?? b).join("; ")}.`
      : "Nenhum bloqueador aberto na Prontidão.",
  ];
  return lines.join("\n");
}

/** One hypothesis from the Creative Test Plan, as the launch plan sees it —
 *  presence + coverage, never performance (same invariant every engine here
 *  respects for organic signal). */
export interface LaunchPlanHypothesisRow {
  key: string;
  angle: string;
  format: string;
  funnel_stage: string;
  content_count: number;
  /** Organic publications linked to the materialized creative, if any. */
  organic_count: number;
}

export function launchPlanCreativeBlock(hypotheses: LaunchPlanHypothesisRow[]): string {
  if (hypotheses.length === 0) {
    return [
      "Não existe um Plano de Teste Criativo gerado para este produto — nenhuma hipótese etiquetada para alocar aos conjuntos.",
      "Isto NÃO impede o plano: proponha a estrutura mesmo assim (creatives_per_adset pode refletir uma quantidade genérica) e recomende gerar o Plano de Teste Criativo em missing_data — a alocação fica mais forte depois.",
    ].join("\n");
  }
  const lines = hypotheses.map(
    (h) =>
      `- [${h.key}] ${h.angle} — formato ${h.format}, etapa ${h.funnel_stage}, ${h.content_count} conteúdo(s) planejado(s)${h.organic_count > 0 ? `, ${h.organic_count} publicação(ões) orgânica(s) já vinculada(s)` : ""}`,
  );
  return [
    `${hypotheses.length} hipótese(s) do Plano de Teste Criativo disponível(is) para alocar:`,
    ...lines,
    "Use as chaves EXATAS acima em structure.hypothesis_keys. Prefira hipóteses com publicação orgânica vinculada — é a evidência mais barata que já existe.",
  ].join("\n");
}

/**
 * The authoritative numbers block — computed in `math.ts`, never the model's
 * to decide. Marked loudly so the prompt's own instruction ("NÃO recalcule")
 * has something concrete to point at.
 */
export function launchPlanAuthoritativeBlock(
  event: OptimizationEventResolution,
  floor: LearningPhaseFloorResult,
): string {
  const lines = [
    "## NÚMEROS AUTORITATIVOS — já calculados pelo servidor. Reproduza-os, NUNCA recalcule ou invente outros.",
    `Evento de otimização: ${event.event} (base: ${event.basis}).`,
    event.note,
    ...floor.arithmetic,
    floor.viable
      ? `Conclusão: viável — ${floor.adsetCount} conjunto(s) de anúncios podem sair da fase de aprendizado com o orçamento declarado.`
      : `Conclusão: NÃO viável ainda. ${floor.whatWouldChange}`,
  ];
  if (floor.missing.length > 0) {
    lines.push(`Dado(s) ausente(s) que impediram uma conta mais precisa: ${floor.missing.join("; ")}.`);
  }
  return lines.join("\n");
}

/** One focused retrieval question plus how much evidence it may claim —
 *  mirrors `creative-plan/brief.ts`'s `planRetrievalPlan` (document recall
 *  measured far higher per focused question than one chained query). */
export interface LaunchPlanRetrievalQuery {
  key: string;
  text: string;
  /** Chunks from `meta-ads-docs` (official platform mechanics). */
  meta: number;
  /** Chunks from `growth-playbook` (economics and testing craft). */
  playbook: number;
}

export function launchPlanRetrievalPlan(): LaunchPlanRetrievalQuery[] {
  return [
    {
      key: "aprendizado",
      text: "fase de aprendizado do Meta Ads: quantos eventos de otimização, em quanto tempo, e o que impede a entrega de estabilizar",
      meta: 3,
      playbook: 1,
    },
    {
      key: "edicoes",
      text: "edições significativas que resetam a fase de aprendizado e o que evitar durante a janela de julgamento de uma campanha nova",
      meta: 3,
      playbook: 1,
    },
    {
      key: "estrutura_orcamento",
      text: "estrutura de orçamento e conjuntos de anúncios: orçamento no nível da campanha (CBO) vs no conjunto (ABO), quantos conjuntos por campanha, orçamento diário mínimo",
      meta: 3,
      playbook: 1,
    },
    {
      key: "segmentacao",
      text: "segmentação ampla vs detalhada para a primeira campanha de um anunciante novo, tamanho mínimo de público",
      meta: 2,
      playbook: 2,
    },
    {
      key: "remarketing",
      text: "remarketing: quando um público de remarketing fica pronto para uso, tamanho mínimo, diferença entre audiência fria e morna",
      meta: 1,
      playbook: 3,
    },
  ];
}
