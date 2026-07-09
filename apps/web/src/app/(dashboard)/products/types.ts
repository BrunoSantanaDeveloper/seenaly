/** Shared shapes for the product context model (docs/PRODUCT.md, Fase 2). */

export type ProductStatus = "draft" | "active" | "archived";

export interface ProductProofInput {
  kind: string;
  content: string;
}

/** Serializable payload sent from the form to the server action. */
export interface ProductInput {
  id?: string;
  orgId: string;
  name: string;
  status: ProductStatus;
  description: string;

  // Economics — null when the field is left blank.
  currency: string;
  price: number | null;
  unitCost: number | null;
  marginPct: number | null;
  avgTicket: number | null;
  ltv: number | null;
  targetCac: number | null;
  monthlyBudget: number | null;

  // Positioning & funnel.
  conversionType: string;
  funnelStage: string;
  audience: string;
  mainPromise: string;
  landingPageUrl: string;
  landingConversionRate: number | null;
  optimizationEvent: string;
  notes: string;

  // Optional bridge to synced Meta data.
  connectionId: string | null;
  metaAccountId: string;

  objections: string[];
  proofs: ProductProofInput[];
}

/** A product row joined with its child lists, as loaded for editing. */
export interface ProductWithChildren extends Omit<ProductInput, "orgId"> {
  id: string;
  orgId: string;
}
