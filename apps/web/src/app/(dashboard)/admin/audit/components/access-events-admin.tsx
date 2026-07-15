"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Chip, FormControl, Input, Typography } from "@mui/material";

import { RowLine, RowText } from "@/app/(dashboard)/admin/billing/components/catalog-shared";
import EmptyState from "@/components/product/empty-state";
import NiFingerprint from "@/icons/nexture/ni-fingerprint";
import { createClient } from "@flyee/auth/client";

type AccessRow = {
  id: string;
  userName: string | null;
  ip: string | null;
  userAgent: string | null;
  aal: string | null;
  createdAt: string;
};

/** Crude but scannable browser/OS summary out of a raw user-agent string. */
export const describeAgent = (agent: string | null) => {
  if (!agent) return null;
  const browser = /edg\//i.test(agent)
    ? "Edge"
    : /firefox\//i.test(agent)
      ? "Firefox"
      : /chrome\//i.test(agent)
        ? "Chrome"
        : /safari\//i.test(agent)
          ? "Safari"
          : null;
  const os = /windows/i.test(agent)
    ? "Windows"
    : /mac os x|macintosh/i.test(agent)
      ? "macOS"
      : /android/i.test(agent)
        ? "Android"
        : /iphone|ipad|ios/i.test(agent)
          ? "iOS"
          : /linux/i.test(agent)
            ? "Linux"
            : null;
  return [browser, os].filter(Boolean).join(" · ") || agent.slice(0, 40);
};

/**
 * Sign-in trail viewer: who authenticated, from where, with which assurance
 * level. The operator's job is scanning many events to spot the anomalous
 * one (odd IP, unexpected hour, aal1 where 2FA was expected).
 */
export default function AccessEventsAdmin() {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: readError } = await supabase
      .from("access_events")
      .select("id, ip, user_agent, aal, created_at, profiles(display_name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (readError) {
      setError(readError.message);
      setLoaded(true);
      return;
    }
    setRows(
      (data ?? []).map((row) => ({
        id: row.id,
        userName: (row.profiles as unknown as { display_name: string | null } | null)?.display_name ?? null,
        ip: row.ip,
        userAgent: row.user_agent,
        aal: row.aal,
        createdAt: row.created_at,
      })),
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visible = rows.filter((row) => {
    if (!filter) return true;
    const query = filter.toLowerCase();
    return (
      (row.userName ?? "").toLowerCase().includes(query) ||
      (row.ip ?? "").toLowerCase().includes(query) ||
      (row.userAgent ?? "").toLowerCase().includes(query)
    );
  });

  if (loaded && rows.length === 0 && !error) {
    return (
      <EmptyState
        icon={<NiFingerprint size="medium" />}
        title="No sign-ins recorded yet"
        description="Every new session lands here automatically (trigger on auth.sessions, migration 0016). If sign-ins are happening but nothing shows, apply the migration."
      />
    );
  }

  return (
    <Box className="flex flex-col gap-3">
      <FormControl className="outlined w-72" variant="standard" size="small">
        <Input placeholder="Filter by user, IP or device" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </FormControl>

      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60!">
          {error}
        </Alert>
      )}

      {visible.map((row) => (
        <RowLine key={row.id}>
          <RowText
            primary={row.userName ?? "Unknown user"}
            secondary={[row.ip, describeAgent(row.userAgent), new Date(row.createdAt).toLocaleString()]
              .filter(Boolean)
              .join(" · ")}
          />
          <Chip
            label={row.aal === "aal2" ? "2FA" : "password"}
            size="small"
            color={row.aal === "aal2" ? "success" : "default"}
            variant="outlined"
          />
        </RowLine>
      ))}
      {loaded && visible.length === 0 && rows.length > 0 && (
        <Typography variant="body2" className="text-text-secondary">
          No sign-ins match the filter.
        </Typography>
      )}
    </Box>
  );
}
