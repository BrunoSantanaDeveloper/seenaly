/**
 * The "how do I actually do this?" output (docs/PRODUCT.md phase 7).
 *
 * The verdict says WHAT to fix and WHY. This says HOW, for a beginner who
 * would otherwise be stuck at "configure the standard events". It obeys the
 * same law as everything else here: grounded or empty, never invented — a
 * fabricated tutorial about the pixel, the checkout or the DNS makes someone
 * break their own site.
 */

export interface HowToOutput {
  /** Numbered, verifiable actions. EMPTY is a valid, honest answer. */
  steps: string[];
  /** Honest read on whether this normally needs a developer/specialist. */
  needs_specialist: boolean;
  /** Why there are no steps, or a caveat worth reading before starting. */
  note: string;
}

export const HOWTO_SCHEMA_NAME = "seenaly_howto";

export const HOWTO_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      description:
        "3 a 8 passos numerados, curtos, cada um uma ação verificável e na ordem de execução. Lista VAZIA quando os trechos recuperados não sustentarem um passo a passo.",
      items: { type: "string" },
    },
    needs_specialist: {
      type: "boolean",
      description: "true quando isso normalmente exige um desenvolvedor ou especialista para ser feito com segurança.",
    },
    note: {
      type: "string",
      description:
        "Quando steps estiver vazio, explique o que faltou no conhecimento disponível. Caso contrário, um aviso curto e útil antes de começar (ou string vazia).",
    },
  },
  required: ["steps", "needs_specialist", "note"],
};

/** Defensive check: the provider claims conformance, we verify it. */
export function isHowToOutput(value: unknown): value is HowToOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Record<string, unknown>;
  return (
    Array.isArray(output.steps) &&
    output.steps.every((step) => typeof step === "string") &&
    typeof output.needs_specialist === "boolean" &&
    typeof output.note === "string"
  );
}

/**
 * Rebuild a stored how-to (readiness_howtos.steps jsonb, or the raced return
 * of the record RPC) into the exact shape the UI consumes. One function for
 * every read path, so the cache-hit, the race-loser and the fresh generation
 * can never drift into three subtly different shapes.
 */
export function normalizeStoredHowTo(stored: unknown): HowToOutput {
  const raw = (stored ?? {}) as Record<string, unknown>;
  return {
    steps: Array.isArray(raw.steps) ? raw.steps.filter((step): step is string => typeof step === "string") : [],
    needs_specialist: raw.needs_specialist === true,
    note: typeof raw.note === "string" ? raw.note : "",
  };
}
