/**
 * Briefing blocks for the Creative Test Plan engine (docs/PRODUCT.md phase 8)
 * and the creative-evidence block the PAID diagnosis briefing reuses (fase C).
 *
 * Everything here is pure text assembly over already-fetched rows — no I/O —
 * mirroring `lib/readiness/brief.ts` so both engine modes stay testable.
 */

import { MINIMUM_ORGANIC_COHORT_SIZE } from "@flyee/organic-growth";

/** A library creative as the plan engine sees it (tags + lifecycle + reach). */
export interface PlanCreativeRow {
  name: string;
  status: string;
  source: string;
  format: string | null;
  angle: string | null;
  hook: string | null;
  /** The ad-side promise — the message-match input the readiness brief reads.
   *  Optional: pre-existing callers/fixtures never carried it. */
  promise?: string | null;
  proof_type: string | null;
  emotion: string | null;
  funnel_stage: string | null;
  result_summary: string | null;
  /** Organic publications linked to this creative (0 when never published). */
  organic_count: number;
}

/** Real organic activity tied to the product (migration 0024 tables). */
export interface PlanOrganicPresence {
  contentCount: number;
  platforms: string[];
  latestPublishedAt: string | null;
  hasReview: boolean;
  reviewInsufficientData: boolean | null;
}

/**
 * The current creative evidence — what exists, what has been published, what
 * carries a result. The plan fills GAPS; it must never restart from zero when
 * the library already carries learning.
 */
export function planCreativesBlock(creatives: PlanCreativeRow[]): string {
  if (creatives.length === 0) {
    return [
      "A biblioteca de criativos está VAZIA: não existe nenhuma evidência criativa registrada para este produto.",
      "O plano parte do zero — as hipóteses vêm do contexto do produto e do conhecimento, não de resultado anterior.",
    ].join("\n");
  }
  const lines = creatives.map((c) => {
    const tags = [
      c.format && `formato ${c.format}`,
      c.angle && `ângulo: ${c.angle}`,
      c.hook && `gancho: ${c.hook}`,
      c.proof_type && `prova: ${c.proof_type}`,
      c.emotion && `emoção: ${c.emotion}`,
      c.funnel_stage && `etapa: ${c.funnel_stage}`,
      c.organic_count > 0 && `${c.organic_count} publicação(ões) orgânica(s) vinculada(s)`,
      c.result_summary && `resultado: ${c.result_summary}`,
    ]
      .filter(Boolean)
      .join("; ");
    return `- [${c.status}/${c.source}] ${c.name}${tags ? ` — ${tags}` : ""}`;
  });
  return [
    `Biblioteca atual (${creatives.length} criativo(s)):`,
    ...lines,
    "Proponha hipóteses que cubram LACUNAS (ângulos, ganchos ou provas ainda não testados) — não repita o que já tem leitura.",
  ].join("\n");
}

/**
 * Organic presence, as counts — deliberately NOT performance. Two invariants
 * of the Organic module hold verbatim: cross-network metrics are never ranked
 * as equivalents, and presence is never attribution.
 */
export function planOrganicBlock(presence: PlanOrganicPresence): string {
  if (presence.contentCount === 0) {
    return [
      "Nenhum conteúdo orgânico foi importado para este produto.",
      "Isso NÃO significa que o negócio não publica — significa que não há dado importado aqui. Se a pessoa já publica, a primeira ação barata é importar o histórico (CSV) antes de produzir do zero; peça isso em missing_data.",
    ].join("\n");
  }
  return [
    `- ${presence.contentCount} conteúdo(s) orgânico(s) importado(s)${presence.platforms.length > 0 ? ` (plataformas: ${presence.platforms.join(", ")})` : ""}.`,
    presence.latestPublishedAt
      ? `- Publicação mais recente: ${new Date(presence.latestPublishedAt).toLocaleDateString("pt-BR")}.`
      : null,
    presence.hasReview
      ? `- Existe um Organic Growth Review${presence.reviewInsufficientData ? " (declarado com dados insuficientes)" : ""} — use os aprendizados dele como evidência de coorte.`
      : "- Ainda não existe um Organic Growth Review para este produto.",
    "COMO USAR ISTO: conteúdo já importado é a evidência mais barata disponível — hipóteses que estendem um sinal existente valem mais que apostas totalmente novas. NUNCA compare métricas de redes diferentes como equivalentes e NUNCA afirme que um conteúdo causou uma venda.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The floor every content_count must respect, stated to the engine. */
export function planCohortBlock(): string {
  return [
    `Mínimo de coorte para leitura: ${MINIMUM_ORGANIC_COHORT_SIZE} conteúdos comparáveis (mesma plataforma e formato).`,
    "Abaixo disso o sistema declara volume insuficiente em vez de concluir — dimensione content_count sabendo disso.",
  ].join("\n");
}

/** One focused retrieval question plus how much evidence it may claim. */
export interface PlanRetrievalQuery {
  key: string;
  text: string;
  /** Chunks from `meta-ads-docs` (official creative guidance). */
  meta: number;
  /** Chunks from `growth-playbook` (the craft Meta does not document). */
  playbook: number;
}

/**
 * What we ask the knowledge base for a plan — ONE question per subject.
 *
 * This used to be a single string chaining five subjects (hook anatomy, hook
 * taxonomy, organic formats, message match, testing before scaling), which the
 * embedder collapsed into one averaged vector. The readiness engine had the
 * same shape and the gate measured what it costs: document recall went from 7%
 * to 79% purely by splitting the question. There is no reason to expect this
 * corpus to behave differently — it is the same corpus.
 *
 * Collection weights follow ownership: Meta documents its own creative specs
 * and placements; the playbook carries the craft (hook taxonomy, angle–market
 * fit, proof types) that Meta does not write down.
 */
export function planRetrievalPlan(): PlanRetrievalQuery[] {
  return [
    {
      key: "anatomia",
      text: "anatomia do criativo de performance: gancho, ângulo e prova, e qual camada variar quando o criativo não performa",
      meta: 1,
      playbook: 3,
    },
    {
      key: "ganchos",
      text: "taxonomia de ganchos visuais, primeiros segundos do vídeo, retenção e o erro da introdução lenta",
      meta: 2,
      playbook: 2,
    },
    {
      key: "formatos",
      text: "formatos de anúncio e de conteúdo: reels, carrossel, imagem estática, vídeo — boas práticas e quando usar cada um por etapa do funil",
      meta: 3,
      playbook: 2,
    },
    {
      key: "message_match",
      text: "congruência entre a promessa do conteúdo e a oferta, message match, copy e nível de consciência",
      meta: 0,
      playbook: 3,
    },
    {
      key: "teste",
      text: "teste e validação de criativo antes de escalar, diversificação criativa, o que caracteriza um teste conclusivo",
      meta: 2,
      playbook: 2,
    },
  ];
}

/** @deprecated Kept for the retrieval gate's baseline comparison only. */
export function planRetrievalQuery(): string {
  return "anatomia de criativo vencedor: gancho, ângulo e prova; taxonomia de ganchos e primeiros segundos; formatos orgânicos (reels, carrossel, lista) por etapa do funil; message match entre conteúdo e oferta; teste criativo antes de escalar mídia paga";
}

/* -------------------------------------------------------------------------- */
/*  Fase C — creative evidence for the PAID diagnosis briefing                 */
/* -------------------------------------------------------------------------- */

/**
 * Aggregate the organic evidence the library already carries, per tag.
 *
 * COUNTS ONLY, on purpose: ranking engagement numbers across platforms would
 * violate the cross-network invariant, and the real cohort math lives in the
 * Organic Growth Review. What the paid engine needs from this block is which
 * hypotheses already carry evidence — volume and coverage, not metrics.
 */
export function creativeEvidenceBlock(creatives: PlanCreativeRow[]): string {
  const published = creatives.filter((c) => c.organic_count > 0);
  if (published.length === 0) {
    return [
      "Nenhum criativo da biblioteca tem publicação orgânica vinculada — não há evidência criativa pré-paga para ordenar hipóteses.",
      "Se recomendar criativos, considere recomendar o teste orgânico primeiro (é evidência quase gratuita) ou peça a importação do conteúdo existente em missing_data.",
    ].join("\n");
  }
  const byTag = (pick: (c: PlanCreativeRow) => string | null, label: string): string[] => {
    const counts = new Map<string, { creatives: number; publications: number }>();
    for (const c of published) {
      const tag = pick(c);
      if (!tag) continue;
      const entry = counts.get(tag) ?? { creatives: 0, publications: 0 };
      entry.creatives += 1;
      entry.publications += c.organic_count;
      counts.set(tag, entry);
    }
    return [...counts.entries()].map(([tag, entry]) => {
      const enough = entry.publications >= MINIMUM_ORGANIC_COHORT_SIZE;
      return `- ${label} "${tag}": ${entry.creatives} criativo(s), ${entry.publications} publicação(ões)${enough ? "" : ` — volume abaixo do mínimo de coorte (${MINIMUM_ORGANIC_COHORT_SIZE}), sem leitura confiável`}`;
    });
  };
  return [
    `${published.length} de ${creatives.length} criativo(s) da biblioteca têm publicação orgânica vinculada. Cobertura por tag:`,
    ...byTag((c) => c.hook, "gancho"),
    ...byTag((c) => c.angle, "ângulo"),
    ...byTag((c) => c.proof_type, "prova"),
    "USE ISTO PARA ORDENAR, NÃO PARA PREVER: evidência orgânica indica qual hipótese testar primeiro no pago; ela nunca prevê o resultado pago (audiência morna ≠ audiência fria). A leitura de desempenho por coorte vive no Organic Growth Review.",
  ].join("\n");
}
