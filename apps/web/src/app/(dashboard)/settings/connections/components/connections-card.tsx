"use client";

import { Field, RowLine, RowText, SelectField } from "../../../admin/billing/components/catalog-shared";
import { createConnection, listAvailableConnectors, syncConnection } from "../actions";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

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
  Grid,
  Tooltip,
  Typography,
} from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import NiPlug from "@/icons/nexture/ni-plug";
import NiPlus from "@/icons/nexture/ni-plus";
import NiRefresh from "@/icons/nexture/ni-refresh";
import { createClient } from "@flyee/auth/client";

/**
 * Job: bring the org's Meta Ads data in so diagnoses get sharper. Success =
 * one connected, syncing account. This is NOT a management table: most orgs
 * have exactly one connection, so the zero-data view is an invitation that
 * explains the payoff — and says plainly that it is optional (the maturity
 * spectrum invariant: value is never gated behind a connected account).
 */

type ConnectionRow = {
  id: string;
  provider: string;
  name: string;
  status: string;
  last_synced_at: string | null;
  sync_error: string | null;
};

type AvailableConnector = { provider: string; name: string; secretFields: { key: string; label: string }[] };

type AddForm = { provider: string; name: string; secret: Record<string, string> };

const STATUS_COLOR: Record<string, "default" | "success" | "warning" | "error"> = {
  connected: "success",
  error: "error",
  disabled: "default",
};

export default function ConnectionsCard({ orgId }: { orgId: string }) {
  const t = useTranslations("connections");
  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [available, setAvailable] = useState<AvailableConnector[]>([]);
  const [form, setForm] = useState<AddForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("connections")
      .select("id, provider, name, status, last_synced_at, sync_error")
      .eq("org_id", orgId)
      .order("created_at");
    setRows(data ?? []);
    setLoaded(true);
  }, [orgId]);

  useEffect(() => {
    refresh();
    listAvailableConnectors().then(setAvailable);
  }, [refresh]);

  const selectedConnector = available.find((connector) => connector.provider === form?.provider);

  const openAdd = useCallback(() => {
    setError(null);
    const first = available[0];
    if (!first) return;
    setForm({ provider: first.provider, name: "", secret: {} });
  }, [available]);

  const save = async () => {
    if (!form) return;
    setError(null);
    setBusy(true);
    try {
      const result = await createConnection({
        orgId,
        provider: form.provider,
        name: form.name,
        secret: form.secret,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setForm(null);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const sync = async (id: string) => {
    setError(null);
    const result = await syncConnection(id);
    if (!result.ok) setError(result.error);
    refresh();
  };

  const remove = async (id: string) => {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("connections").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    refresh();
  };

  const isEmpty = loaded && rows.length === 0;

  return (
    <Grid size={12}>
      {isEmpty ? (
        <>
          <EmptyState
            icon={<NiPlug />}
            title={t("empty-title")}
            description={available.length === 0 ? t("no-connectors") : t("empty-body")}
            action={available.length > 0 ? { label: t("connect"), onClick: openAdd } : undefined}
          />
          {error && (
            <Alert severity="error" className="neutral bg-background-paper/60! mt-4">
              {error}
            </Alert>
          )}
        </>
      ) : (
        <Card component="section">
          <CardContent className="flex flex-col gap-3">
            <Box className="flex flex-row items-center gap-2">
              <Typography variant="h5" component="h2" className="card-title flex-1">
                {t("title")}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                color="grey"
                startIcon={<NiPlus size="small" />}
                onClick={openAdd}
                disabled={available.length === 0}
              >
                {t("add")}
              </Button>
            </Box>

            {rows.map((row) => (
              <RowLine key={row.id}>
                <RowText
                  primary={row.name}
                  secondary={[
                    row.provider,
                    row.last_synced_at
                      ? t("synced-at", { when: new Date(row.last_synced_at).toLocaleString() })
                      : t("never-synced"),
                    row.sync_error,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
                <Chip
                  label={t(`status-${row.status}`)}
                  size="small"
                  variant="outlined"
                  color={STATUS_COLOR[row.status] ?? "default"}
                />
                <Tooltip title={t("sync-now")}>
                  <Button className="icon-only" size="small" color="grey" variant="text" onClick={() => sync(row.id)}>
                    <NiRefresh size="medium" />
                  </Button>
                </Tooltip>
                <Tooltip title={t("remove")}>
                  <Button className="icon-only" size="small" color="grey" variant="text" onClick={() => remove(row.id)}>
                    <NiBinEmpty size="medium" />
                  </Button>
                </Tooltip>
              </RowLine>
            ))}

            {error && (
              <Alert severity="error" className="neutral bg-background-paper/60!">
                {error}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={form !== null} onClose={() => setForm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("dialog-title")}</DialogTitle>
        {form && (
          <DialogContent className="flex flex-col">
            <SelectField
              label={t("field-provider")}
              value={form.provider}
              options={available.map((connector) => ({ value: connector.provider, label: connector.name }))}
              onChange={(v) => setForm({ provider: v, name: form.name, secret: {} })}
            />
            <Field label={t("field-name")} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            {selectedConnector?.secretFields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                value={form.secret[field.key] ?? ""}
                onChange={(v) => setForm({ ...form, secret: { ...form.secret, [field.key]: v } })}
              />
            ))}
            <Typography variant="body2" className="text-text-secondary">
              {t("credentials-note")}
            </Typography>
          </DialogContent>
        )}
        <DialogActions>
          <Button color="grey" variant="text" onClick={() => setForm(null)}>
            {t("cancel")}
          </Button>
          <Button variant="contained" onClick={save} disabled={busy}>
            {busy ? t("validating") : t("connect")}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
