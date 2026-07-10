/** Shared shapes for the tagged creative library (docs/PRODUCT.md pillar 4). */

export type CreativeStatus = "idea" | "testing" | "winner" | "paused" | "archived";
export type CreativeSource = "planned" | "synced";

/** Serializable payload from the form to the server action. */
export interface CreativeInput {
  id?: string;
  orgId: string;
  productId: string;
  name: string;
  status: CreativeStatus;
  source: CreativeSource;

  connectionId: string | null;
  metaCreativeId: string;

  format: string;
  funnelStage: string;
  durationSeconds: number | null;
  thumbnailUrl: string;

  // The diagnostic taxonomy — the "why".
  angle: string;
  promise: string;
  pain: string;
  desire: string;
  objection: string;
  hook: string;
  firstScene: string;
  cta: string;
  proofType: string;
  visualStyle: string;
  emotion: string;
  presumedAudience: string;

  resultSummary: string;
  notes: string;
}

export interface CreativeWithId extends Omit<CreativeInput, "orgId" | "productId"> {
  id: string;
  orgId: string;
  productId: string;
}
