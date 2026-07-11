/** Shared shapes for the funnel & real-sales layer (docs/PRODUCT.md pillar 3). */

export interface FunnelInput {
  id?: string;
  orgId: string;
  productId: string;
  label: string;
  periodStart: string; // "" or YYYY-MM-DD
  periodEnd: string;
  source: string;
  visits: number | null;
  checkoutInitiated: number | null;
  purchases: number | null;
  refunds: number | null;
  pending: number | null;
  upsells: number | null;
  grossRevenue: number | null;
  netRevenue: number | null;
  notes: string;
}

export interface FunnelWithId extends Omit<FunnelInput, "orgId" | "productId"> {
  id: string;
  orgId: string;
  productId: string;
}

/** Snapshot counts as read from the DB (snake_case), for rate helpers. */
export interface FunnelCounts {
  visits: number | null;
  checkout_initiated: number | null;
  purchases: number | null;
  refunds: number | null;
  net_revenue: number | null;
}

export interface FunnelRates {
  /** visits → checkout initiated (%). */
  pageToCheckout: number | null;
  /** checkout initiated → purchase (%). */
  checkoutToPurchase: number | null;
  /** visits → purchase (%). */
  overall: number | null;
  /** refunds ÷ purchases (%). */
  refundRate: number | null;
}

const pct = (num: number | null | undefined, den: number | null | undefined): number | null =>
  num != null && den != null && den > 0 ? (num / den) * 100 : null;

/** Compute the stage-to-stage rates from a snapshot. Pure; used by UI + engine. */
export function computeFunnelRates(c: FunnelCounts): FunnelRates {
  return {
    pageToCheckout: pct(c.checkout_initiated, c.visits),
    checkoutToPurchase: pct(c.purchases, c.checkout_initiated),
    overall: pct(c.purchases, c.visits),
    refundRate: pct(c.refunds, c.purchases),
  };
}
