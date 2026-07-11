"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Chip, Collapse, FormControl, Input, Typography } from "@mui/material";

import { RowLine, RowText } from "@/app/(dashboard)/admin/billing/components/catalog-shared";
import EmptyState from "@/components/product/empty-state";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import { createClient } from "@flyee/auth/client";

type AuditRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  actorName: string | null;
  orgName: string | null;
  createdAt: string;
};

/**
 * Compliance viewer over the append-only audit trail (packages/audit).
 * The job is scan/inspect many events: filter, find the one that matters,
 * open its metadata.
 */
export default function AuditEventsAdmin() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: readError } = await supabase
      .from("audit_events")
      .select("id, action, entity_type, entity_id, metadata, created_at, profiles(display_name), organizations(name)")
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
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        actorName: (row.profiles as unknown as { display_name: string | null } | null)?.display_name ?? null,
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
      row.action.toLowerCase().includes(query) ||
      (row.entityType ?? "").toLowerCase().includes(query) ||
      (row.actorName ?? "").toLowerCase().includes(query) ||
      (row.orgName ?? "").toLowerCase().includes(query)
    );
  });

  if (loaded && rows.length === 0 && !error) {
    return (
      <EmptyState
        icon={<NiShieldCheck size="medium" />}
        title="No audit events yet"
        description="Events recorded through logAuditEvent (packages/audit) appear here — the trail is append-only, so nothing can be edited or deleted."
      />
    );
  }

  return (
    <Box className="flex flex-col gap-3">
      <FormControl className="outlined w-72" variant="standard" size="small">
        <Input
          placeholder="Filter by action, entity, actor or org"
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
        <Box key={row.id} className="flex flex-col">
          <Box
            className="cursor-pointer"
            onClick={() => setExpanded((current) => (current === row.id ? null : row.id))}
          >
            <RowLine>
              <Chip label={row.action} size="small" color="primary" variant="outlined" />
              <RowText
                primary={row.entityType ? `${row.entityType}${row.entityId ? ` · ${row.entityId}` : ""}` : "—"}
                secondary={[row.actorName, row.orgName, new Date(row.createdAt).toLocaleString()]
                  .filter(Boolean)
                  .join(" · ")}
              />
            </RowLine>
          </Box>
          <Collapse in={expanded === row.id}>
            <Box className="bg-background-default/50 my-2 overflow-x-auto rounded-lg p-3">
              <Typography component="pre" variant="body2" className="font-mono whitespace-pre-wrap">
                {JSON.stringify(row.metadata, null, 2)}
              </Typography>
            </Box>
          </Collapse>
        </Box>
      ))}
      {loaded && visible.length === 0 && rows.length > 0 && (
        <Typography variant="body2" className="text-text-secondary">
          No events match the filter.
        </Typography>
      )}
    </Box>
  );
}
