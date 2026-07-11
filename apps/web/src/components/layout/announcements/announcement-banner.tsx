"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, Box, Button, IconButton } from "@mui/material";

import NiCross from "@/icons/nexture/ni-cross";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

type Announcement = {
  id: string;
  title: string;
  body: string | null;
  level: "info" | "warning" | "critical";
  href: string | null;
};

const SEVERITY: Record<Announcement["level"], "info" | "warning" | "error"> = {
  info: "info",
  warning: "warning",
  critical: "error",
};

/**
 * System-wide announcements published by the superadmin
 * (/admin/announcements). Dismissal is per user and persisted, so a
 * message never nags twice. Renders nothing when there is nothing to say.
 */
export default function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // RLS already limits the read to currently live announcements.
      const [{ data: announcements }, { data: dismissals }] = await Promise.all([
        supabase.from("announcements").select("id, title, body, level, href").order("created_at", { ascending: false }),
        supabase.from("announcement_dismissals").select("announcement_id").eq("user_id", user.id),
      ]);
      const dismissed = new Set((dismissals ?? []).map((row) => row.announcement_id));
      setItems(((announcements ?? []) as Announcement[]).filter((item) => !dismissed.has(item.id)));
    };
    load();
  }, []);

  const dismiss = async (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("announcement_dismissals").insert({ announcement_id: id, user_id: user.id });
  };

  if (items.length === 0) return null;

  return (
    <Box className="mb-5 flex flex-col gap-2">
      {items.map((item) => (
        <Alert
          key={item.id}
          severity={SEVERITY[item.level]}
          // A single action slot: optional link + the dismiss button (MUI
          // drops the onClose icon when action is set, so both live here).
          action={
            <Box className="flex flex-row items-center gap-1">
              {item.href && (
                <Button color="inherit" size="small" component={Link} href={item.href}>
                  Learn more
                </Button>
              )}
              <IconButton size="small" color="inherit" aria-label="Dismiss" onClick={() => dismiss(item.id)}>
                <NiCross size="small" />
              </IconButton>
            </Box>
          }
        >
          <span className="font-medium">{item.title}</span>
          {item.body ? <> — {item.body}</> : null}
        </Alert>
      ))}
    </Box>
  );
}
