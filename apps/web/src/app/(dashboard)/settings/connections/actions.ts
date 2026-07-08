"use server";

import "@/lib/connectors";

import { createClient } from "@flyee/auth/server";
import {
  type ConnectionSecret,
  getConnector,
  listConnectors,
  runConnectionSync,
  saveConnectionSecret,
} from "@flyee/connectors";
import { sendEvent } from "@flyee/jobs";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Connectors registered by this project (template ships none). */
export async function listAvailableConnectors() {
  return listConnectors();
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * SaaS gate: connecting and syncing external data require an active
 * subscription (same rule as the AI chat route). Mirrors org_entitlements,
 * which enforces org membership via the user session.
 */
async function requireActiveSubscription(supabase: SupabaseServerClient, orgId: string): Promise<ActionResult> {
  const { data: entitlements, error } = await supabase.rpc("org_entitlements", { target_org: orgId });
  if (error) return { ok: false, error: error.message };
  if (!entitlements?.active) {
    return {
      ok: false,
      error: entitlements?.suspended
        ? "Subscription suspended — contact support."
        : "No active subscription for this organization.",
    };
  }
  return { ok: true };
}

/** Test credentials, create the connection (RLS enforces org admin) and store the secret. */
export async function createConnection(input: {
  orgId: string;
  provider: string;
  name: string;
  secret: ConnectionSecret;
}): Promise<ActionResult> {
  const connector = getConnector(input.provider);
  if (!connector) return { ok: false, error: `No connector registered for "${input.provider}".` };

  const supabase = await createClient();
  const gate = await requireActiveSubscription(supabase, input.orgId);
  if (!gate.ok) return gate;

  const test = await connector.test(input.secret);
  if (!test.ok) return { ok: false, error: test.error ?? "Credential test failed." };

  const { data: created, error } = await supabase
    .from("connections")
    .insert({
      org_id: input.orgId,
      provider: input.provider,
      name: input.name.trim() || connector.name,
      metadata: test.metadata ?? {},
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: error?.message ?? "Insert failed." };

  try {
    await saveConnectionSecret(created.id, input.secret);
  } catch (secretError) {
    await supabase.from("connections").delete().eq("id", created.id);
    return { ok: false, error: secretError instanceof Error ? secretError.message : "Could not store credentials." };
  }
  return { ok: true };
}

/**
 * Queue one sync cycle. Authorization: the RLS-scoped update below only
 * succeeds for org owners/admins — a failed update means no service-role
 * sync either.
 */
export async function syncConnection(connectionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: allowed } = await supabase
    .from("connections")
    .update({ sync_error: null })
    .eq("id", connectionId)
    .select("id, org_id")
    .maybeSingle();
  if (!allowed) return { ok: false, error: "Not allowed to sync this connection." };

  const gate = await requireActiveSubscription(supabase, allowed.org_id as string);
  if (!gate.ok) return gate;

  const queued = await sendEvent("connectors/connection.sync", { connectionId });
  if (queued.sent) return { ok: true };

  const result = await runConnectionSync(connectionId);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
