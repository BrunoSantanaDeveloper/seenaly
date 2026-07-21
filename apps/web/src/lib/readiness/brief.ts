/**
 * Serializes the declared readiness profile for the engine.
 *
 * Engine-facing text is pt-BR by contract (the assistant's system prompt is
 * pt-BR); these labels are not UI strings and do not go through next-intl —
 * same convention as `lib/diagnosis/product-brief.ts`.
 *
 * The crucial detail: an unchecked item is rendered as "NÃO CONFIRMADO", never
 * as "no". The user may simply not know, and the prompt forbids the engine from
 * asserting absence from silence.
 */

import {
  type CheckoutType,
  READINESS_GROUPS,
  type ReadinessEvaluation,
  type ReadinessGroupKey,
  type ReadinessItemKey,
  type ReadinessProfile,
} from "./checklist";

const GROUP_LABEL: Record<ReadinessGroupKey, string> = {
  mensuracao: "Mensuração",
  pagina: "Página",
  checkout: "Checkout",
  descoberta: "Descoberta (SEO e orgânico)",
  funil: "Funil e retenção",
};

const ITEM_LABEL: Record<ReadinessItemKey, string> = {
  pixelInstalled: "Pixel da Meta instalado no site",
  capiInstalled: "API de Conversões (CAPI) configurada",
  conversionEventTested: "Evento de conversão testado e disparando",
  analyticsInstalled: "Analytics instalado (GA4 ou equivalente)",
  pageHasProof: "Prova social na página (depoimentos, casos, números)",
  pageMobileTested: "Página testada no celular",
  pageFast: "Página carrega rápido",
  hasGuarantee: "Garantia declarada na oferta",
  paymentPix: "Aceita PIX",
  paymentCard: "Aceita cartão de crédito",
  checkoutShort: "Checkout curto (poucos campos/etapas)",
  abandonedRecovery: "Recuperação de checkout abandonado",
  seoBasics: "Títulos e descrições (title/meta) configurados",
  indexable: "Site indexável no Google (não bloqueado)",
  sitemapRobots: "sitemap.xml e robots.txt publicados",
  structuredData: "Dados estruturados (schema.org)",
  socialProfiles: "Perfis ativos nas redes sociais",
  organicContent: "Publica conteúdo orgânico com regularidade",
  emailCapture: "Captura e-mail/contato do visitante",
  emailFollowup: "Sequência de follow-up por e-mail",
  remarketingAudience: "Público de remarketing configurado",
};

const CHECKOUT_TYPE_LABEL: Record<CheckoutType, string> = {
  own: "checkout próprio",
  platform: "plataforma de infoproduto (Hotmart/Kiwify/Eduzz ou similar)",
  link: "link de pagamento",
  none: "NÃO HÁ como receber pagamento hoje",
};

const BLOCKER_LABEL: Record<string, string> = {
  "no-page": "não há página de destino cadastrada",
  "no-measurement": "não há Pixel nem CAPI confirmados — não é possível medir conversão",
  "event-untested": "o evento de conversão nunca foi confirmado como disparando",
  "no-checkout": "não há como receber pagamento",
  "no-payment": "nenhum meio de pagamento confirmado (nem PIX nem cartão)",
  "no-price": "o produto não tem preço definido — sem ele não existe teto de CAC",
};

/** The declared checklist, group by group. */
export function readinessChecklistBlock(profile: ReadinessProfile): string {
  const sections = READINESS_GROUPS.map((group) => {
    const lines = group.items.map(
      (item) =>
        `- [${profile[item.key] ? "x" : " "}] ${ITEM_LABEL[item.key]}${profile[item.key] ? "" : " (NÃO CONFIRMADO)"}`,
    );
    return [`### ${GROUP_LABEL[group.key]}`, ...lines].join("\n");
  });

  const extras: string[] = [];
  extras.push(
    profile.checkoutType
      ? `- Onde recebe pagamento: ${CHECKOUT_TYPE_LABEL[profile.checkoutType]}`
      : "- Onde recebe pagamento: NÃO INFORMADO",
  );
  if (profile.hasGuarantee && profile.guaranteeDays) {
    extras.push(`- Prazo da garantia: ${profile.guaranteeDays} dias`);
  }

  return [...sections, "", ...extras].join("\n");
}

/**
 * The deterministic signals we already computed locally. Handing them to the
 * engine keeps its verdict consistent with what the user is looking at on
 * screen — the two must never disagree about whether a blocker exists.
 */
export function readinessSignalsBlock(evaluation: ReadinessEvaluation): string {
  const lines = [
    `- Itens confirmados: ${evaluation.confirmed} de ${evaluation.total}`,
    ...evaluation.byGroup.map((group) => `- ${GROUP_LABEL[group.key]}: ${group.confirmed}/${group.total} confirmados`),
  ];
  if (evaluation.blockers.length > 0) {
    lines.push(
      `- BLOQUEADORES detectados pela verificação local: ${evaluation.blockers
        .map((blocker) => BLOCKER_LABEL[blocker] ?? blocker)
        .join("; ")}`,
    );
    lines.push(
      "  Estes bloqueadores foram calculados de forma determinística e já estão visíveis para o usuário. Trate-os como verdadeiros e inclua-os em blocking, com a ação para resolver cada um.",
    );
  } else {
    lines.push("- Nenhum bloqueador detectado pela verificação local.");
  }
  if (evaluation.untouched) {
    lines.push(
      "- ATENÇÃO: o usuário não preencheu o checklist. Não conclua que nada existe; baseie-se no contexto do produto e peça a confirmação do checklist em missing_data.",
    );
  }
  return lines.join("\n");
}

/**
 * What we ask the knowledge base. Spans the whole pre-spend structure — the
 * playbook (CRO/checkout/offer) carries most of it, and the Meta corpus carries
 * the measurement rules (pixel/CAPI, optimization event, learning phase).
 */
export function readinessRetrievalQuery(hasPage: boolean): string {
  const base =
    "prontidão antes de investir em tráfego pago: instalação de pixel e API de Conversões, escolha do evento de otimização, fase de aprendizado e volume mínimo, fricção de checkout e abandono, meios de pagamento PIX, equação de valor e garantia, prova social, message match entre anúncio e página, velocidade e experiência mobile, captura de contato e remarketing, fundamentos de SEO e descoberta orgânica";
  return hasPage ? base : `${base}, o que precisa existir em uma página de vendas antes do primeiro anúncio`;
}
