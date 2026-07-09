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
}

export function computeCompleteness(values: ProductInput): Completeness {
  const missing = COMPLETENESS_FIELDS.filter((field) => !isFilled(values, field));
  const filled = COMPLETENESS_FIELDS.length - missing.length;
  return {
    score: Math.round((filled / COMPLETENESS_FIELDS.length) * 100),
    filled,
    total: COMPLETENESS_FIELDS.length,
    missing,
  };
}
