import type { createClient } from "@flyee/auth/server";

/**
 * Campaign-data briefing, per ad platform.
 *
 * Meta Ads is the first platform, not the only one (docs/PRODUCT.md —
 * "Multi-plataforma de mídia paga"). Each platform owns its tables and its
 * translation of raw metrics into a diagnosis brief; the engine consumes the
 * text block and never learns platform specifics. A second platform registers
 * its own CampaignBriefProvider — the diagnosis action does not change.
 *
 * Metrics from different networks are never merged or ranked as equivalents:
 * one connection → one provider → one block. The product context is the only
 * common denominator across platforms.
 */

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** The connection a brief is built for (provider-agnostic fields only). */
export interface BriefConnection {
  id: string;
  provider: string;
}

export interface CampaignBrief {
  /** The "## Dados de campanha" block, ready to drop into the engine brief. */
  block: string;
  /** True when real platform rows grounded the block (drives insufficient_data). */
  hadData: boolean;
  /** Window covered, persisted on the diagnosis for auditability. */
  windowStart: string | null;
  windowEnd: string | null;
}

export interface CampaignBriefProvider {
  /** Matches connections.provider, e.g. "meta-ads". */
  provider: string;
  buildBrief(supabase: SupabaseServerClient, connection: BriefConnection): Promise<CampaignBrief>;
}

/**
 * The cold-start block: no connection, no synced data, or no provider for the
 * platform. A valid diagnosis input (maturity spectrum), never an error —
 * guide from step 0 with product context + knowledge.
 */
export const COLD_START_CAMPAIGN_BLOCK = [
  "NÃO HÁ DADOS DE CAMPANHA.",
  "Nenhuma conta de mídia paga conectada, ou nenhum dado sincronizado ainda.",
  "Isto NÃO impede o diagnóstico: oriente a partir do passo 0 usando o contexto do produto e a documentação oficial.",
  "Marque insufficient_data=true e explique qual volume mínimo buscar antes de concluir qualquer coisa.",
].join("\n");

export const COLD_START_BRIEF: CampaignBrief = {
  block: COLD_START_CAMPAIGN_BLOCK,
  hadData: false,
  windowStart: null,
  windowEnd: null,
};

const registry = new Map<string, CampaignBriefProvider>();

export function registerCampaignBriefProvider(provider: CampaignBriefProvider): void {
  registry.set(provider.provider, provider);
}

/**
 * Resolve the connection's provider and build its brief. Returns the cold-start
 * brief when there is no connection or no provider is registered for it.
 */
export async function buildCampaignBrief(
  supabase: SupabaseServerClient,
  connection: BriefConnection | null,
): Promise<CampaignBrief> {
  if (!connection) return COLD_START_BRIEF;
  const provider = registry.get(connection.provider);
  if (!provider) return COLD_START_BRIEF;
  return provider.buildBrief(supabase, connection);
}
