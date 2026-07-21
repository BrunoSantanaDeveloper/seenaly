import type { ProductInput } from "../types";

/**
 * Context completeness — materializes the "guide the beginner from step 0"
 * principle (docs/PRODUCT.md #6). The richer the product context, the better
 * the diagnostic engine can reason, so we surface what is still missing.
 * Field ids double as i18n keys (products.field-<id>).
 */
export const COMPLETENESS_FIELDS = [
  "name",
  "mainPromise",
  "audience",
  "price",
  "targetCac",
  "avgTicket",
  "conversionType",
  "funnelStage",
  "landingPageUrl",
  "optimizationEvent",
  "objections",
  "proofs",
] as const;

/**
 * The minimum for the engine to be useful (maturity spectrum): what you sell +
 * the promise + who it's for. Once these are filled the product is "ready to
 * start"; everything else is enrichment, not a requirement. This keeps a
 * beginner from reading "20% — you failed" for numbers they don't have yet.
 */
export const ESSENTIAL_FIELDS = ["name", "mainPromise", "audience"] as const;

export type CompletenessField = (typeof COMPLETENESS_FIELDS)[number];

function isFilled(values: ProductInput, field: CompletenessField): boolean {
  switch (field) {
    case "objections":
      return values.objections.some((item) => item.trim().length > 0);
    case "proofs":
      return values.proofs.some((item) => item.content.trim().length > 0);
    case "price":
    case "targetCac":
    case "avgTicket":
      return values[field] !== null && values[field] !== undefined;
    default:
      return typeof values[field] === "string" && values[field].trim().length > 0;
  }
}

export interface Completeness {
  score: number; // 0-100
  filled: number;
  total: number;
  missing: CompletenessField[];
  /** All essential fields filled — the product is usable, the rest is bonus. */
  ready: boolean;
}

export function computeCompleteness(values: ProductInput): Completeness {
  const missing = COMPLETENESS_FIELDS.filter((field) => !isFilled(values, field));
  const filled = COMPLETENESS_FIELDS.length - missing.length;
  return {
    score: Math.round((filled / COMPLETENESS_FIELDS.length) * 100),
    filled,
    total: COMPLETENESS_FIELDS.length,
    missing,
    ready: ESSENTIAL_FIELDS.every((field) => isFilled(values, field)),
  };
}
