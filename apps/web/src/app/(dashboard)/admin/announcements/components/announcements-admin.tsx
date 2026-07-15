"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Chip, FormControl, FormLabel, Input, Switch, Tooltip, Typography } from "@mui/material";

import { Field, RowLine, RowText, SelectField } from "@/app/(dashboard)/admin/billing/components/catalog-shared";
import EmptyState from "@/components/product/empty-state";
import NiAnnouncement from "@/icons/nexture/ni-announcement";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@flyee/auth/client";

type AnnouncementRow = {
  id: string;
  title: string;
  body: string | null;
  level: "info" | "warning" | "critical";
  href: string | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
};

type FormState = {
  id: string | null;
  title: string;
  body: string;
  level: string;
  href: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  body: "",
  level: "info",
  href: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

const LEVEL_COLOR: Record<string, "default" | "warning" | "error"> = {
  info: "default",
  warning: "warning",
  critical: "error",
};

// datetime-local <-> ISO helpers (the input needs local "YYYY-MM-DDTHH:mm").
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

const statusOf = (row: AnnouncementRow) => {
  if (!row.isActive) return "off";
  const now = Date.now();
  if (new Date(row.startsAt).getTime() > now) return "scheduled";
  if (row.endsAt && new Date(row.endsAt).getTime() <= now) return "expired";
  return "live";
};

const STATUS_COLOR: Record<string, "success" | "warning" | "default"> = {
  live: "success",
  scheduled: "warning",
  expired: "default",
  off: "default",
};

/**
 * Publish and manage system-wide messages: write one, choose severity and
 * window, and it reaches every signed-in user until they dismiss it.
 */
export default function AnnouncementsAdmin() {
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: readError } = await supabase
      .from("announcements")
      .select("id, title, body, level, href, starts_at, ends_at, is_active")
      .order("created_at", { ascending: false })
      .limit(100);
    if (readError) {
      setError(readError.message);
      setLoaded(true);
      return;
    }
    setRows(
      (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        level: row.level,
        href: row.href,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        isActive: row.is_active,
      })),
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async () => {
    if (!form || !form.title.trim()) return;
    setError(null);
    const supabase = createClient();
    const payload = {
      title: form.title.trim(),
      body: form.body.trim() || null,
      level: form.level,
      href: form.href.trim() || null,
      starts_at: toIso(form.startsAt) ?? new Date().toISOString(),
      ends_at: toIso(form.endsAt),
      is_active: form.isActive,
    };
    const query = form.id
      ? supabase.from("announcements").update(payload).eq("id", form.id)
      : supabase.from("announcements").insert(payload);
    const { error: writeError } = await query;
    if (writeError) {
      setError(writeError.message);
      return;
    }
    recordAudit(supabase, form.id ? "admin.announcement.updated" : "admin.announcement.created", {
      entityType: "announcement",
      entityId: form.id ?? undefined,
      metadata: { title: payload.title, level: payload.level },
    });
    setForm(null);
    refresh();
  };

  const toggleActive = async (row: AnnouncementRow) => {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("announcements")
      .update({ is_active: !row.isActive })
      .eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    recordAudit(supabase, row.isActive ? "admin.announcement.deactivated" : "admin.announcement.activated", {
      entityType: "announcement",
      entityId: row.id,
      metadata: { title: row.title },
    });
    refresh();
  };

  return (
    <Box className="flex flex-col gap-3">
      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60!">
          {error}
        </Alert>
      )}

      {!form && (
        <Box>
          <Button variant="outlined" size="small" onClick={() => setForm(EMPTY_FORM)}>
            New announcement
          </Button>
        </Box>
      )}

      {form && (
        <Box className="border-grey-100 flex flex-col gap-3 rounded-2xl border p-4">
          <Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          <FormControl className="outlined" variant="standard" size="small" fullWidth>
            <FormLabel component="label">Body (optional)</FormLabel>
            <Input multiline rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </FormControl>
          <Box className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SelectField
              label="Level"
              value={form.level}
              options={[
                { value: "info", label: "Info" },
                { value: "warning", label: "Warning" },
                { value: "critical", label: "Critical" },
              ]}
              onChange={(value) => setForm({ ...form, level: value })}
            />
            <Field
              label="Starts at (empty = now)"
              type="datetime-local"
              value={form.startsAt}
              onChange={(value) => setForm({ ...form, startsAt: value })}
            />
            <Field
              label="Ends at (empty = until deactivated)"
              type="datetime-local"
              value={form.endsAt}
              onChange={(value) => setForm({ ...form, endsAt: value })}
            />
          </Box>
          <Field
            label="Learn-more link (optional)"
            value={form.href}
            onChange={(value) => setForm({ ...form, href: value })}
          />
          <Box className="flex flex-row items-center gap-2">
            <Switch
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              size="small"
            />
            <Typography variant="body2">Active</Typography>
          </Box>
          <Box className="flex flex-row gap-2">
            <Button variant="contained" size="small" onClick={save} disabled={!form.title.trim()}>
              {form.id ? "Save changes" : "Publish"}
            </Button>
            <Button variant="text" color="grey" size="small" onClick={() => setForm(null)}>
              Cancel
            </Button>
          </Box>
        </Box>
      )}

      {loaded && rows.length === 0 && !form && (
        <EmptyState
          icon={<NiAnnouncement size="medium" />}
          title="No announcements yet"
          description="Publish a message and every signed-in user sees it as a banner until they dismiss it — maintenance windows, new features, policy changes."
          action={{ label: "New announcement", onClick: () => setForm(EMPTY_FORM) }}
        />
      )}

      {rows.map((row) => {
        const status = statusOf(row);
        return (
          <RowLine key={row.id}>
            <RowText
              primary={row.title}
              secondary={`${new Date(row.startsAt).toLocaleString()}${row.endsAt ? ` → ${new Date(row.endsAt).toLocaleString()}` : ""}`}
            />
            <Chip
              label={row.level}
              size="small"
              color={LEVEL_COLOR[row.level]}
              variant="outlined"
              className="capitalize"
            />
            <Chip label={status} size="small" color={STATUS_COLOR[status]} variant="outlined" className="capitalize" />
            <Tooltip title={row.isActive ? "Deactivate" : "Activate"}>
              <Switch checked={row.isActive} onChange={() => toggleActive(row)} size="small" />
            </Tooltip>
            <Button
              size="small"
              variant="text"
              color="grey"
              onClick={() =>
                setForm({
                  id: row.id,
                  title: row.title,
                  body: row.body ?? "",
                  level: row.level,
                  href: row.href ?? "",
                  startsAt: toLocalInput(row.startsAt),
                  endsAt: toLocalInput(row.endsAt),
                  isActive: row.isActive,
                })
              }
            >
              Edit
            </Button>
          </RowLine>
        );
      })}
    </Box>
  );
}
