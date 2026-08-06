/**
 * Deterministic, LLM-proof arithmetic for the Launch Plan engine
 * (docs/PRODUCT.md phase 9 — "o piso de orçamento é aritmética, não opinião").
 *
 * Every other engine in this product lets the model reason freely inside a
 * cited-evidence contract. This one number is different: the daily budget
 * floor and the optimization event's evidentiary basis are FACTS derivable
 * from data already in the database, not judgement calls — and the whole
 * point of phase 9 is that an iniciante gets a computed answer, not a vibe.
 * So both are computed HERE, in pure functions with zero LLM involvement, and
 * the server action hands the result to the model as authoritative brief
 * text ("NÃO recalcule"); `schema.ts`'s sanitizer then overwrites whatever
 * the model wrote in those fields regardless, the same way the creative-plan
 * sanitizer overwrites an invented taxonomy slug rather than trusting it.
 *
 * Pure — no I/O, no server-only imports — so scripts/test-launch-plan.mts can
 * import it under plain tsx, mirroring lib/creative-plan and lib/readiness.
 */

/** Meta's own learning-phase guidance (trust 1): ~50 optimization events per
 *  ad set within 7 days is what lets the delivery system exit "aprendizado"
 *  and stabilize. This is the one number the whole floor is built from. */
export const LEARNING_PHASE_EVENTS = 50;
export const LEARNING_PHASE_DAYS = 7;

export type OptimizationEventBasis = "proved" | "declared" | "missing";

export interface OptimizationEventResolution {
  event: string;
  basis: OptimizationEventBasis;
  /** Server-authored explanation of the basis — the model MAY quote this in
   *  its rationale, but the classification itself is never the model's call. */
  note: string;
}

/**
 * Which event to optimize for, and how strong the evidence behind it is.
 *
 * Three honest tiers, built from exactly what the readiness layer can (and
 * cannot) prove — `conversionEventTested` is a `declared`-tier checklist item
 * by construction (lib/readiness/checklist.ts): no page scan can ever see
 * whether a specific conversion event actually fired. So "proved" here means
 * the STRONGEST evidence this system can produce today — the base Pixel
 * confirmed present by the scan, plus the user's own attestation that the
 * event was tested — never literal proof that the event fires on every sale.
 * That ceiling is stated in the note, not hidden.
 */
export function resolveOptimizationEvent(input: {
  /** products.optimization_event, as declared in the product context form. */
  declaredEvent: string | null;
  /** product_readiness.conversion_event_tested — false when no profile exists. */
  conversionEventTested: boolean;
  /** Whether the readiness scan proved the Meta Pixel tag present on the page. */
  pixelProved: boolean;
  /** Whether a readiness profile exists at all for this product. */
  hasReadiness: boolean;
}): OptimizationEventResolution {
  const declared = input.declaredEvent?.trim() || "";

  if (!input.hasReadiness || !input.conversionEventTested) {
    return {
      event: declared || "Compra (suposição — nenhum evento declarado no contexto do produto)",
      basis: "missing",
      note: input.hasReadiness
        ? 'Existe um perfil de Prontidão para este produto, mas o item "evento de conversão testado" não foi confirmado nele — este evento é uma suposição, não um fato provado.'
        : "Não existe um veredito de Prontidão para este produto — este evento é uma suposição, não um fato provado. Rodar a Prontidão primeiro provaria (ou refutaria) isso de graça, antes de qualquer gasto.",
    };
  }

  if (input.pixelProved) {
    return {
      event: declared || "Compra",
      basis: "proved",
      note: "O scan da Prontidão confirmou o Pixel na página e você declarou ter testado este evento — a base mais forte disponível hoje. O disparo do evento em si permanece uma declaração: nenhum scan de página consegue ver um evento disparar, apenas a tag do Pixel presente.",
    };
  }

  return {
    event: declared || "Compra",
    basis: "declared",
    note: "Você declarou ter testado este evento, mas o scan da Prontidão não confirmou o Pixel na página (ou nunca rodou) — trate como declarado, não provado.",
  };
}

export interface LearningPhaseFloorInput {
  /** products.target_cac. Required to cost a purchase-like event. */
  targetCac: number | null;
  /** products.monthly_budget. Required to derive how many ad sets fit. */
  monthlyBudget: number | null;
  /** ISO 4217 code for display, e.g. "BRL". Defaults to BRL when absent. */
  currency: string | null;
  eventBasis: OptimizationEventBasis;
  eventLabel: string;
}

export interface LearningPhaseFloorResult {
  /** Whether AT LEAST ONE ad set can be funded to the learning-phase floor. */
  viable: boolean;
  costPerEvent: number | null;
  dailyFloorPerAdset: number | null;
  adsetCount: number;
  /** The open arithmetic, one readable line per step — goes verbatim into the
   *  UI and the briefing. Never re-derived by the model. */
  arithmetic: string[];
  /** Product-context fields the math could not proceed without. */
  missing: string[];
  /** Filled only when !viable: what would need to change to make it viable. */
  whatWouldChange: string;
}

/** Only an event that IS the sale can be costed directly from target_cac — a
 *  shallower event (checkout iniciado, cadastro, trial) needs a conversion
 *  rate FROM that event TO the sale, which this product does not yet collect
 *  (docs/PRODUCT.md's own "mapa de superfícies" open study). Guessing that
 *  rate would be exactly the invented benchmark the product's law forbids, so
 *  it becomes `missing` instead — never a chute. */
const PURCHASE_EVENT_PATTERN = /compra|purchase|venda|assinatura|subscri|pagamento/i;

function formatCurrency(value: number, currency: string | null): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * The learning-phase daily budget floor per ad set, the number of ad sets the
 * declared monthly budget can fund to that floor, and the fully-expanded
 * arithmetic behind both — docs/PRODUCT.md phase 9's "a conta aberta".
 */
export function learningPhaseFloor(input: LearningPhaseFloorInput): LearningPhaseFloorResult {
  const arithmetic: string[] = [
    `A fase de aprendizado do Meta pede ~${LEARNING_PHASE_EVENTS} eventos de otimização por conjunto de anúncios em ${LEARNING_PHASE_DAYS} dias para estabilizar a entrega (documentação oficial, trust 1).`,
  ];
  const missing: string[] = [];

  const isPurchaseLike = PURCHASE_EVENT_PATTERN.test(input.eventLabel);
  let costPerEvent: number | null = null;
  if (!isPurchaseLike) {
    missing.push(
      `taxa de conversão de "${input.eventLabel}" até a compra (sem ela não é possível derivar o custo por evento de um evento que não é a própria venda)`,
    );
  } else if (input.targetCac == null) {
    missing.push("CAC alvo (target_cac) no contexto do produto");
  } else {
    costPerEvent = input.targetCac;
    arithmetic.push(
      `Custo por evento (evento de compra) ≈ CAC alvo declarado = ${formatCurrency(costPerEvent, input.currency)}.`,
    );
  }

  let dailyFloorPerAdset: number | null = null;
  if (costPerEvent != null) {
    dailyFloorPerAdset = Math.ceil((costPerEvent * LEARNING_PHASE_EVENTS) / LEARNING_PHASE_DAYS);
    arithmetic.push(
      `Piso diário por conjunto = ${LEARNING_PHASE_EVENTS} eventos ÷ ${LEARNING_PHASE_DAYS} dias × ${formatCurrency(costPerEvent, input.currency)} ≈ ${formatCurrency(dailyFloorPerAdset, input.currency)}/dia.`,
    );
  }

  if (input.monthlyBudget == null) missing.push("orçamento mensal (monthly_budget) no contexto do produto");

  let adsetCount = 0;
  let viable = false;
  let whatWouldChange = "";
  if (dailyFloorPerAdset != null && input.monthlyBudget != null) {
    const dailyBudget = input.monthlyBudget / 30;
    arithmetic.push(
      `Orçamento mensal declarado ${formatCurrency(input.monthlyBudget, input.currency)} ÷ 30 dias ≈ ${formatCurrency(dailyBudget, input.currency)}/dia.`,
    );
    adsetCount = Math.floor(dailyBudget / dailyFloorPerAdset);
    if (adsetCount >= 1) {
      viable = true;
      arithmetic.push(
        `${formatCurrency(dailyBudget, input.currency)} ÷ ${formatCurrency(dailyFloorPerAdset, input.currency)} = ${adsetCount} conjunto(s) capaz(es) de sair da fase de aprendizado.`,
      );
    } else {
      arithmetic.push(
        `${formatCurrency(dailyBudget, input.currency)}/dia é menor que o piso de um único conjunto (${formatCurrency(dailyFloorPerAdset, input.currency)}) — nenhum conjunto sairia da fase de aprendizado com este orçamento.`,
      );
      whatWouldChange = `Aumente o orçamento mensal para pelo menos ${formatCurrency(dailyFloorPerAdset * 30, input.currency)}, escolha um evento de otimização mais raso e com custo conhecido, ou eleve o CAC alvo declarado.`;
    }
  }

  if (missing.length > 0 && !whatWouldChange) {
    whatWouldChange = `Preencha no contexto do produto: ${missing.join("; ")}.`;
  }

  return { viable, costPerEvent, dailyFloorPerAdset, adsetCount, arithmetic, missing, whatWouldChange };
}
