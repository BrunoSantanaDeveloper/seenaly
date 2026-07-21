import type { ProductStatus, ProductWithChildren } from "../types";

import type { BillingPeriod, PricingInputs, PricingPlanRow } from "@/lib/pricing";

/** Postgres `numeric` arrives as a string over PostgREST. */
const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
const str = (value: unknown): string => (typeof value === "string" ? value : "");

export interface ProductPlanRowData {
  name: string | null;
  price: unknown;
  period: string | null;
  quantity: unknown;
  share_pct: unknown;
  is_primary: boolean | null;
  sort: number | null;
}

export interface ProductRowChildren {
  objections?: { content: string }[];
  proofs?: { kind: string | null; content: string }[];
  plans?: ProductPlanRowData[];
}

/**
 * Map a `products` row (+ its child lists) into the shape the form and the
 * completeness calculation share. Used by the edit screen and the home.
 */
export function mapProductRow(
  row: Record<string, unknown>,
  { objections = [], proofs = [], plans = [] }: ProductRowChildren = {},
): ProductWithChildren {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    name: str(row.name),
    status: (row.status as ProductStatus) ?? "draft",
    description: str(row.description),
    currency: str(row.currency),
    price: num(row.price),
    unitCost: num(row.unit_cost),
    marginPct: num(row.margin_pct),
    avgTicket: num(row.avg_ticket),
    ltv: num(row.ltv),
    targetCac: num(row.target_cac),
    monthlyBudget: num(row.monthly_budget),
    conversionType: str(row.conversion_type),
    funnelStage: str(row.funnel_stage),
    audience: str(row.audience),
    mainPromise: str(row.main_promise),
    landingPageUrl: str(row.landing_page_url),
    landingConversionRate: num(row.landing_conversion_rate),
    optimizationEvent: str(row.optimization_event),
    notes: str(row.notes),
    connectionId: (row.connection_id as string | null) ?? null,
    metaAccountId: str(row.meta_account_id),
    pricingModel: str(row.pricing_model),
    pricingInputs: (row.pricing_inputs as PricingInputs | null) ?? {},
    plans: plans.map(
      (plan): PricingPlanRow => ({
        name: plan.name ?? "",
        price: num(plan.price),
        period: (plan.period as BillingPeriod | null) ?? "",
        quantity: num(plan.quantity),
        sharePct: num(plan.share_pct),
        isPrimary: Boolean(plan.is_primary),
      }),
    ),
    objections: objections.map((item) => item.content),
    proofs: proofs.map((item) => ({ kind: item.kind ?? "", content: item.content })),
  };
}
