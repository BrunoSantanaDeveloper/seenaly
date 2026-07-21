/**
 * The product context block — the heart of every brief (docs/PRODUCT.md #1).
 *
 * Shared by both engine modes: the campaign diagnosis (`/diagnosis`) and the
 * readiness verdict (`/readiness`). Both reason about the same offer, so they
 * must see the same description of it — a second copy would drift.
 *
 * Engine-facing text is pt-BR by contract (the assistants' system prompts are
 * pt-BR); these labels are not UI strings and do not go through next-intl.
 */

import type { ProductWithChildren } from "@/app/(dashboard)/products/types";

export const line = (label: string, value: unknown): string | null =>
  value === null || value === undefined || value === "" ? null : `- ${label}: ${value}`;

export const PERIOD_LABEL: Record<string, string> = {
  weekly: "semanal",
  monthly: "mensal",
  quarterly: "trimestral",
  semiannual: "semestral",
  annual: "anual",
  one_time: "pagamento único",
};

export function productContextBlock(product: ProductWithChildren): string {
  const rows = [
    line("Produto", product.name),
    line("Descrição", product.description),
    line("Moeda", product.currency),
    line("Preço", product.price),
    line("Custo unitário", product.unitCost),
    line("Margem (%)", product.marginPct),
    line("Ticket médio", product.avgTicket),
    line("LTV", product.ltv),
    line("CAC máximo aceitável", product.targetCac),
    line("Orçamento mensal", product.monthlyBudget),
    line("Tipo de conversão desejada", product.conversionType),
    line("Etapa do funil", product.funnelStage),
    line("Público-alvo", product.audience),
    line("Promessa principal", product.mainPromise),
    line("Página de destino", product.landingPageUrl),
    line("Taxa de conversão da página (%)", product.landingConversionRate),
    line("Evento de otimização", product.optimizationEvent),
    line("Observações", product.notes),
  ].filter(Boolean);

  // How the offer is charged — lets the engine reason about period (annual vs
  // monthly), payback, and lead ≠ sale instead of guessing from one price.
  if (product.pricingModel) {
    rows.push(`- Modelo de cobrança: ${product.pricingModel}`);
  }
  if (product.plans?.length) {
    const plans = product.plans
      .filter((plan) => plan.price != null || plan.name)
      .map((plan) => {
        const parts = [
          plan.name || "(sem nome)",
          plan.price != null ? `${plan.price}` : null,
          plan.period ? (PERIOD_LABEL[plan.period] ?? plan.period) : null,
          plan.quantity != null ? `${plan.quantity} un.` : null,
          plan.sharePct != null ? `${plan.sharePct}% dos clientes` : null,
          plan.isPrimary ? "ANUNCIADO" : null,
        ].filter(Boolean);
        return parts.join(" · ");
      });
    if (plans.length > 0) rows.push(`- Planos/pacotes: ${plans.join(" | ")}`);
  }
  const pricingInputEntries = Object.entries(product.pricingInputs ?? {}).filter(([, value]) => value != null);
  if (pricingInputEntries.length > 0) {
    rows.push(`- Parâmetros de cobrança: ${pricingInputEntries.map(([key, value]) => `${key}=${value}`).join("; ")}`);
  }

  if (product.objections.length > 0) {
    rows.push(`- Objeções: ${product.objections.join("; ")}`);
  }
  if (product.proofs.length > 0) {
    rows.push(
      `- Provas disponíveis: ${product.proofs.map((p) => (p.kind ? `${p.kind}: ${p.content}` : p.content)).join("; ")}`,
    );
  }
  return rows.join("\n");
}
