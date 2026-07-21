/**
 * How the offer is charged — and the math that turns it into ad economics.
 *
 * The user knows FACTS (their plan prices, their packs, their deal size). They
 * do not know how to convert those into a reference price, a blended ticket, an
 * LTV and a maximum CAC — and they shouldn't have to: that conversion is the
 * product's domain. This module owns it.
 *
 * Contract: this is INPUT. The product's economics columns (price, avgTicket,
 * ltv, targetCac) remain what the diagnosis engine reads; they are DERIVED from
 * here. A product with no model set behaves exactly as before.
 *
 * Every derivation emits a structured `explain` trace so the UI can show the
 * math (and the user can disagree and override) — same evidence-first DNA as
 * the diagnosis engine.
 */

export const PRICING_MODEL_VERSION = "pricing-model/v1" as const;

export const PRICING_MODELS = [
  "one_time",
  "subscription",
  "credits",
  "service_lead",
  "ecommerce",
  "ladder",
  "marketplace",
  "other",
] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const BILLING_PERIODS = ["weekly", "monthly", "quarterly", "semiannual", "annual", "one_time"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/** Months covered by one charge — normalizes any period to a monthly figure. */
const PERIOD_MONTHS: Record<BillingPeriod, number> = {
  weekly: 1 / 4.345,
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
  one_time: 0,
};

export interface PricingPlanRow {
  name: string;
  price: number | null;
  period: BillingPeriod | "";
  /** Credits/units in a pack, or units in a ladder item. */
  quantity: number | null;
  /** Share of paying customers on this row (0-100). */
  sharePct: number | null;
  /** The row the ad anchors on (advertised / entry offer). */
  isPrimary: boolean;
}

export type PricingInputs = Record<string, number | null>;

export type PricingInputType = "money" | "percent" | "integer" | "decimal";
export interface PricingInputSpec {
  key: string;
  type: PricingInputType;
}
export interface PricingRowsSpec {
  kind: "plans" | "packs" | "ladder";
  fields: ("name" | "price" | "period" | "quantity" | "sharePct")[];
}
export interface PricingModelSpec {
  slug: PricingModel;
  rows?: PricingRowsSpec;
  inputs: PricingInputSpec[];
}

/**
 * Declarative spec per model — one generic renderer covers every model, so
 * supporting more business types never multiplies the UI.
 */
export const PRICING_MODEL_SPECS: Record<PricingModel, PricingModelSpec> = {
  one_time: {
    slug: "one_time",
    inputs: [
      { key: "price", type: "money" },
      { key: "bumpValue", type: "money" },
      { key: "repurchasePerYear", type: "decimal" },
    ],
  },
  subscription: {
    slug: "subscription",
    rows: { kind: "plans", fields: ["name", "price", "period", "sharePct"] },
    inputs: [
      { key: "retentionMonths", type: "integer" },
      { key: "trialDays", type: "integer" },
      { key: "trialConversionPct", type: "percent" },
    ],
  },
  credits: {
    slug: "credits",
    rows: { kind: "packs", fields: ["name", "price", "quantity", "sharePct"] },
    inputs: [{ key: "repurchasePerYear", type: "decimal" }],
  },
  service_lead: {
    slug: "service_lead",
    inputs: [
      { key: "dealTicket", type: "money" },
      { key: "closeRatePct", type: "percent" },
      { key: "dealsPerClientPerYear", type: "decimal" },
    ],
  },
  ecommerce: {
    slug: "ecommerce",
    inputs: [
      { key: "aov", type: "money" },
      { key: "contributionMarginPct", type: "percent" },
      { key: "ordersPerYear", type: "decimal" },
    ],
  },
  ladder: {
    slug: "ladder",
    rows: { kind: "ladder", fields: ["name", "price", "sharePct"] },
    inputs: [],
  },
  marketplace: {
    slug: "marketplace",
    inputs: [
      { key: "transactionTicket", type: "money" },
      { key: "takeRatePct", type: "percent" },
      { key: "transactionsPerYear", type: "decimal" },
    ],
  },
  other: { slug: "other", inputs: [] },
};

/** One line of the shown math; the UI renders t(`explain-${key}`, values). */
export interface DerivationStep {
  key: string;
  values?: Record<string, string | number>;
}

export interface DerivedEconomics {
  /** What the ad sells — the anchor the user should recognize. */
  referencePrice: number | null;
  /** Real average revenue per paying customer (blended). */
  avgTicket: number | null;
  /** Subscription only: the ticket normalized to a month. */
  monthlyEquivalent: number | null;
  ltv: number | null;
  /** The guardrail: what an acquisition may cost at most. */
  targetCac: number | null;
  /** Lead-gen only: the ad optimizes for leads, not sales. */
  maxCostPerLead: number | null;
  paybackMonths: number | null;
  explain: DerivationStep[];
}

const EMPTY: DerivedEconomics = {
  referencePrice: null,
  avgTicket: null,
  monthlyEquivalent: null,
  ltv: null,
  targetCac: null,
  maxCostPerLead: null,
  paybackMonths: null,
  explain: [],
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const positive = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/** Weighted by sharePct when shares exist, otherwise a plain mean. */
function blend(values: { value: number; share: number | null }[]): number | null {
  const paid = values.filter((v) => positive(v.value));
  if (paid.length === 0) return null;
  const totalShare = paid.reduce((s, v) => s + (positive(v.share) ? v.share! : 0), 0);
  if (totalShare > 0) {
    const weighted = paid.reduce((s, v) => s + v.value * (positive(v.share) ? v.share! : 0), 0);
    return weighted / totalShare;
  }
  return paid.reduce((s, v) => s + v.value, 0) / paid.length;
}

/** Price as charged, normalized to one month (annual ÷ 12, weekly × 4.345). */
function monthlyOf(row: PricingPlanRow): number | null {
  if (!positive(row.price)) return null;
  const months = row.period ? PERIOD_MONTHS[row.period] : 1;
  if (!months || months <= 0) return row.price; // one_time inside a subscription list
  return row.price / months;
}

export interface DeriveArgs {
  model: PricingModel | "";
  plans: PricingPlanRow[];
  inputs: PricingInputs;
  /** Contribution margin (%) when known — CAC is paid out of margin, not revenue. */
  marginPct?: number | null;
  /** Locale-aware money formatter for the explain trace. */
  formatMoney?: (value: number) => string;
}

/**
 * Turn the declared charging model into the four numbers the engine reasons
 * with, plus the trace that explains how we got there.
 */
export function derivePricing({
  model,
  plans,
  inputs,
  marginPct,
  formatMoney = (v) => v.toFixed(2),
}: DeriveArgs): DerivedEconomics {
  if (!model || model === "other") return EMPTY;
  const money = (v: number) => formatMoney(round2(v));
  const explain: DerivationStep[] = [];
  const num = (key: string) => (positive(inputs[key]) ? (inputs[key] as number) : null);

  /** CAC is paid out of margin: LTV × margin ÷ 3 (the LTV:CAC ≥ 3 rule). */
  const cacFrom = (ltv: number): number => {
    const m = positive(marginPct) && marginPct! <= 100 ? marginPct! / 100 : 1;
    const cac = (ltv * m) / 3;
    explain.push(
      m < 1
        ? { key: "explain-cac-margin", values: { margin: round2(marginPct!), value: money(cac) } }
        : { key: "explain-cac", values: { value: money(cac) } },
    );
    return cac;
  };

  const paidRows = plans.filter((p) => positive(p.price));
  const primary = plans.find((p) => p.isPrimary && positive(p.price)) ?? null;

  switch (model) {
    case "one_time": {
      const price = num("price");
      if (!price) return { ...EMPTY, explain };
      const bump = num("bumpValue") ?? 0;
      const ticket = price + bump;
      explain.push({ key: "explain-reference", values: { value: money(price) } });
      if (bump > 0) explain.push({ key: "explain-ticket-bump", values: { value: money(ticket) } });
      const times = num("repurchasePerYear");
      const ltv = times ? ticket * times : ticket;
      explain.push(
        times
          ? {
              key: "explain-ltv-repurchase",
              values: { ticket: money(ticket), times: round2(times), value: money(ltv) },
            }
          : { key: "explain-ltv-simple", values: { ticket: money(ticket) } },
      );
      return {
        ...EMPTY,
        referencePrice: price,
        avgTicket: round2(ticket),
        ltv: round2(ltv),
        targetCac: round2(cacFrom(ltv)),
        explain,
      };
    }

    case "subscription": {
      const monthly = blend(paidRows.map((r) => ({ value: monthlyOf(r) ?? 0, share: r.sharePct })));
      if (!monthly) return { ...EMPTY, explain };
      const hasNonMonthly = paidRows.some((r) => r.period && r.period !== "monthly");
      if (hasNonMonthly) explain.push({ key: "explain-monthly" });
      const weighted = paidRows.some((r) => positive(r.sharePct));
      explain.push({
        key: weighted ? "explain-ticket-weighted" : "explain-ticket-mean",
        values: { value: money(monthly) },
      });
      // Reference = what the ad sells: the marked plan, else the cheapest paid (entry).
      const entry = primary ?? [...paidRows].sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0] ?? null;
      const reference = entry?.price ?? null;
      if (reference) explain.push({ key: "explain-reference", values: { value: money(reference) } });
      const months = num("retentionMonths") ?? 12;
      const ltv = monthly * months;
      explain.push({
        key: "explain-ltv-retention",
        values: { ticket: money(monthly), months: round2(months), value: money(ltv) },
      });
      const cac = cacFrom(ltv);
      const payback = monthly > 0 ? cac / monthly : null;
      if (payback) explain.push({ key: "explain-payback", values: { months: round2(payback) } });
      return {
        referencePrice: reference,
        avgTicket: round2(monthly),
        monthlyEquivalent: round2(monthly),
        ltv: round2(ltv),
        targetCac: round2(cac),
        maxCostPerLead: null,
        paybackMonths: payback ? round2(payback) : null,
        explain,
      };
    }

    case "credits": {
      const ticket = blend(paidRows.map((r) => ({ value: r.price ?? 0, share: r.sharePct })));
      if (!ticket) return { ...EMPTY, explain };
      const entry = primary ?? [...paidRows].sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0] ?? null;
      if (entry?.price) explain.push({ key: "explain-reference", values: { value: money(entry.price) } });
      explain.push({ key: "explain-ticket-mean", values: { value: money(ticket) } });
      const qty = blend(paidRows.map((r) => ({ value: r.quantity ?? 0, share: r.sharePct })));
      if (qty && qty > 0) explain.push({ key: "explain-price-per-credit", values: { value: money(ticket / qty) } });
      const times = num("repurchasePerYear");
      const ltv = times ? ticket * times : ticket;
      explain.push(
        times
          ? {
              key: "explain-ltv-repurchase",
              values: { ticket: money(ticket), times: round2(times), value: money(ltv) },
            }
          : { key: "explain-ltv-simple", values: { ticket: money(ticket) } },
      );
      return {
        ...EMPTY,
        referencePrice: entry?.price ?? null,
        avgTicket: round2(ticket),
        ltv: round2(ltv),
        targetCac: round2(cacFrom(ltv)),
        explain,
      };
    }

    case "service_lead": {
      const deal = num("dealTicket");
      if (!deal) return { ...EMPTY, explain };
      explain.push({ key: "explain-reference", values: { value: money(deal) } });
      const perYear = num("dealsPerClientPerYear");
      const ltv = perYear ? deal * perYear : deal;
      explain.push(
        perYear
          ? {
              key: "explain-ltv-repurchase",
              values: { ticket: money(deal), times: round2(perYear), value: money(ltv) },
            }
          : { key: "explain-ltv-simple", values: { ticket: money(deal) } },
      );
      const cac = cacFrom(ltv);
      // The campaign optimizes for LEADS: budget per lead = CAC per sale × close rate.
      const close = num("closeRatePct");
      const perLead = close ? cac * (close / 100) : null;
      if (perLead)
        explain.push({
          key: "explain-cost-per-lead",
          values: { cac: money(cac), rate: round2(close!), value: money(perLead) },
        });
      return {
        ...EMPTY,
        referencePrice: deal,
        avgTicket: round2(deal),
        ltv: round2(ltv),
        targetCac: round2(cac),
        maxCostPerLead: perLead ? round2(perLead) : null,
        explain,
      };
    }

    case "ecommerce": {
      const aov = num("aov");
      if (!aov) return { ...EMPTY, explain };
      explain.push({ key: "explain-reference", values: { value: money(aov) } });
      const orders = num("ordersPerYear");
      const ltv = orders ? aov * orders : aov;
      explain.push(
        orders
          ? { key: "explain-ltv-repurchase", values: { ticket: money(aov), times: round2(orders), value: money(ltv) } }
          : { key: "explain-ltv-simple", values: { ticket: money(aov) } },
      );
      // Contribution margin is the model's own input here.
      const margin = num("contributionMarginPct");
      const cac = margin ? (ltv * (margin / 100)) / 3 : ltv / 3;
      explain.push(
        margin
          ? { key: "explain-cac-margin", values: { margin: round2(margin), value: money(cac) } }
          : { key: "explain-cac", values: { value: money(cac) } },
      );
      return {
        ...EMPTY,
        referencePrice: aov,
        avgTicket: round2(aov),
        ltv: round2(ltv),
        targetCac: round2(cac),
        explain,
      };
    }

    case "ladder": {
      const front = primary ?? paidRows[0] ?? null;
      if (!front?.price) return { ...EMPTY, explain };
      explain.push({ key: "explain-reference", values: { value: money(front.price) } });
      // Every other row is a bump/upsell taken by sharePct of buyers.
      const extras = paidRows
        .filter((r) => r !== front)
        .reduce((sum, r) => sum + (r.price ?? 0) * ((positive(r.sharePct) ? r.sharePct! : 0) / 100), 0);
      const perBuyer = front.price + extras;
      explain.push({ key: "explain-ladder", values: { front: money(front.price), value: money(perBuyer) } });
      explain.push({ key: "explain-ltv-simple", values: { ticket: money(perBuyer) } });
      return {
        ...EMPTY,
        referencePrice: front.price,
        avgTicket: round2(perBuyer),
        ltv: round2(perBuyer),
        targetCac: round2(cacFrom(perBuyer)),
        explain,
      };
    }

    case "marketplace": {
      const ticket = num("transactionTicket");
      const take = num("takeRatePct");
      if (!ticket || !take) return { ...EMPTY, explain };
      const revenue = ticket * (take / 100);
      explain.push({ key: "explain-reference", values: { value: money(ticket) } });
      explain.push({ key: "explain-take-rate", values: { rate: round2(take), value: money(revenue) } });
      const perYear = num("transactionsPerYear");
      const ltv = perYear ? revenue * perYear : revenue;
      explain.push(
        perYear
          ? {
              key: "explain-ltv-repurchase",
              values: { ticket: money(revenue), times: round2(perYear), value: money(ltv) },
            }
          : { key: "explain-ltv-simple", values: { ticket: money(revenue) } },
      );
      return {
        ...EMPTY,
        referencePrice: ticket,
        avgTicket: round2(revenue),
        ltv: round2(ltv),
        targetCac: round2(cacFrom(ltv)),
        explain,
      };
    }
  }
}
