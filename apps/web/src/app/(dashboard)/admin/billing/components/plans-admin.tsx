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

type PlanForm = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  kind: string;
  period: string;
  price_cents: number;
  currency: string;
  credit_amount: number | "";
  credits_expire: boolean;
  trial_days: number;
  is_free: boolean;
  is_active: boolean;
  limits: string;
  sort: number;
};

const EMPTY: PlanForm = {
  slug: "",
  name: "",
  description: "",
  kind: "recurring",
  period: "monthly",
  price_cents: 0,
  currency: "BRL",
  credit_amount: "",
  credits_expire: false,
  trial_days: 0,
  is_free: false,
  is_active: true,
  limits: "{}",
  sort: 0,
};

export default function PlansAdmin() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<PlanForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("plans").select("*").order("sort");
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openEdit = (row?: Record<string, unknown>) => {
    setError(null);
    if (!row) {
      setForm(EMPTY);
      return;
    }
    setForm({
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      description: (row.description as string) ?? "",
      kind: row.kind as string,
      period: (row.period as string) ?? "none",
      price_cents: row.price_cents as number,
      currency: row.currency as string,
      credit_amount: (row.credit_amount as number) ?? "",
      credits_expire: row.credits_expire as boolean,
      trial_days: row.trial_days as number,
      is_free: row.is_free as boolean,
      is_active: row.is_active as boolean,
      limits: JSON.stringify(row.limits ?? {}, null, 2),
      sort: row.sort as number,
    });
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
    const payload = {
      ...(form.id ? { id: form.id } : {}),
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description || null,
      kind: form.kind,
      period: form.period === "none" ? null : form.period,
      price_cents: Number(form.price_cents) || 0,
      currency: form.currency,
      credit_amount: form.credit_amount === "" ? null : Number(form.credit_amount),
      credits_expire: form.credits_expire,
      trial_days: Number(form.trial_days) || 0,
      is_free: form.is_free,
      is_active: form.is_active,
      limits,
      sort: Number(form.sort) || 0,
    };
    const { error: saveError } = await supabase.from("plans").upsert(payload);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    recordAudit(supabase, form.id ? "admin.billing.plan.updated" : "admin.billing.plan.created", {
      entityType: "plan",
      entityId: form.id ?? undefined,
      metadata: { slug: payload.slug },
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
          New plan
        </Button>
      </Box>
      {rows.map((row) => (
        <RowLine key={row.id as string}>
          <RowText
            primary={`${row.name} (${row.slug})`}
            secondary={`${row.kind} · ${row.period ?? "one-time"} · ${((row.price_cents as number) / 100).toFixed(2)} ${row.currency} · trial ${row.trial_days}d`}
          />
          {(row.is_free as boolean) && <Chip label="free default" size="small" color="success" variant="outlined" />}
          {!(row.is_active as boolean) && <Chip label="inactive" size="small" variant="outlined" />}
          <Tooltip title="Edit">
            <Button className="icon-only" size="small" color="grey" variant="text" onClick={() => openEdit(row)}>
              <NiPen size="medium" />
            </Button>
          </Tooltip>
        </RowLine>
      ))}

      <Dialog open={form !== null} onClose={() => setForm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{form?.id ? "Edit plan" : "New plan"}</DialogTitle>
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
                { value: "credits", label: "Credits" },
              ]}
              onChange={(v) => setForm({ ...form, kind: v })}
            />
            <SelectField
              label="Period"
              value={form.period}
              options={[
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
                { value: "yearly", label: "Yearly" },
                { value: "none", label: "None (one-time credits)" },
              ]}
              onChange={(v) => setForm({ ...form, period: v })}
            />
            <Field
              label="Price (cents)"
              type="number"
              value={form.price_cents}
              onChange={(v) => setForm({ ...form, price_cents: Number(v) })}
            />
            <Field
              label="Credit amount (credits plans)"
              type="number"
              value={form.credit_amount}
              onChange={(v) => setForm({ ...form, credit_amount: v === "" ? "" : Number(v) })}
            />
            <Field
              label="Trial days (0 = no trial)"
              type="number"
              value={form.trial_days}
              onChange={(v) => setForm({ ...form, trial_days: Number(v) })}
            />
            <Field label="Limits (JSON)" value={form.limits} onChange={(v) => setForm({ ...form, limits: v })} />
            <Field
              label="Sort"
              type="number"
              value={form.sort}
              onChange={(v) => setForm({ ...form, sort: Number(v) })}
            />
            <Box className="flex flex-row flex-wrap gap-4">
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={form.credits_expire}
                    onChange={(e) => setForm({ ...form, credits_expire: e.target.checked })}
                  />
                }
                label="Credits expire each period"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={form.is_free}
                    onChange={(e) => setForm({ ...form, is_free: e.target.checked })}
                  />
                }
                label="Free default plan"
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
            </Box>
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
