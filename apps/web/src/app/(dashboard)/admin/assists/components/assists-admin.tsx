"use client";

import { ASSIST_STATUSES, type AssistRow, type AssistStatus, listAssists, updateAssistStatus } from "../actions";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Chip, MenuItem, Skeleton, TextField, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import LoadErrorState from "@/components/product/load-error-state";
import NiHeadset from "@/icons/nexture/ni-headset";

const STATUS_COLOR: Record<AssistStatus, "warning" | "primary" | "success" | "grey"> = {
  requested: "warning",
  scheduled: "primary",
  in_progress: "primary",
  done: "success",
  cancelled: "grey",
};

/**
 * The concierge work queue.
 *
 * Who: a Seenaly operator. Job: see who paid for a guided session, what they
 * got stuck on, and move each one forward. Success: nobody who paid is sitting
 * in "requested" without contact.
 *
 * A row list IS the right shape here — the job genuinely is scan-and-work-many.
 * Admin surfaces are intentionally EN-only (apps/web/CLAUDE.md).
 */
export default function AssistsAdmin() {
  const [rows, setRows] = useState<AssistRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(null);
    const result = await listAssists();
    if (!result.ok) {
      setError(result.error);
      setRows(null);
      return;
    }
    setRows(result.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const move = async (row: AssistRow, status: AssistStatus) => {
    setBusyId(row.id);
    const result = await updateAssistStatus(row.id, status, notes[row.id] ?? row.operatorNote ?? "");
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await load();
  };

  // A failed load must never look like an empty queue — that would tell the
  // team "nobody is waiting" while paying customers sit unattended.
  if (error) {
    return <LoadErrorState title="Could not load the queue" description={error} retryLabel="Retry" onRetry={load} />;
  }
  if (rows === null) return <Skeleton variant="rounded" height={280} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<NiHeadset />}
        title="No guided sessions requested"
        description="When someone gets stuck on a readiness item and asks for help, the request lands here with the item and the reason."
      />
    );
  }

  return (
    <Box className="flex flex-col gap-3">
      {rows.map((row) => (
        <Box key={row.id} className="border-grey-100 flex flex-col gap-2 rounded-2xl border p-3">
          <Box className="flex flex-row flex-wrap items-center gap-2">
            <Chip label={row.status} size="small" color={STATUS_COLOR[row.status]} variant="outlined" />
            <Typography variant="subtitle2" className="mb-0 grow">
              {row.orgName} · {row.productName}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {new Date(row.createdAt).toLocaleString()}
            </Typography>
          </Box>

          <Typography variant="body2">
            Stuck on <strong>{row.itemKey}</strong> ({row.reason}) · charged {row.creditsCharged} credits
            {row.requesterEmail ? ` · ${row.requesterEmail}` : ""}
          </Typography>

          {row.contactNote && (
            <Alert severity="info" className="neutral bg-background-paper/60!">
              <Typography variant="body2">{row.contactNote}</Typography>
            </Alert>
          )}

          <Box className="flex flex-row flex-wrap items-center gap-2">
            <TextField
              size="small"
              label="Operator note"
              value={notes[row.id] ?? row.operatorNote ?? ""}
              onChange={(event) => setNotes((previous) => ({ ...previous, [row.id]: event.target.value }))}
              className="min-w-64 grow"
            />
            <TextField
              select
              size="small"
              label="Move to"
              value=""
              disabled={busyId === row.id}
              onChange={(event) => void move(row, event.target.value as AssistStatus)}
              className="min-w-44"
            >
              {ASSIST_STATUSES.filter((status) => status !== row.status).map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              color="grey"
              size="small"
              disabled={busyId === row.id}
              onClick={() => void move(row, row.status)}
            >
              Save note
            </Button>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
