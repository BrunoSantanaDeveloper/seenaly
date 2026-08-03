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

import type { PlanCreativeRow } from "../creative-plan/brief";
import {
  type CheckoutType,
  type FunnelModel,
  groupsForModel,
  isTrialFirst,
  type NotApplicableReason,
  type ReadinessEvaluation,
  type ReadinessGroupKey,
  type ReadinessItemKey,
  type ReadinessProfile,
} from "./checklist";
import type { ScanSignals } from "./scan-analyze";

const GROUP_LABEL: Record<ReadinessGroupKey, string> = {
  mensuracao: "Mensuração",
  pagina: "Página",
  checkout: "Checkout",
  ativacao: "Ativação e conversão do trial (pós-login)",
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
  signupFrictionLow: "Cadastro do trial curto (poucos campos)",
  activationDefined: "Momento de ativação (o “aha”) definido e medido",
  trialToPaidTracked: "Conversão trial → pagante é medida",
  upgradePathClear: "Caminho de upgrade claro dentro do produto",
  seoBasics: "Títulos e descrições (title/meta) configurados",
  indexable: "Site indexável no Google (não bloqueado)",
  sitemapRobots: "sitemap.xml e robots.txt publicados",
  structuredData: "Dados estruturados (schema.org)",
  socialProfiles: "Perfis ativos nas redes sociais",
  organicContent: "Publica conteúdo orgânico com regularidade",
  emailCapture: "Captura e-mail/contato do visitante",
  emailFollowup: "Sequência de follow-up por e-mail",
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
  "trial-conversion-unmeasured":
    "a conversão trial → pagante NÃO é medida; como o anúncio otimiza por cadastro, sem isso o algoritmo escala o cadastro mais barato, não o cliente que paga",
};

const FUNNEL_MODEL_LABEL: Record<FunnelModel, string> = {
  direct: "venda direta (anúncio → página → checkout → compra)",
  trial_first: "trial primeiro (anúncio → página → cadastro grátis → uso → contratação DEPOIS do login)",
  lead_first: "captura de lead (anúncio → página → lead → uma pessoa fecha a venda)",
};

/**
 * WHICH FUNNEL THIS BUSINESS RUNS — and therefore which surface each dimension
 * is actually about (migration 0034).
 *
 * This block exists because the readiness layer used to assume one shape (ad →
 * page → checkout → purchase) and silently mis-audited everyone else. The worst
 * case was trial-first: its checkout sits behind authentication, so the page
 * scan can never reach it — and the engine, seeing nothing, produced findings
 * about a public checkout that does not exist, while the real levers (signup
 * friction, activation, trial→paid) had no place in the audit at all.
 *
 * The instructions live here, in generated code, rather than in the assistant's
 * system prompt: they can never drift from the schema, and they never overwrite
 * a prompt an operator tuned in /admin/ai.
 */
export function readinessFunnelModelBlock(profile: ReadinessProfile): string {
  if (!profile.funnelModel) {
    return [
      "O usuário AINDA NÃO INFORMOU o modelo de aquisição.",
      "Não presuma que é venda direta. Se alguma finding depender de onde o pagamento acontece (checkout, meios de pagamento, recuperação de abandono), diga que depende dessa informação e peça-a em missing_data.",
    ].join("\n");
  }

  const lines = [`Modelo de aquisição declarado: ${FUNNEL_MODEL_LABEL[profile.funnelModel]}.`];

  if (isTrialFirst(profile.funnelModel)) {
    lines.push(
      "",
      "CONSEQUÊNCIAS OBRIGATÓRIAS deste modelo (violar qualquer uma produz achado falso):",
      "1. O CHECKOUT FICA ATRÁS DO LOGIN. Nenhum scan alcança essa tela — o scan lê apenas a página pública. O silêncio do scan sobre checkout é ESPERADO e NÃO é achado. NUNCA conclua que o checkout é ruim, longo ou inexistente porque não foi observado.",
      "2. A dimensão `checkout` deste negócio é o fluxo de UPGRADE pós-login (e a ativação que leva até ele), não uma página de compra pública. Audite isso, e diga explicitamente que está falando do pós-login.",
      "3. O que o anúncio otimiza é o CADASTRO (início de trial), não a compra. Logo, cadastro barato não é sucesso: o que fecha a conta é a taxa trial → pagante. Se ela não for medida, esse é o achado mais importante da auditoria, acima de qualquer ajuste de página.",
      "4. O equivalente pré-login do 'checkout curto' aqui é o FORMULÁRIO DE CADASTRO do trial. Fricção nele custa topo de funil inteiro.",
      "5. O CAC real = investimento ÷ clientes PAGANTES, e não ÷ cadastros. Se você só tiver cadastros, diga que o CAC aparente subestima o real e peça a taxa trial → pagante em missing_data.",
      "6. DIMENSÃO FUNIL/RETENÇÃO — leia com atenção, é onde o erro é mais fácil: o FORMULÁRIO DE CADASTRO DO TRIAL JÁ É uma captura de contato. NÃO recomende “implemente um formulário de captura de e-mail na página” como se não existisse nenhum: isso já existe e é a conversão principal. Aqui, captura de contato só faz sentido para quem NÃO se cadastra (ex.: material/lista para quem ainda não quer testar) — e é uma alavanca secundária, não a principal.",
      "7. A sequência de e-mail que decide dinheiro neste modelo NÃO é “boas-vindas e nutrição” genérica: é a régua do TRIAL — ativação nos primeiros dias (levar ao “aha”), lembrete de expiração e convite ao upgrade. Se for recomendar e-mail, recomende ISSO, com o gatilho e o momento.",
      // A consequência que aqui existia prescrevia SEGMENTAÇÃO DE PÚBLICO na
      // Meta (excluir pagantes, separar por estado do trial). É verdadeira e
      // valiosa — mas é configuração dentro do Gerenciador, que esta auditoria
      // não prescreve (migração 0041): pertence ao Plano de Lançamento, onde
      // existe tráfego acumulado para formar esses públicos. O que SOBRA aqui
      // é a parte estrutural: os estados do trial precisam ser distinguíveis,
      // senão nenhuma segmentação futura é possível.
      "8. Para que qualquer segmentação futura exista, os ESTADOS DO TRIAL precisam ser distinguíveis no seu próprio sistema (cadastrou e não ativou; ativou e não contratou; trial expirando; já é pagante). Isso é estrutura de dados do negócio, e é o que você audita. Como esses estados viram público de anúncio é decisão da campanha — não recomende aqui.",
      "9. Achados sobre a estrutura pós-login (fricção do cadastro, momento de ativação, conversão trial → pagante, caminho de upgrade) usam a dimensão `ativacao` — nunca `checkout` nem `funil`. Fora do modelo trial-first, NUNCA use a dimensão `ativacao`.",
      "",
      "Ao gerar related_items para findings deste modelo: as chaves signupFrictionLow, activationDefined, trialToPaidTracked e upgradePathClear pertencem a findings da dimensão `ativacao`.",
    );
  }

  if (profile.funnelModel === "lead_first") {
    lines.push(
      "",
      "CONSEQUÊNCIAS OBRIGATÓRIAS deste modelo:",
      "1. NÃO existe checkout self-service. Não recomende encurtar checkout, adicionar PIX/cartão ou recuperar carrinho — nada disso existe aqui.",
      "2. A conversão que o anúncio otimiza é o LEAD. O que decide o resultado é a qualidade do lead e a velocidade/consistência do follow-up humano.",
      "3. Peça em missing_data a taxa lead → venda e o tempo até o primeiro contato, que é onde esse modelo ganha ou perde dinheiro.",
    );
  }

  return lines.join("\n");
}

const NA_REASON_LABEL: Record<NotApplicableReason, string> = {
  "platform-owns-checkout": "quem controla o checkout é a plataforma de venda, não o usuário",
  "platform-owns-site": "o site é da plataforma, o usuário não tem página própria",
  "no-own-server": "exige servidor próprio, que o usuário não tem nesse formato de venda",
  "sales-closes-deal": "a venda é fechada por uma pessoa; não existe checkout self-service para auditar",
  "no-trial": "este negócio não trabalha com trial, então não há ativação de trial a auditar",
};

/**
 * The declared checklist, group by group — now annotated with what we actually
 * PROVED and what is out of this business's reach.
 *
 * Both annotations exist to stop the engine giving impossible or unfounded
 * advice: "install the CAPI" to someone selling on a marketplace they do not
 * control, or treating an unproven tick as established fact.
 */
export function readinessChecklistBlock(profile: ReadinessProfile, evaluation?: ReadinessEvaluation): string {
  const verified = new Set(evaluation?.verified ?? []);
  const contradicted = new Set(evaluation?.contradicted ?? []);
  const unprovable = new Set(evaluation?.unprovable ?? []);
  const reasons = evaluation?.notApplicableReasons ?? {};

  // Only the groups this funnel model actually has — listing trial activation
  // to a direct-response seller invites findings about a trial that does not exist.
  const sections = groupsForModel(profile.funnelModel).map((group) => {
    const lines = group.items.map((item) => {
      const claimed = profile[item.key];
      const marks: string[] = [];
      const reason = reasons[item.key];
      if (reason) marks.push(`NÃO SE APLICA — ${NA_REASON_LABEL[reason]}`);
      if (verified.has(item.key)) marks.push("VERIFICADO na página");
      // The divergence between what was claimed and what the page shows is the
      // single most valuable signal here — never flatten it into "unverified".
      else if (contradicted.has(item.key))
        marks.push(
          "CONTESTADO — o usuário marcou, mas a leitura da página NÃO encontrou. Trate como ausente e aponte a divergência com respeito",
        );
      else if (claimed && unprovable.has(item.key))
        marks.push(
          "declarado e IMPOSSÍVEL de verificar pela nossa leitura (página renderizada no cliente ou tag dentro do GTM) — a palavra do usuário é o melhor dado disponível; NÃO peça prova por scan",
        );
      else if (claimed) marks.push("declarado, NÃO verificado");
      else marks.push("NÃO CONFIRMADO");
      return `- [${claimed ? "x" : " "}] ${ITEM_LABEL[item.key]} (${marks.join("; ")})`;
    });
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

/** One persisted scan (migration 0029) as the engine needs to see it. */
export interface ScanRecord {
  requestedUrl: string;
  finalUrl: string | null;
  ok: boolean;
  statusCode: number | null;
  error: string | null;
  createdAt: string;
  signals: ScanSignals | null;
}

const yesNo = (value: boolean) => (value ? "sim" : "NÃO");

/**
 * The OBSERVED half of readiness — what the scanner actually found on the page,
 * as opposed to what the user declared. This is trust-1 evidence: measured, not
 * reported.
 *
 * Its three honest limits are stated to the engine, because each one could
 * otherwise turn into a confidently wrong finding:
 *  - a client-rendered page hides its tags from a raw HTML fetch;
 *  - CAPI is server-side and is INVISIBLE to any scan, ever;
 *  - the robots.txt reading is an approximation, not a full grammar.
 */
export function readinessScanBlock(scan: ScanRecord | null, funnelModel: FunnelModel | null = null): string {
  // Stated whether or not a scan ran: on a trial-first funnel the checkout is
  // behind authentication, so its absence from the scan is a property of the
  // model, never evidence about the checkout.
  const authWallLimit = isTrialFirst(funnelModel)
    ? "- O checkout deste negócio fica ATRÁS DO LOGIN e é INALCANÇÁVEL por qualquer scan. Não afirme nada sobre ele a partir deste bloco: a ausência de sinais de checkout aqui é esperada e não é achado."
    : null;

  if (!scan) {
    return [
      "Nenhum scan técnico foi executado. Não conclua nada sobre SEO técnico, indexabilidade ou pixels a partir da ausência de scan — se for relevante, peça o scan em missing_data.",
      authWallLimit,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (!scan.ok || !scan.signals) {
    return [
      `O scan técnico FALHOU em ${scan.requestedUrl} (motivo: ${scan.error ?? "desconhecido"}${scan.statusCode ? `, HTTP ${scan.statusCode}` : ""}).`,
      "Uma página que não responde ao nosso rastreador provavelmente também não responde bem a rastreadores de busca e a quem clica no anúncio — trate isso como um achado real da dimensão pagina/descoberta, mas NÃO conclua nada sobre as tags da página, que não puderam ser lidas.",
      authWallLimit,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const s = scan.signals;
  const lines: string[] = [
    `Página escaneada: ${scan.finalUrl ?? scan.requestedUrl} (HTTP ${scan.statusCode ?? "?"}, em ${new Date(scan.createdAt).toLocaleString("pt-BR")})`,
    `- HTTPS: ${yesNo(s.https)}`,
    `- Title: ${s.seo.title ? `"${s.seo.title}" (${s.seo.titleLength} caracteres)` : "AUSENTE"}`,
    `- Meta description: ${s.seo.metaDescription ? `"${s.seo.metaDescription}" (${s.seo.metaDescriptionLength} caracteres)` : "AUSENTE"}`,
    `- Canonical: ${s.seo.canonical ?? "ausente"}`,
    `- Idioma declarado (html lang): ${s.seo.lang ?? "ausente"}`,
    `- Meta viewport (mobile): ${yesNo(s.seo.hasViewport)}`,
    `- H1: ${s.seo.h1Count} no total${s.seo.firstH1 ? ` — primeiro: "${s.seo.firstH1}"` : ""}`,
    `- Open Graph: title=${yesNo(s.seo.ogTitle)}, description=${yesNo(s.seo.ogDescription)}, image=${yesNo(s.seo.ogImage)}`,
    `- Dados estruturados (JSON-LD): ${s.seo.structuredDataTypes.length > 0 ? s.seo.structuredDataTypes.join(", ") : "nenhum"}`,
    `- Imagens sem alt: ${s.seo.imagesMissingAlt} de ${s.seo.imagesTotal}`,
    `- robots.txt: ${s.discovery.robotsTxt}${s.discovery.robotsDisallowsAll ? " — BLOQUEIA TODOS OS RASTREADORES (Disallow: /)" : ""}`,
    `- sitemap.xml: ${s.discovery.sitemapXml}; referenciado no robots.txt: ${yesNo(s.discovery.sitemapReferencedInRobots)}`,
    `- Pixels detectados no HTML: Meta Pixel=${yesNo(s.tracking.metaPixel)}, GA4=${yesNo(s.tracking.ga4)}, GTM=${yesNo(s.tracking.gtm)}, TikTok=${yesNo(s.tracking.tiktokPixel)}`,
    `- Peso do HTML: ${Math.round(s.bytes / 1024)} KB; tempo da nossa requisição: ${s.fetchMs ?? "?"} ms`,
  ];

  // Official speed measurement (PageSpeed Insights), when it exists. This IS
  // Core Web Vitals — the one performance evidence the caveat below does not
  // apply to. Field p75 (real users) preferred over lab.
  if (s.psi?.status === "ok") {
    const lcp = s.psi.field?.lcpMs ?? s.psi.lab.lcpMs;
    const lcpSource = s.psi.field?.lcpMs != null ? "campo/CrUX p75, usuários reais" : "laboratório/Lighthouse";
    lines.push(
      `- Velocidade OFICIAL (PageSpeed Insights, mobile): LCP=${lcp != null ? `${Math.round(lcp)} ms` : "sem dado"} (${lcpSource}; bom ≤ 2500 ms, ruim > 4000 ms), score de performance=${s.psi.performanceScore ?? "sem dado"}/100, CLS=${s.psi.field?.cls ?? s.psi.lab.cls ?? "sem dado"}. Isto É Core Web Vitals oficial — pode ser citado como evidência de performance.`,
    );
  } else if (s.psi?.status === "failed") {
    lines.push(
      "- A medição oficial de velocidade (PageSpeed) FALHOU nesta leitura. Não conclua nada sobre a velocidade real da página.",
    );
  }

  if (s.seo.noindex) {
    lines.push(
      "- ATENÇÃO CRÍTICA: a página declara NOINDEX. Ela está sendo removida dos resultados de busca. Isso não afeta o anúncio pago, mas anula qualquer aquisição orgânica — é um achado de alta prioridade na dimensão descoberta.",
    );
  }

  lines.push(
    "",
    "LIMITES DESTE SCAN (respeite-os; violar isto produz achado falso):",
    s.jsRenderedLikely
      ? `- A página trouxe pouquíssimo texto no HTML inicial (${s.visibleTextLength} caracteres), o que indica renderização no cliente (SPA). As tags acima podem existir e serem injetadas por JavaScript. NÃO afirme que estão ausentes — diga que não aparecem no HTML inicial, o que também afeta rastreadores, e peça confirmação.`
      : "- A página trouxe conteúdo no HTML inicial, então a leitura das tags é confiável.",
    "- A API de Conversões (CAPI) é server-side e é INVISÍVEL para qualquer scan. Nunca conclua que ela existe ou não existe a partir deste bloco; use apenas o checklist declarado.",
    ...(s.tracking.gtm && !s.tracking.metaPixel
      ? [
          "- O Google Tag Manager ESTÁ presente e o Meta Pixel costuma ser carregado por dentro do contêiner, invisível a esta leitura. 'Meta Pixel=NÃO' acima significa apenas 'não visto no HTML inicial', NUNCA 'ausente'. Se o usuário declarou o Pixel instalado, trate como declarado — jamais como contestado.",
        ]
      : []),
    "- A leitura do robots.txt é aproximada (não implementa a gramática completa). Use-a para levantar a questão, não como veredito absoluto.",
    "- O tempo de requisição acima é medido do nosso servidor e NÃO é Core Web Vitals nem experiência real de usuário. Não o apresente como métrica de performance oficial.",
  );
  if (authWallLimit) lines.push(authWallLimit);

  return lines.join("\n");
}

/** Real organic activity tied to this product (migration 0024 tables). */
export interface OrganicPresence {
  /** Content pieces linked to this product. */
  contentCount: number;
  /** Publication date of the most recent piece, when known. */
  latestPublishedAt: string | null;
  platforms: string[];
  /** An Organic Growth Review already exists for this product. */
  hasReview: boolean;
  reviewPeriodEnd: string | null;
  reviewInsufficientData: boolean | null;
}

/**
 * The organic side of DISCOVERY, from real data instead of a checkbox.
 *
 * docs/PRODUCT.md treats Organic Growth as a PRE-CONDITION of paid acquisition,
 * not a separate app — being findable outside the ad reduces dependence on paid
 * media and lowers acquisition cost over time. This block is how that stops
 * being a slogan: the readiness engine sees whether the product actually has
 * organic content, on which platforms, and whether a Review exists.
 *
 * Two guardrails, both invariants of the Organic module:
 *  - never rank raw metrics across networks as equivalents;
 *  - never claim a post caused a sale. Presence is context, not attribution.
 */
export function readinessOrganicBlock(presence: OrganicPresence): string {
  if (presence.contentCount === 0) {
    return [
      "Nenhum conteúdo orgânico vinculado a este produto no Seenaly.",
      "Isso NÃO significa que o negócio não publica — significa que não há dado importado aqui. Não afirme que a pessoa não faz orgânico; trate como dado ausente e, se for relevante para a dimensão descoberta, peça a importação em missing_data.",
    ].join("\n");
  }

  const lines = [
    `- Conteúdos vinculados a este produto: ${presence.contentCount}`,
    `- Plataformas: ${presence.platforms.length > 0 ? presence.platforms.join(", ") : "não informadas"}`,
    `- Publicação mais recente: ${presence.latestPublishedAt ? new Date(presence.latestPublishedAt).toLocaleDateString("pt-BR") : "sem data"}`,
    presence.hasReview
      ? `- Existe um Organic Growth Review${presence.reviewPeriodEnd ? ` até ${new Date(presence.reviewPeriodEnd).toLocaleDateString("pt-BR")}` : ""}${presence.reviewInsufficientData ? " (declarado com dados insuficientes)" : ""}.`
      : "- Ainda não existe um Organic Growth Review para este produto.",
    "",
    "COMO USAR ISTO: presença orgânica reduz a dependência de mídia paga e barateia a aquisição no médio prazo — é contexto da dimensão descoberta. NUNCA compare métricas de redes diferentes como equivalentes e NUNCA afirme que um conteúdo causou uma venda. Aqui você tem presença, não atribuição.",
  ];
  return lines.join("\n");
}

/**
 * The creative library as the READINESS engine needs to see it: presence and
 * coverage, never performance (docs/PRODUCT.md phase 8 feeds the `midia`
 * dimension). Framed like readinessOrganicBlock — counts, the honest
 * missing-data posture, and the two invariants.
 *
 * Also carries the MESSAGE MATCH input (S4): the ad-side promise is NOT a
 * declared intake field — it lives on the creatives themselves
 * (creatives.promise / hook). While no creative carries one, the honest state
 * is "the ad promise does not exist yet", and the door is the Creative Test
 * Plan — never a hypothetical promise typed into a form.
 */
export function readinessCreativesBlock(creatives: PlanCreativeRow[]): string {
  if (creatives.length === 0) {
    return [
      "Nenhum criativo registrado na biblioteca para este produto.",
      "Isso é DADO AUSENTE, não prova de que criativos não existem. Para a dimensão midia, não afirme que o usuário não tem criativos; trate como não registrado — a porta concreta é o Plano de Teste Criativo, e quando for relevante peça o registro/plano em missing_data.",
    ].join("\n");
  }

  const distinct = (values: (string | null | undefined)[]) => new Set(values.filter(Boolean)).size;
  const byStatus = new Map<string, number>();
  for (const creative of creatives) byStatus.set(creative.status, (byStatus.get(creative.status) ?? 0) + 1);
  const bySource = new Map<string, number>();
  for (const creative of creatives) bySource.set(creative.source, (bySource.get(creative.source) ?? 0) + 1);

  const lines = [
    `- Criativos registrados: ${creatives.length}`,
    `- Por status: ${[...byStatus.entries()].map(([status, count]) => `${status}=${count}`).join(", ")}`,
    `- Por origem: ${[...bySource.entries()].map(([source, count]) => `${source}=${count}`).join(", ")}`,
    `- Cobertura de tags: ${distinct(creatives.map((c) => c.angle))} ângulos distintos, ${distinct(creatives.map((c) => c.hook))} ganchos distintos, ${distinct(creatives.map((c) => c.proof_type))} tipos de prova distintos`,
    `- Com publicação orgânica vinculada: ${creatives.filter((c) => c.organic_count > 0).length}`,
    "",
    "COMO USAR ISTO: presença, nunca desempenho. NUNCA compare métricas de redes diferentes como equivalentes e NUNCA afirme que um criativo causou venda. Use estas contagens como evidência product_context da dimensão midia (cobertura mínima de ângulos antes da 1ª campanha).",
  ];

  // MESSAGE MATCH: the ad side, from real registered creatives.
  const promises = [
    ...new Set(
      creatives
        .flatMap((creative) => [creative.promise, creative.hook])
        .filter((value): value is string => Boolean(value)),
    ),
  ].slice(0, 10);
  if (promises.length > 0) {
    lines.push(
      "",
      "MESSAGE MATCH — promessas/ganchos já registrados nos criativos:",
      ...promises.map((promise) => `- ${promise}`),
      "Compare-as com o H1/title OBSERVADO no scan e com a promessa principal do produto; divergência entre a promessa do anúncio e a da página é achado da dimensão pagina, citando os dois lados como evidência. Sem H1/title observado, não há o que comparar — não invente o lado da página.",
    );
  } else {
    lines.push(
      "",
      "MESSAGE MATCH: a promessa do anúncio ainda não existe registrada (nenhum criativo carrega promessa/gancho) — não conclua nada sobre message match; se relevante, aponte o Plano de Teste Criativo em missing_data.",
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
    "prontidão antes de investir em tráfego pago: instalação de pixel e API de Conversões, escolha do evento de otimização, fase de aprendizado e volume mínimo, fricção de checkout e abandono, meios de pagamento PIX, equação de valor e garantia, prova social, message match entre anúncio e página, velocidade e experiência mobile, captura de contato e régua de follow-up, fundamentos de SEO e descoberta orgânica, criativos mínimos por ângulo antes da primeira campanha";
  return hasPage ? base : `${base}, o que precisa existir em uma página de vendas antes do primeiro anúncio`;
}
