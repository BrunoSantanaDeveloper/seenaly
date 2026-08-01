/**
 * The "how do I actually do this?" output (docs/PRODUCT.md phase 7).
 *
 * The verdict says WHAT to fix and WHY. This says HOW, for a beginner who
 * would otherwise be stuck at "configure the standard events". It obeys the
 * same law as everything else here: grounded or empty, never invented — a
 * fabricated tutorial about the pixel, the checkout or the DNS makes someone
 * break their own site.
 */

/** An official page to follow, lifted from the retrieved excerpts — never invented. */
export interface HowToReference {
  label: string;
  url: string;
}

export interface HowToOutput {
  /** Numbered, verifiable actions. EMPTY is a valid, honest answer. */
  steps: string[];
  /**
   * Official links that carry the click-by-click detail, taken verbatim from
   * the retrieved excerpts. This is what makes an empty `steps` still useful:
   * the corpus captured Meta's overview pages, which LINK to the interface
   * tutorials — so "here is the page that walks you through it" is available
   * even when the steps themselves are not in the base.
   */
  references: HowToReference[];
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
    references: {
      type: "array",
      description:
        "Links OFICIAIS que aprofundam o passo a passo, copiados LITERALMENTE dos trechos recuperados (url exatamente como aparece lá). Nunca invente nem adivinhe uma URL. Preencha sempre que os trechos citarem um link pertinente — e especialmente quando steps estiver vazio, pois aí é a única coisa acionável que você tem a entregar. Lista vazia quando os trechos não citarem link algum.",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "O que essa página ensina, em poucas palavras." },
          url: { type: "string", description: "A URL exata, copiada do trecho recuperado." },
        },
        required: ["label", "url"],
      },
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
  required: ["steps", "references", "needs_specialist", "note"],
};

/** Only http(s) links survive — a hallucinated or malformed url never reaches an href. */
function sanitizeReferences(value: unknown): HowToReference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { label, url } = entry as Record<string, unknown>;
    if (typeof label !== "string" || typeof url !== "string") return [];
    // Prose ends in punctuation; a url copied out of a sentence drags the
    // period along and 404s. Strip trailing sentence punctuation before parsing.
    const cleaned = url.trim().replace(/[.,;:)\]]+$/, "");
    let parsed: URL;
    try {
      parsed = new URL(cleaned);
    } catch {
      return [];
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
    return [{ label, url: parsed.toString() }];
  });
}

/** Defensive check: the provider claims conformance, we verify it. */
export function isHowToOutput(value: unknown): value is HowToOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Record<string, unknown>;
  if (
    !Array.isArray(output.steps) ||
    !output.steps.every((step) => typeof step === "string") ||
    typeof output.needs_specialist !== "boolean" ||
    typeof output.note !== "string"
  ) {
    return false;
  }
  // References are normalized in place: a bad url is dropped, never rendered.
  output.references = sanitizeReferences(output.references);
  return true;
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
    references: sanitizeReferences(raw.references),
    needs_specialist: raw.needs_specialist === true,
    note: typeof raw.note === "string" ? raw.note : "",
  };
}
