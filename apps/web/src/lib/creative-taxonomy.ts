import { ORGANIC_FUNNEL_STAGES } from "@flyee/organic-growth";

/**
 * Canonical creative/product taxonomy — slugs, not free text.
 *
 * Free-text taxonomy poisons comparability: "prova social", "social proof" and
 * "depoimento" become three different values, and the winning-pattern analysis
 * silently degrades (docs/LAUNCH.md follow-up). We store an opaque ASCII slug
 * and render a localized label (t(`format-${slug}`) …), exactly like the
 * Organic module (packages/organic-growth/src/taxonomy.ts). Funnel stage is the
 * SAME taxonomy as Organic so the two modules speak one funnel language.
 */

export const CREATIVE_TAXONOMY_VERSION = "creative-taxonomy/v1" as const;

export const CREATIVE_FORMATS = [
  "video",
  "imagem_estatica",
  "carrossel",
  "reels",
  "stories",
  "ugc",
  "live",
  "outro",
] as const;

export const PROOF_TYPES = [
  "depoimento",
  "prova_social",
  "demonstracao",
  "autoridade",
  "dados_pesquisa",
  "garantia",
  "antes_depois",
  "outro",
] as const;

export const CREATIVE_EMOTIONS = [
  "curiosidade",
  "medo",
  "desejo",
  "urgencia",
  "pertencimento",
  "alivio",
  "confianca",
  "outro",
] as const;

export const VISUAL_STYLES = [
  "falando_camera",
  "screencast",
  "animacao",
  "texto_na_tela",
  "estudio",
  "lifestyle",
  "meme",
  "outro",
] as const;

export const CONVERSION_TYPES = [
  "compra",
  "lead",
  "cadastro",
  "agendamento",
  "assinatura",
  "instalacao",
  "outro",
] as const;

/** Funnel stage is shared with Organic Growth — one funnel language cross-module. */
export const CREATIVE_FUNNEL_STAGES = ORGANIC_FUNNEL_STAGES;

export type CreativeFormat = (typeof CREATIVE_FORMATS)[number];
export type ProofType = (typeof PROOF_TYPES)[number];
export type CreativeEmotion = (typeof CREATIVE_EMOTIONS)[number];
export type VisualStyle = (typeof VISUAL_STYLES)[number];
export type ConversionType = (typeof CONVERSION_TYPES)[number];

const formatSet = new Set<string>(CREATIVE_FORMATS);
const proofSet = new Set<string>(PROOF_TYPES);
const emotionSet = new Set<string>(CREATIVE_EMOTIONS);
const visualSet = new Set<string>(VISUAL_STYLES);
const conversionSet = new Set<string>(CONVERSION_TYPES);
const funnelSet = new Set<string>(CREATIVE_FUNNEL_STAGES);

export const isCreativeFormat = (v: string): v is CreativeFormat => formatSet.has(v);
export const isProofType = (v: string): v is ProofType => proofSet.has(v);
export const isCreativeEmotion = (v: string): v is CreativeEmotion => emotionSet.has(v);
export const isVisualStyle = (v: string): v is VisualStyle => visualSet.has(v);
export const isConversionType = (v: string): v is ConversionType => conversionSet.has(v);
export const isCreativeFunnelStage = (v: string): boolean => funnelSet.has(v);

/** Which i18n namespace + prefix renders each taxonomy's label. */
export const TAXONOMY_LABEL = {
  format: { ns: "creatives", prefix: "format" },
  proof: { ns: "creatives", prefix: "proof" },
  emotion: { ns: "creatives", prefix: "emotion" },
  visual: { ns: "creatives", prefix: "visual" },
  conversion: { ns: "products", prefix: "conversion" },
  // Funnel labels live once, in the organicGrowth namespace (funnel-<slug>).
  funnel: { ns: "organicGrowth", prefix: "funnel" },
} as const;
