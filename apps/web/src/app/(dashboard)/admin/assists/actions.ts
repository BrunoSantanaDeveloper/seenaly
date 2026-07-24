"use server";

import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { createClient } from "@flyee/auth/server";
import { createServiceClient } from "@flyee/auth/service";

export type AssistActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const ASSIST_STATUSES = ["requested", "scheduled", "in_progress", "done", "cancelled"] as const;
export type AssistStatus = (typeof ASSIST_STATUSES)[number];

export type AssistRow = {
  id: string;
  orgName: string;
  productName: string;
  itemKey: string;
  reason: string;
  status: AssistStatus;
  creditsCharged: number;
  contactNote: string | null;
  operatorNote: string | null;
  requesterEmail: string | null;
  createdAt: string;
};

async function isCallerSuperadmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle();
  return Boolean(data?.is_superadmin);
}

/**
 * The concierge work queue, newest first.
 *
 * Service-role by necessity: readiness_assists is org-scoped under RLS, and the
 * platform team is not a member of the tenant orgs it serves. The superadmin
 * check above is the gate.
 */
export async function listAssists(): Promise<AssistActionResult<AssistRow[]>> {
  if (!(await isCallerSuperadmin())) return { ok: false, error: "forbidden" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is required to read the queue." };
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("readiness_assists")
    .select(
      "id, item_key, reason, status, credits_charged, contact_note, operator_note, created_at, organizations(name), products(name), profiles(email)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { ok: false, error: error.message };

  // PostgREST returns embedded resources as ARRAYS even for to-one relations.
  const rows = (data ?? []) as unknown as {
    id: string;
    item_key: string;
    reason: string;
    status: AssistStatus;
    credits_charged: number;
    contact_note: string | null;
    operator_note: string | null;
    created_at: string;
    organizations: { name: string }[] | { name: string } | null;
    products: { name: string }[] | { name: string } | null;
    profiles: { email: string | null }[] | { email: string | null } | null;
  }[];
  const first = <T>(value: T[] | T | null): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : ((value as T) ?? null);

  return {
    ok: true,
    data: rows.map((row) => ({
      id: row.id,
      orgName: first(row.organizations)?.name ?? "—",
      productName: first(row.products)?.name ?? "—",
      itemKey: row.item_key,
      reason: row.reason,
      status: row.status,
      creditsCharged: Number(row.credits_charged ?? 0),
      contactNote: row.contact_note,
      operatorNote: row.operator_note,
      requesterEmail: first(row.profiles)?.email ?? null,
      createdAt: row.created_at,
    })),
  };
}

/**
 * Move a request along the queue and (optionally) leave a note.
 *
 * Notifies the customer on every transition: someone who paid for a human to
 * show up must never be left wondering whether anything happened.
 */
export async function updateAssistStatus(
  id: string,
  status: AssistStatus,
  operatorNote: string,
): Promise<AssistActionResult<null>> {
  if (!(await isCallerSuperadmin())) return { ok: false, error: "forbidden" };
  if (!ASSIST_STATUSES.includes(status)) return { ok: false, error: "invalid status" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is required to work the queue." };
  }

  const service = createServiceClient();
  const { data: updated, error } = await service
    .from("readiness_assists")
    .update({ status, operator_note: operatorNote.slice(0, 2000) || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("org_id, product_id, item_key, requested_by")
    .single();
  if (error) return { ok: false, error: error.message };

  const supabase = await createClient();
  await recordAudit(supabase, "readiness.assist_status_changed", {
    orgId: updated.org_id as string,
    entityType: "readiness_assist",
    entityId: id,
    metadata: { status, item: updated.item_key },
  });

  if (updated.requested_by) {
    await notifyUser(updated.requested_by as string, {
      type: "system",
      title: "Sessão guiada atualizada",
      body: `Seu pedido está agora: ${status}.`,
      href: `/products/${updated.product_id}/readiness`,
    });
  }

  return { ok: true, data: null };
}
