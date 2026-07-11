import "server-only";

import { createServiceClient } from "@flyee/auth/service";

export type NotificationInput = {
  /** Icon family in the bell: system | team | billing | <project-defined>. */
  type?: string;
  title: string;
  body?: string;
  /** Destination opened on click (internal path or full URL). */
  href?: string;
};

export type NotifyResult = { sent: boolean; error?: string };

/**
 * Creates in-app notifications (header bell) for a set of users. Server-only:
 * inserts go through the service role because RLS blocks users from writing
 * each other's notifications. Returns { sent: false } without throwing when
 * Supabase is not configured — notifications are always best-effort.
 *
 * Database-side events (e.g. "member joined") use triggers instead; see
 * migration 0018_notifications.sql.
 */
export async function notifyUsers(userIds: string[], input: NotificationInput): Promise<NotifyResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { sent: false };
  }
  if (userIds.length === 0) return { sent: true };

  const service = createServiceClient();
  const { error } = await service.from("notifications").insert(
    userIds.map((userId) => ({
      user_id: userId,
      type: input.type ?? "system",
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
    })),
  );
  if (error) return { sent: false, error: error.message };
  return { sent: true };
}

export const notifyUser = (userId: string, input: NotificationInput) => notifyUsers([userId], input);
