"use server";

import { createClient } from "@flyee/auth/server";
import { createServiceClient } from "@flyee/auth/service";

export type UserAdminInfo = {
  id: string;
  email: string | null;
  lastSignInAt: string | null;
  bannedUntil: string | null;
};

export type AdminActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "forbidden" | "not-configured" | string };

/**
 * Server-side superadmin guard for actions that must escalate to the
 * service role (auth admin API). Everything RLS can authorize goes through
 * the normal client instead — this file is only for the escalated paths.
 */
async function isCallerSuperadmin(): Promise<{ userId: string | null; allowed: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, allowed: false };
  const { data } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle();
  return { userId: user.id, allowed: Boolean(data?.is_superadmin) };
}

const isServiceConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Auth-side info (email, last sign-in, ban state) for the users console.
 * Degrades gracefully: without the service key the console still lists
 * profiles, just without these fields.
 */
export async function listUserAdminInfo(): Promise<AdminActionResult<UserAdminInfo[]>> {
  const { allowed } = await isCallerSuperadmin();
  if (!allowed) return { ok: false, error: "forbidden" };
  if (!isServiceConfigured()) return { ok: false, error: "not-configured" };

  const service = createServiceClient();
  const users: UserAdminInfo[] = [];
  let page = 1;
  // Template-scale cap (1000 users); raise it in a derived project if needed.
  while (page <= 5) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { ok: false, error: error.message };
    users.push(
      ...data.users.map((user) => ({
        id: user.id,
        email: user.email ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        bannedUntil: (user as { banned_until?: string }).banned_until ?? null,
      })),
    );
    if (data.users.length < 200) break;
    page += 1;
  }
  return { ok: true, data: users };
}

/** Ban or unban a user platform-wide (Supabase auth ban). */
export async function setUserBanned(userId: string, banned: boolean): Promise<AdminActionResult<null>> {
  const { userId: callerId, allowed } = await isCallerSuperadmin();
  if (!allowed) return { ok: false, error: "forbidden" };
  if (!isServiceConfigured()) return { ok: false, error: "not-configured" };
  if (userId === callerId) return { ok: false, error: "You cannot ban your own account." };

  const service = createServiceClient();
  // Supabase has no permanent ban flag: "876000h" ≈ 100 years; "none" lifts it.
  const { error } = await service.auth.admin.updateUserById(userId, {
    ban_duration: banned ? "876000h" : "none",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
