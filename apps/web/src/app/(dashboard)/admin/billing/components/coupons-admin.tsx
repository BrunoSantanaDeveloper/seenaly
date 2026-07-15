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

type CouponForm = {
  id?: string;
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  max_redemptions: number | "";
  valid_until: string;
  is_active: boolean;
};

const EMPTY: CouponForm = {
  code: "",
  description: "",
  discount_type: "percent",
  discount_value: 10,
  max_redemptions: "",
  valid_until: "",
  is_active: true,
};

export default function CouponsAdmin() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<CouponForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
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
            code: row.code as string,
            description: (row.description as string) ?? "",
            discount_type: row.discount_type as string,
            discount_value: row.discount_value as number,
            max_redemptions: (row.max_redemptions as number) ?? "",
            valid_until: row.valid_until ? String(row.valid_until).slice(0, 10) : "",
            is_active: row.is_active as boolean,
          }
        : EMPTY,
    );
  };

  const save = async () => {
    if (!form) return;
    setError(null);
    const supabase = createClient();
    const { error: saveError } = await supabase.from("coupons").upsert({
      ...(form.id ? { id: form.id } : {}),
      code: form.code.trim().toUpperCase(),
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      max_redemptions: form.max_redemptions === "" ? null : Number(form.max_redemptions),
      valid_until: form.valid_until ? new Date(`${form.valid_until}T23:59:59`).toISOString() : null,
      is_active: form.is_active,
    });
    if (saveError) {
      setError(saveError.message);
      return;
    }
    recordAudit(supabase, form.id ? "admin.billing.coupon.updated" : "admin.billing.coupon.created", {
      entityType: "coupon",
      entityId: form.id || undefined,
      metadata: { code: form.code.trim().toUpperCase() },
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
          New coupon
        </Button>
      </Box>
      {rows.map((row) => (
        <RowLine key={row.id as string}>
          <RowText
            primary={row.code as string}
            secondary={`${row.discount_type === "percent" ? `${row.discount_value}%` : `${((row.discount_value as number) / 100).toFixed(2)} fixed`} · redeemed ${row.redeemed_count}${row.max_redemptions ? `/${row.max_redemptions}` : ""}${row.valid_until ? ` · until ${String(row.valid_until).slice(0, 10)}` : ""}`}
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
        <DialogTitle>{form?.id ? "Edit coupon" : "New coupon"}</DialogTitle>
        {form && (
          <DialogContent className="flex flex-col">
            <Field label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} />
            <Field
              label="Description"
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
            />
            <SelectField
              label="Discount type"
              value={form.discount_type}
              options={[
                { value: "percent", label: "Percent (%)" },
                { value: "fixed", label: "Fixed (cents)" },
              ]}
              onChange={(v) => setForm({ ...form, discount_type: v })}
            />
            <Field
              label={form.discount_type === "percent" ? "Discount (%)" : "Discount (cents)"}
              type="number"
              value={form.discount_value}
              onChange={(v) => setForm({ ...form, discount_value: Number(v) })}
            />
            <Field
              label="Max redemptions (empty = unlimited)"
              type="number"
              value={form.max_redemptions}
              onChange={(v) => setForm({ ...form, max_redemptions: v === "" ? "" : Number(v) })}
            />
            <Field
              label="Valid until (YYYY-MM-DD, empty = no expiry)"
              value={form.valid_until}
              onChange={(v) => setForm({ ...form, valid_until: v })}
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
