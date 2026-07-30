/**
 * Experiment memory serialized for an engine brief (docs/PRODUCT.md — the key
 * differentiator): concluded tests feed back so an engine builds on prior
 * learning and does NOT recommend re-testing what was already disproven.
 *
 * Shared by the campaign diagnosis AND the readiness verdict — "todo
 * experimento concluído volta ao briefing" holds for both engines only when
 * they read the same memory the same way. Moved VERBATIM out of
 * diagnosis/actions.ts (a "use server" file may only export async functions,
 * so the block could not be exported in place); the strings must never drift,
 * or the tuned campaign assistant starts seeing a different brief.
 *
 * PURE — no I/O, no server-only imports — so scripts/test-readiness.mts can
 * import it under plain tsx.
 */

export interface ExperimentSummaryRow {
  title: string;
  status: string;
  hypothesis: string | null;
  result: string | null;
  conclusion: string | null;
  next_step: string | null;
}

/** Most recent experiments summarized for an engine (memory feedback loop). */
export const EXPERIMENT_BRIEF_LIMIT = 15;

const EXPERIMENT_STATUS_PRIORITY: Record<string, number> = {
  concluded: 0,
  running: 1,
  planned: 2,
  abandoned: 3,
};

export function experimentsBlock(experiments: ExperimentSummaryRow[]): string {
  if (experiments.length === 0) {
    return "Nenhum experimento registrado ainda. Ao recomendar um teste, oriente a registrá-lo na memória de experimentos (hipótese → mudança → resultado → conclusão) para não repetir o que já foi testado.";
  }
  // Concluded first (they carry the learning the engine must not re-test),
  // abandoned last; the DB query only gives us the most-recent window.
  return [...experiments]
    .sort((a, b) => (EXPERIMENT_STATUS_PRIORITY[a.status] ?? 9) - (EXPERIMENT_STATUS_PRIORITY[b.status] ?? 9))
    .map((e) => {
      const parts = [
        e.hypothesis && `hipótese: ${e.hypothesis}`,
        e.result && `resultado: ${e.result}`,
        e.conclusion && `conclusão: ${e.conclusion}`,
        e.next_step && `próximo passo: ${e.next_step}`,
      ]
        .filter(Boolean)
        .join(" | ");
      return `- [${e.status}] ${e.title}${parts ? ` — ${parts}` : ""}`;
    })
    .join("\n");
}
