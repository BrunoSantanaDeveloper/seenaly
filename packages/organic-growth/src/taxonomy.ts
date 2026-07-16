import type { FunnelStage, NarrativeType, OrganicClassificationOutput, SocialPlatform, StrategicIntent } from "./types";

export const ORGANIC_TAXONOMY_VERSION = "organic-growth-taxonomy/v1" as const;

export const SOCIAL_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "linkedin",
] as const satisfies readonly SocialPlatform[];

export const FUNNEL_STAGES = [
  "descoberta",
  "conscientizacao_do_problema",
  "educacao",
  "consideracao",
  "demonstracao",
  "comparacao",
  "prova",
  "quebra_de_objecao",
  "oferta",
  "urgencia",
  "conversao",
  "retencao",
  "indicacao",
  "comunidade",
] as const satisfies readonly FunnelStage[];

export const STRATEGIC_INTENTS = [
  "gerar_alcance",
  "gerar_autoridade",
  "gerar_confianca",
  "gerar_conversa",
  "gerar_salvamento",
  "gerar_compartilhamento",
  "gerar_visita_ao_perfil",
  "gerar_clique",
  "gerar_lead",
  "gerar_venda",
  "recuperar_demanda",
  "apoiar_remarketing",
] as const satisfies readonly StrategicIntent[];

export const NARRATIVE_TYPES = [
  "historia",
  "tutorial",
  "demonstracao",
  "bastidores",
  "opiniao",
  "lista",
  "comparacao",
  "estudo_de_caso",
  "depoimento",
  "transformacao",
  "erro_comum",
  "mito",
  "tendencia",
  "resposta_a_comentario",
  "conteudo_de_fundador",
  "oferta_direta",
] as const satisfies readonly NarrativeType[];

/** Stable public names consumed by product surfaces. */
export const ORGANIC_FUNNEL_STAGES = FUNNEL_STAGES;
export const ORGANIC_STRATEGIC_INTENTS = STRATEGIC_INTENTS;
export const ORGANIC_NARRATIVE_TYPES = NARRATIVE_TYPES;

export const FUNNEL_STAGE_LABELS: Readonly<Record<FunnelStage, string>> = {
  descoberta: "Descoberta",
  conscientizacao_do_problema: "Conscientização do problema",
  educacao: "Educação",
  consideracao: "Consideração",
  demonstracao: "Demonstração",
  comparacao: "Comparação",
  prova: "Prova",
  quebra_de_objecao: "Quebra de objeção",
  oferta: "Oferta",
  urgencia: "Urgência",
  conversao: "Conversão",
  retencao: "Retenção",
  indicacao: "Indicação",
  comunidade: "Comunidade",
};

export const STRATEGIC_INTENT_LABELS: Readonly<Record<StrategicIntent, string>> = {
  gerar_alcance: "Gerar alcance",
  gerar_autoridade: "Gerar autoridade",
  gerar_confianca: "Gerar confiança",
  gerar_conversa: "Gerar conversa",
  gerar_salvamento: "Gerar salvamento",
  gerar_compartilhamento: "Gerar compartilhamento",
  gerar_visita_ao_perfil: "Gerar visita ao perfil",
  gerar_clique: "Gerar clique",
  gerar_lead: "Gerar lead",
  gerar_venda: "Gerar venda",
  recuperar_demanda: "Recuperar demanda",
  apoiar_remarketing: "Apoiar remarketing",
};

export const NARRATIVE_TYPE_LABELS: Readonly<Record<NarrativeType, string>> = {
  historia: "História",
  tutorial: "Tutorial",
  demonstracao: "Demonstração",
  bastidores: "Bastidores",
  opiniao: "Opinião",
  lista: "Lista",
  comparacao: "Comparação",
  estudo_de_caso: "Estudo de caso",
  depoimento: "Depoimento",
  transformacao: "Transformação",
  erro_comum: "Erro comum",
  mito: "Mito",
  tendencia: "Tendência",
  resposta_a_comentario: "Resposta a comentário",
  conteudo_de_fundador: "Conteúdo de fundador",
  oferta_direta: "Oferta direta",
};

const platformSet = new Set<string>(SOCIAL_PLATFORMS);
const funnelStageSet = new Set<string>(FUNNEL_STAGES);
const strategicIntentSet = new Set<string>(STRATEGIC_INTENTS);
const narrativeTypeSet = new Set<string>(NARRATIVE_TYPES);

export function normalizeTaxonomyValue(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function isSocialPlatform(value: string): value is SocialPlatform {
  return platformSet.has(value);
}

export function isFunnelStage(value: string): value is FunnelStage {
  return funnelStageSet.has(value);
}

export function isStrategicIntent(value: string): value is StrategicIntent {
  return strategicIntentSet.has(value);
}

export function isNarrativeType(value: string): value is NarrativeType {
  return narrativeTypeSet.has(value);
}

export const CLASSIFICATION_JSON_SCHEMA: Readonly<Record<string, unknown>> = {
  type: "object",
  additionalProperties: false,
  properties: {
    funnel_stage: { type: "string", enum: [...FUNNEL_STAGES] },
    strategic_intent: { type: "string", enum: [...STRATEGIC_INTENTS] },
    narrative_type: { type: "string", enum: [...NARRATIVE_TYPES] },
    theme: { type: "string", description: "Tema principal, específico e conciso." },
    hook: { type: "string", description: "Gancho observado; vazio quando não identificável." },
    angle: { type: "string", description: "Ângulo observado; vazio quando não identificável." },
    promise: { type: "string", description: "Promessa observada; vazia quando não identificável." },
    pain: { type: "string", description: "Dor explicitamente tratada; vazia quando não identificável." },
    desire: { type: "string", description: "Desejo explicitamente tratado; vazio quando não identificável." },
    objection: { type: "string", description: "Objeção explicitamente tratada; vazia quando não identificável." },
    cta: { type: "string", description: "CTA observado; vazio quando não identificável." },
    proof: { type: "string", description: "Prova observada; vazia quando não identificável." },
    audience: { type: "string", description: "Público explicitamente indicado; vazio quando não identificável." },
    visual_style: {
      type: "string",
      description: "Estilo visual somente quando descrito nos metadados; vazio sem evidência textual.",
    },
    tone_of_voice: { type: "string", description: "Tom de voz inferível do texto; vazio quando não identificável." },
    confidence: { type: "string", enum: ["baixa", "media", "alta"] },
  },
  required: [
    "funnel_stage",
    "strategic_intent",
    "narrative_type",
    "theme",
    "hook",
    "angle",
    "promise",
    "pain",
    "desire",
    "objection",
    "cta",
    "proof",
    "audience",
    "visual_style",
    "tone_of_voice",
    "confidence",
  ],
} as const;

export function isOrganicClassificationOutput(value: unknown): value is OrganicClassificationOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;
  const keys = Object.keys(output);
  const expectedKeys = [
    "funnel_stage",
    "strategic_intent",
    "narrative_type",
    "theme",
    "hook",
    "angle",
    "promise",
    "pain",
    "desire",
    "objection",
    "cta",
    "proof",
    "audience",
    "visual_style",
    "tone_of_voice",
    "confidence",
  ];

  return (
    keys.every((key) => expectedKeys.includes(key)) &&
    typeof output.funnel_stage === "string" &&
    isFunnelStage(output.funnel_stage) &&
    typeof output.strategic_intent === "string" &&
    isStrategicIntent(output.strategic_intent) &&
    typeof output.narrative_type === "string" &&
    isNarrativeType(output.narrative_type) &&
    typeof output.theme === "string" &&
    typeof output.hook === "string" &&
    typeof output.angle === "string" &&
    typeof output.promise === "string" &&
    typeof output.pain === "string" &&
    typeof output.desire === "string" &&
    typeof output.objection === "string" &&
    typeof output.cta === "string" &&
    typeof output.proof === "string" &&
    typeof output.audience === "string" &&
    typeof output.visual_style === "string" &&
    typeof output.tone_of_voice === "string" &&
    (output.confidence === "baixa" || output.confidence === "media" || output.confidence === "alta")
  );
}
