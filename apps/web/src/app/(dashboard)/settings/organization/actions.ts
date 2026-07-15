"use server";

import { headers } from "next/headers";

import { recordAudit } from "@/lib/audit";
import { createClient } from "@flyee/auth/server";
import { sendOrgInviteEmail } from "@flyee/email";

const INVITE_EXPIRY_DAYS = 7;

export type CreateInviteResult = {
  error?: string;
  /** Whether the invite email was actually delivered (false = link-only). */
  emailSent?: boolean;
};

/**
 * Creates an invite and emails it. The insert runs through the caller's
 * Supabase session, so the RLS policies (owner/admin only) authorize it —
 * this action adds no privilege, only the server-side email step.
 */
export async function createInvite(input: {
  orgId: string;
  email: string;
  role: "admin" | "member";
}): Promise<CreateInviteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated." };
  }

  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: invite, error } = await supabase
    .from("invites")
    .insert({ org_id: input.orgId, email: input.email.trim().toLowerCase(), role: input.role, expires_at: expiresAt })
    .select("token")
    .single();
  if (error) {
    return { error: error.message };
  }

  await recordAudit(supabase, "org.invite.created", {
    orgId: input.orgId,
    entityType: "invite",
    metadata: { email: input.email.trim().toLowerCase(), role: input.role },
  });

  const [{ data: org }, { data: profile }, headerList] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", input.orgId).single(),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    headers(),
  ]);

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const inviteUrl = `${proto}://${host}/invite/${invite.token}`;

  const result = await sendOrgInviteEmail(input.email, {
    orgName: org?.name ?? "the organization",
    role: input.role,
    inviteUrl,
    invitedBy: profile?.display_name ?? undefined,
  });

  return { emailSent: result.sent };
}
