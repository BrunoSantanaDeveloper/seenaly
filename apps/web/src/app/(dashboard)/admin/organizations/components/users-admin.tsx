"use client";

import { listUserAdminInfo, resetUserMfa, setUserBanned, UserAdminInfo } from "../actions";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Chip, FormControl, Input, Tooltip, Typography } from "@mui/material";

import { RowLine, RowText } from "@/app/(dashboard)/admin/billing/components/catalog-shared";
import EmptyState from "@/components/product/empty-state";
import NiUsers from "@/icons/nexture/ni-users";
import { createClient } from "@flyee/auth/client";

type UserRow = {
  id: string;
  displayName: string;
  isSuperadmin: boolean;
  createdAt: string;
  orgCount: number;
};

const isBanned = (info?: UserAdminInfo) =>
  Boolean(info?.bannedUntil && new Date(info.bannedUntil).getTime() > Date.now());

/**
 * Platform-wide user roster: find a user, see how they use the platform
 * (orgs, last sign-in) and act (ban/unban). Auth-side fields need the
 * service role and degrade gracefully without it.
 */
export default function UsersAdmin() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [authInfo, setAuthInfo] = useState<Record<string, UserAdminInfo>>({});
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selfId, setSelfId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setSelfId(user?.id ?? null);

    const { data, error: readError } = await supabase
      .from("profiles")
      .select("id, display_name, is_superadmin, created_at, memberships(count)")
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
        displayName: row.display_name ?? "Unnamed user",
        isSuperadmin: row.is_superadmin,
        createdAt: row.created_at,
        orgCount: (row.memberships as unknown as { count: number }[])?.[0]?.count ?? 0,
      })),
    );

    const info = await listUserAdminInfo();
    if (info.ok) {
      setServiceAvailable(true);
      setAuthInfo(Object.fromEntries(info.data.map((entry) => [entry.id, entry])));
    } else {
      setServiceAvailable(info.error === "not-configured" ? false : null);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleBan = async (row: UserRow) => {
    setError(null);
    const result = await setUserBanned(row.id, !isBanned(authInfo[row.id]));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refresh();
  };

  // Recovery path for a user locked out at the 2FA step-up (lost device).
  const handleResetMfa = async (row: UserRow) => {
    setError(null);
    const result = await resetUserMfa(row.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refresh();
  };

  const visible = rows.filter((row) => {
    if (!filter) return true;
    const query = filter.toLowerCase();
    return (
      row.displayName.toLowerCase().includes(query) || (authInfo[row.id]?.email ?? "").toLowerCase().includes(query)
    );
  });

  if (loaded && rows.length === 0 && !error) {
    return (
      <EmptyState
        icon={<NiUsers size="medium" />}
        title="No users yet"
        description="Every account created through sign-up appears here, with its organizations and auth state."
      />
    );
  }

  return (
    <Box className="flex flex-col gap-3">
      <FormControl className="outlined w-72" variant="standard" size="small">
        <Input placeholder="Filter by name or email" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </FormControl>

      {serviceAvailable === false && (
        <Alert severity="info" className="neutral bg-background-paper/60!">
          Set SUPABASE_SERVICE_ROLE_KEY to show emails, last sign-in and enable ban/unban.
        </Alert>
      )}

      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60!">
          {error}
        </Alert>
      )}

      {visible.map((row) => {
        const info = authInfo[row.id];
        const banned = isBanned(info);
        const details = [
          info?.email,
          `${row.orgCount} org${row.orgCount === 1 ? "" : "s"}`,
          info?.lastSignInAt ? `last sign-in ${new Date(info.lastSignInAt).toLocaleDateString()}` : null,
          `since ${new Date(row.createdAt).toLocaleDateString()}`,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <RowLine key={row.id}>
            <RowText primary={row.displayName} secondary={details} />
            {row.id === selfId && <Chip label="you" size="small" color="primary" variant="outlined" />}
            {row.isSuperadmin && <Chip label="superadmin" size="small" color="warning" variant="outlined" />}
            {info?.hasMfa && <Chip label="2FA" size="small" color="success" variant="outlined" />}
            {banned && <Chip label="banned" size="small" color="error" variant="outlined" />}
            {serviceAvailable && info?.hasMfa && (
              <Tooltip title="Remove all authenticator factors — the recovery path when the user lost the device and is locked out">
                <Button size="small" variant="text" color="grey" onClick={() => handleResetMfa(row)}>
                  Reset 2FA
                </Button>
              </Tooltip>
            )}
            {serviceAvailable && row.id !== selfId && (
              <Tooltip title={banned ? "Lift the platform-wide ban" : "Ban from the whole platform"}>
                <Button size="small" variant="text" color={banned ? "success" : "error"} onClick={() => toggleBan(row)}>
                  {banned ? "Unban" : "Ban"}
                </Button>
              </Tooltip>
            )}
          </RowLine>
        );
      })}
      {loaded && visible.length === 0 && rows.length > 0 && (
        <Typography variant="body2" className="text-text-secondary">
          No users match the filter.
        </Typography>
      )}
    </Box>
  );
}
