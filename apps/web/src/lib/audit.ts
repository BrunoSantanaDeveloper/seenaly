import { logAuditEvent } from "@flyee/audit";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Template-wide audit shorthand: resolves the actor from the session and
 * appends one audit_events row. Fire-and-forget — auditing never takes the
 * calling flow down (logAuditEvent returns errors instead of throwing, and
 * a missing session simply skips the write). Platform-level events (admin
 * actions outside any tenant) omit orgId; RLS admits them via the
 * superadmin branch of audit_events_insert_member.
 */
export async function recordAudit(
  supabase: SupabaseClient,
  action: string,
  options: {
    orgId?: string | null;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await logAuditEvent(supabase, {
    orgId: options.orgId ?? null,
    actorId: user.id,
    action,
    entityType: options.entityType,
    entityId: options.entityId,
    metadata: options.metadata,
  });
}
