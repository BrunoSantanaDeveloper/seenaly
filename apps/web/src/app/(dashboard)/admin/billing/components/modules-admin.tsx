"use client";

import { Field, RowLine, RowText, SelectField } from "./catalog-shared";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Tooltip,
} from "@mui/material";

import NiPen from "@/icons/nexture/ni-pen";
import NiPlus from "@/icons/nexture/ni-plus";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@flyee/auth/client";

type ModuleForm = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  kind: string;
  price_cents: number;
  limits: string;
  is_active: boolean;
  sort: number;
};

const EMPTY: ModuleForm = {
  slug: "",
  name: "",
  description: "",
  kind: "recurring",
  price_cents: 0,
  limits: "{}",
  is_active: true,
  sort: 0,
};

export default function ModulesAdmin() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<ModuleForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("modules").select("*").order("sort");
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openEdit = (row?: Record<string, unknown>) => {
    setError(null);
    setForm(
      row
        ? {
            id: row.id as string,
            slug: row.slug as string,
            name: row.name as string,
            description: (row.description as string) ?? "",
            kind: row.kind as string,
            price_cents: row.price_cents as number,
            limits: JSON.stringify(row.limits ?? {}, null, 2),
            is_active: row.is_active as boolean,
            sort: row.sort as number,
          }
        : EMPTY,
    );
  };

  const save = async () => {
    if (!form) return;
    setError(null);
    let limits: unknown;
    try {
      limits = JSON.parse(form.limits || "{}");
    } catch {
      setError("Limits must be valid JSON.");
      return;
    }
    const supabase = createClient();
    const { error: saveError } = await supabase.from("modules").upsert({
      ...(form.id ? { id: form.id } : {}),
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description || null,
      kind: form.kind,
      price_cents: Number(form.price_cents) || 0,
      limits,
      is_active: form.is_active,
      sort: Number(form.sort) || 0,
    });
    if (saveError) {
      setError(saveError.message);
      return;
    }
    recordAudit(supabase, form.id ? "admin.billing.module.updated" : "admin.billing.module.created", {
      entityType: "module",
      entityId: form.id || undefined,
      metadata: { slug: form.slug.trim() },
    });
    setForm(null);
    refresh();
  };

  return (
    <Box className="flex flex-col gap-3">
      <Box>
        <Button
          variant="outlined"
          size="small"
          color="grey"
          startIcon={<NiPlus size="small" />}
          onClick={() => openEdit()}
        >
          New module
        </Button>
      </Box>
      {rows.map((row) => (
        <RowLine key={row.id as string}>
          <RowText
            primary={`${row.name} (${row.slug})`}
            secondary={`${row.kind} · ${((row.price_cents as number) / 100).toFixed(2)} ${row.currency}`}
          />
          {!(row.is_active as boolean) && <Chip label="inactive" size="small" variant="outlined" />}
          <Tooltip title="Edit">
            <Button className="icon-only" size="small" color="grey" variant="text" onClick={() => openEdit(row)}>
              <NiPen size="medium" />
            </Button>
          </Tooltip>
        </RowLine>
      ))}

      <Dialog open={form !== null} onClose={() => setForm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{form?.id ? "Edit module" : "New module"}</DialogTitle>
        {form && (
          <DialogContent className="flex flex-col">
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
            <Field
              label="Description"
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
            />
            <SelectField
              label="Kind"
              value={form.kind}
              options={[
                { value: "recurring", label: "Recurring" },
                { value: "one_time", label: "One-time" },
              ]}
              onChange={(v) => setForm({ ...form, kind: v })}
            />
            <Field
              label="Price (cents)"
              type="number"
              value={form.price_cents}
              onChange={(v) => setForm({ ...form, price_cents: Number(v) })}
            />
            <Field label="Limits (JSON)" value={form.limits} onChange={(v) => setForm({ ...form, limits: v })} />
            <Field
              label="Sort"
              type="number"
              value={form.sort}
              onChange={(v) => setForm({ ...form, sort: Number(v) })}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
              }
              label="Active"
            />
            {error && (
              <Alert severity="error" className="neutral bg-background-paper/60! mt-2">
                {error}
              </Alert>
            )}
          </DialogContent>
        )}
        <DialogActions>
          <Button color="grey" variant="text" onClick={() => setForm(null)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
