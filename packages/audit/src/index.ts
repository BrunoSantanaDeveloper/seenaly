import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditEventInput {
  /** Null for platform-level events (superadmin actions outside any tenant). */
  orgId: string | null;
  actorId: string;
  /** Project-defined verb, e.g. "patient.viewed", "document.issued". */
  action: string;
  entityType?: string;
  entityId?: string;
  /** Extra context. Never put secrets here. */
  metadata?: Record<string, unknown>;
}

/**
 * Append one audit event. Fire-and-forget by design: auditing must never
 * take the main flow down, so failures are returned, not thrown.
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  input: AuditEventInput,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("audit_events").insert({
    org_id: input.orgId,
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export interface ConsentInput {
  orgId: string;
  /** consent_terms row (latest active version of the slug). */
  termId: string;
  /** Who consented, project-defined: e.g. "patient" + patient id. */
  subjectType: string;
  subjectId: string;
  recordedBy: string;
  metadata?: Record<string, unknown>;
}

/** Record an acceptance of a consent term version. */
export async function recordConsent(
  supabase: SupabaseClient,
  input: ConsentInput,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("consent_acceptances").insert({
    term_id: input.termId,
    org_id: input.orgId,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    recorded_by: input.recordedBy,
    metadata: input.metadata ?? {},
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** True when the subject has a non-revoked acceptance for the consent slug. */
export async function hasActiveConsent(
  supabase: SupabaseClient,
  params: { orgId: string; slug: string; subjectType: string; subjectId: string },
): Promise<boolean> {
  const { data } = await supabase
    .from("consent_acceptances")
    .select("id, consent_terms!inner(slug)")
    .eq("org_id", params.orgId)
    .eq("subject_type", params.subjectType)
    .eq("subject_id", params.subjectId)
    .eq("consent_terms.slug", params.slug)
    .is("revoked_at", null)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Revoke a previously recorded acceptance (rows are never deleted). */
export async function revokeConsent(
  supabase: SupabaseClient,
  acceptanceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("consent_acceptances")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", acceptanceId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
