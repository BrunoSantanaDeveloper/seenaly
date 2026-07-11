"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Chip, FormControl, Input, Typography } from "@mui/material";

import { RowLine, RowText } from "@/app/(dashboard)/admin/billing/components/catalog-shared";
import EmptyState from "@/components/product/empty-state";
import NiMessages from "@/icons/nexture/ni-messages";
import { createClient } from "@flyee/auth/client";

type WaRow = {
  id: string;
  direction: string;
  toNumber: string | null;
  fromNumber: string | null;
  kind: string;
  text: string | null;
  template: string | null;
  status: string;
  error: string | null;
  provider: string | null;
  orgName: string | null;
  createdAt: string;
};

const STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  sent: "success",
  delivered: "success",
  read: "success",
  queued: "warning",
  scheduled: "warning",
  failed: "error",
};

/** Cross-tenant log of every WhatsApp message the dispatcher handled. */
export default function WaLogAdmin() {
  const [rows, setRows] = useState<WaRow[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: readError } = await supabase
      .from("wa_messages")
      .select(
        "id, direction, to_number, from_number, kind, text, template, status, error, provider, created_at, organizations(name)",
      )
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
        direction: row.direction,
        toNumber: row.to_number,
        fromNumber: row.from_number,
        kind: row.kind,
        text: row.text,
        template: row.template,
        status: row.status,
        error: row.error,
        provider: row.provider,
        orgName: (row.organizations as unknown as { name: string } | null)?.name ?? null,
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
      (row.toNumber ?? "").includes(query) ||
      (row.fromNumber ?? "").includes(query) ||
      (row.text ?? "").toLowerCase().includes(query) ||
      (row.orgName ?? "").toLowerCase().includes(query) ||
      row.status.toLowerCase().includes(query)
    );
  });

  if (loaded && rows.length === 0 && !error) {
    return (
      <EmptyState
        icon={<NiMessages size="medium" />}
        title="No WhatsApp messages yet"
        description="Every message sent or received through the WhatsApp dispatcher (packages/whatsapp) is logged here with its delivery status."
      />
    );
  }

  return (
    <Box className="flex flex-col gap-3">
      <FormControl className="outlined w-72" variant="standard" size="small">
        <Input
          placeholder="Filter by number, text, org or status"
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
          <Chip
            label={row.direction === "inbound" ? "in" : "out"}
            size="small"
            color={row.direction === "inbound" ? "secondary" : "primary"}
            variant="outlined"
          />
          <RowText
            primary={row.text ?? (row.template ? `template: ${row.template}` : row.kind)}
            secondary={[
              row.direction === "inbound" ? `from ${row.fromNumber ?? "?"}` : `to ${row.toNumber ?? "?"}`,
              row.orgName,
              row.provider,
              new Date(row.createdAt).toLocaleString(),
              row.error,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <Chip
            label={row.status}
            size="small"
            color={STATUS_COLOR[row.status] ?? "default"}
            variant="outlined"
            className="capitalize"
          />
        </RowLine>
      ))}
      {loaded && visible.length === 0 && rows.length > 0 && (
        <Typography variant="body2" className="text-text-secondary">
          No messages match the filter.
        </Typography>
      )}
    </Box>
  );
}
