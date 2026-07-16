"use client";

import { deleteOrganicImportBatch } from "../../actions";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Skeleton,
  Typography,
} from "@mui/material";

import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import { createClient } from "@flyee/auth/client";

interface ImportBatch {
  id: string;
  file_name: string | null;
  status: "queued" | "processing" | "completed" | "partial" | "failed";
  total_rows: number;
  imported_rows: number;
  rejected_rows: number;
  created_at: string;
}

export default function ImportHistory({ orgId, canDelete }: { orgId: string; canDelete: boolean }) {
  const t = useTranslations("organicGrowth");
  const locale = useLocale();
  const [rows, setRows] = useState<ImportBatch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [deleting, setDeleting] = useState<ImportBatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );

  const load = useCallback(async () => {
    setError(null);
    const { data, error: queryError } = await createClient()
      .from("organic_import_batches")
      .select("id, file_name, status, total_rows, imported_rows, rejected_rows, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (queryError) setError(t("error-load-failed"));
    setRows((data as ImportBatch[] | null) ?? []);
    setLoaded(true);
  }, [orgId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    const result = await deleteOrganicImportBatch({ orgId, batchId: deleting.id });
    setBusy(false);
    if (!result.ok) {
      setError(t(`error-${result.code}`));
      return;
    }
    setDeleting(null);
    await load();
  };

  if (!loaded) return <Skeleton variant="rounded" height={180} />;
  if (rows.length === 0) {
    return error ? (
      <Alert severity="error" className="neutral bg-background-paper/60!">
        {error}
      </Alert>
    ) : null;
  }

  return (
    <>
      <Card component="section">
        <CardContent className="flex flex-col gap-4">
          <Box>
            <Typography variant="h5" component="h2" className="card-title mb-0">
              {t("import-history-title")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("import-history-description")}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" className="neutral bg-background-paper/60!">
              {error}
            </Alert>
          )}

          <Box className="flex flex-col">
            {rows.map((row, index) => (
              <Box key={row.id}>
                {index > 0 && <Divider />}
                <Box className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center">
                  <Box className="min-w-0">
                    <Box className="flex flex-row flex-wrap items-center gap-2">
                      <Typography variant="subtitle1" className="truncate">
                        {row.file_name || t("import-file-unnamed")}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={row.status === "completed" ? "success" : row.status === "failed" ? "error" : "warning"}
                        label={t(`import-status-${row.status}`)}
                      />
                    </Box>
                    <Typography variant="body2" className="text-text-secondary">
                      {formatter.format(new Date(row.created_at))} ·{" "}
                      {t("import-history-counts", {
                        total: row.total_rows,
                        imported: row.imported_rows,
                        rejected: row.rejected_rows,
                      })}
                    </Typography>
                  </Box>
                  {canDelete && (
                    <Button
                      variant="text"
                      color="error"
                      startIcon={<NiBinEmpty size="small" />}
                      onClick={() => setDeleting(row)}
                    >
                      {t("import-delete")}
                    </Button>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Dialog open={Boolean(deleting)} onClose={busy ? undefined : () => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("import-delete-title")}</DialogTitle>
        <DialogContent>
          <Typography variant="body1">{t("import-delete-description")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button color="grey" variant="text" disabled={busy} onClick={() => setDeleting(null)}>
            {t("cancel")}
          </Button>
          <Button color="error" variant="contained" disabled={busy} onClick={remove}>
            {busy ? t("deleting") : t("import-delete-confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
