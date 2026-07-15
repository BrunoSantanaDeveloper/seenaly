"use client";

import { getBackupFiles, triggerBackup } from "../actions";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Chip, CircularProgress, Typography } from "@mui/material";

import { RowLine, RowText } from "@/app/(dashboard)/admin/billing/components/catalog-shared";
import EmptyState from "@/components/product/empty-state";
import NiArchive from "@/icons/nexture/ni-archive";
import { createClient } from "@flyee/auth/client";

type RunRow = {
  id: string;
  status: "running" | "success" | "error";
  triggeredBy: "cron" | "manual";
  startedAt: string;
  finishedAt: string | null;
  tableCount: number;
  rowCount: number;
  totalBytes: number;
  storagePrefix: string | null;
  error: string | null;
};

const STATUS_COLOR: Record<string, "success" | "error" | "warning"> = {
  success: "success",
  error: "error",
  running: "warning",
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(2)} GB`;
};

const duration = (start: string, end: string | null) => {
  if (!end) return null;
  const secs = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
};

/**
 * The operator's job here: know backups are actually happening, and grab
 * one when needed. So the screen leads with the last successful run, offers
 * the one action (run now), and lists the history for scanning/downloading.
 */
export default function BackupsAdmin() {
  const [rows, setRows] = useState<RunRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: readError } = await supabase
      .from("backup_runs")
      .select(
        "id, status, triggered_by, started_at, finished_at, table_count, row_count, total_bytes, storage_prefix, error",
      )
      .order("started_at", { ascending: false })
      .limit(100);
    if (readError) {
      setError(readError.message);
      setLoaded(true);
      return;
    }
    setRows(
      (data ?? []).map((row) => ({
        id: row.id,
        status: row.status,
        triggeredBy: row.triggered_by,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        tableCount: row.table_count,
        rowCount: row.row_count,
        totalBytes: row.total_bytes,
        storagePrefix: row.storage_prefix,
        error: row.error,
      })),
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRunNow = async () => {
    setError(null);
    setInfo(null);
    setRunning(true);
    const result = await triggerBackup();
    setRunning(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInfo(
      result.data.mode === "queued"
        ? "Backup queued — it runs in the background and appears below when done. Refresh in a moment."
        : "Backup finished (ran inline). See the newest run below.",
    );
    refresh();
  };

  const handleDownload = async (prefix: string) => {
    setError(null);
    setDownloading(prefix);
    const result = await getBackupFiles(prefix);
    setDownloading(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Open each archive's signed URL — the browser downloads them.
    for (const file of result.data) {
      window.open(file.url, "_blank");
    }
    if (result.data.length === 0) setInfo("This run has no stored files.");
  };

  const lastSuccess = rows.find((row) => row.status === "success");

  return (
    <Box className="flex flex-col gap-4">
      <Box className="flex flex-row flex-wrap items-center gap-4">
        <Box className="flex-1">
          <Typography variant="h5" component="h2" className="card-title mb-1">
            Automatic backups
          </Typography>
          <Typography variant="body2" className="text-text-secondary">
            {lastSuccess
              ? `Last successful backup ${new Date(lastSuccess.startedAt).toLocaleString()} · ${lastSuccess.tableCount} tables · ${formatBytes(lastSuccess.totalBytes)}`
              : "No successful backup recorded yet. The nightly job runs at 03:00 UTC; you can also run one now."}
          </Typography>
        </Box>
        <Button variant="contained" size="small" onClick={handleRunNow} disabled={running}>
          {running ? "Starting…" : "Run backup now"}
        </Button>
      </Box>

      {info && (
        <Alert severity="info" className="neutral bg-background-paper/60!">
          {info}
        </Alert>
      )}
      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60!">
          {error}
        </Alert>
      )}

      {loaded && rows.length === 0 && (
        <EmptyState
          icon={<NiArchive size="medium" />}
          title="No backups yet"
          description="Each run exports every table to the private backups bucket. Start one now, or wait for the nightly job — it needs DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY set."
          action={{ label: "Run backup now", onClick: handleRunNow }}
        />
      )}

      {rows.map((row) => (
        <RowLine key={row.id}>
          <RowText
            primary={new Date(row.startedAt).toLocaleString()}
            secondary={
              row.status === "error"
                ? (row.error ?? "Failed")
                : [
                    `${row.tableCount} tables`,
                    `${row.rowCount.toLocaleString()} rows`,
                    formatBytes(row.totalBytes),
                    duration(row.startedAt, row.finishedAt),
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
          <Chip label={row.triggeredBy} size="small" variant="outlined" />
          <Chip label={row.status} size="small" color={STATUS_COLOR[row.status]} variant="outlined" />
          {row.status === "success" && row.storagePrefix && (
            <Button
              size="small"
              variant="text"
              color="grey"
              disabled={downloading === row.storagePrefix}
              onClick={() => handleDownload(row.storagePrefix!)}
            >
              {downloading === row.storagePrefix ? <CircularProgress size={14} /> : "Download"}
            </Button>
          )}
        </RowLine>
      ))}
    </Box>
  );
}
