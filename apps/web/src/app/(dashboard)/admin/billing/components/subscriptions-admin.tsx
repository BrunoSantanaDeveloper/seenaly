"use client";

import { RowLine, RowText } from "./catalog-shared";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Chip, FormControl, Input, Switch, Tooltip, Typography } from "@mui/material";

import { recordAudit } from "@/lib/audit";
import { createClient } from "@flyee/auth/client";

type SubRow = {
  id: string;
  status: string;
  adminSuspended: boolean;
  period: string | null;
  provider: string | null;
  orgName: string;
  planName: string;
  createdAt: string;
};

const STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  active: "success",
  trialing: "warning",
  past_due: "error",
  incomplete: "default",
};

export default function SubscriptionsAdmin() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("subscriptions")
      .select("id, status, admin_suspended, period, provider, created_at, organizations(name), plans(name)")
      .in("status", ["trialing", "active", "past_due", "incomplete"])
      .order("created_at", { ascending: false })
      .limit(200);
    setRows(
      (data ?? []).map((row) => ({
        id: row.id,
        status: row.status,
        adminSuspended: row.admin_suspended,
        period: row.period,
        provider: row.provider,
        orgName: (row.organizations as unknown as { name: string } | null)?.name ?? "Unknown org",
        planName: (row.plans as unknown as { name: string } | null)?.name ?? "Unknown plan",
        createdAt: row.created_at,
      })),
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Superadmin kill-switch: suspends/reactivates access regardless of the
  // provider-side subscription state.
  const toggleSuspended = async (row: SubRow) => {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ admin_suspended: !row.adminSuspended })
      .eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    recordAudit(supabase, row.adminSuspended ? "admin.org.reactivated" : "admin.org.suspended", {
      entityType: "subscription",
      entityId: row.id,
      metadata: { org: row.orgName },
    });
    refresh();
  };

  const visible = rows.filter(
    (row) =>
      !filter ||
      row.orgName.toLowerCase().includes(filter.toLowerCase()) ||
      row.planName.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <Box className="flex flex-col gap-3">
      <FormControl className="outlined w-72" variant="standard" size="small">
        <Input
          placeholder="Filter by organization or plan"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </FormControl>

      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60!">
          {error}
        </Alert>
      )}

      {visible.map((row) => (
        <RowLine key={row.id}>
          <RowText
            primary={row.orgName}
            secondary={`${row.planName}${row.period ? ` · ${row.period}` : ""}${row.provider ? ` · ${row.provider}` : ""} · since ${new Date(row.createdAt).toLocaleDateString()}`}
          />
          <Chip
            label={row.status.replace("_", " ")}
            size="small"
            color={STATUS_COLOR[row.status] ?? "default"}
            variant="outlined"
            className="capitalize"
          />
          {row.adminSuspended && <Chip label="suspended" size="small" color="error" variant="outlined" />}
          <Tooltip title={row.adminSuspended ? "Reactivate access" : "Suspend access"}>
            <Switch checked={!row.adminSuspended} onChange={() => toggleSuspended(row)} size="small" />
          </Tooltip>
        </RowLine>
      ))}
      {visible.length === 0 && (
        <Typography variant="body2" className="text-text-secondary">
          No subscriptions found.
        </Typography>
      )}
    </Box>
  );
}
