"use client";

import { saveFunnelSnapshot } from "../actions";
import type { FunnelWithId } from "../types";
import { useFormik } from "formik";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import * as yup from "yup";

import { Alert, Box, Button, Card, CardContent, FormControl, FormLabel, Input, Typography } from "@mui/material";

import { NumericMaskInput, useCurrencySeparators } from "@/components/product/fields";

interface FormValues {
  label: string;
  periodStart: string;
  periodEnd: string;
  source: string;
  visits: string;
  signups: string;
  checkoutInitiated: string;
  purchases: string;
  refunds: string;
  pending: string;
  upsells: string;
  grossRevenue: string;
  netRevenue: string;
  notes: string;
}

// Formik parses type="number" inputs to float, so at runtime these "string"
// fields can hold numbers — normalize before trimming.
const toNum = (value: string | number): number | null => {
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};
const fromNum = (v: number | null | undefined) => (v == null ? "" : String(v));
const s = (v: string | null | undefined) => v ?? "";

function initialValues(snapshot?: FunnelWithId): FormValues {
  return {
    label: s(snapshot?.label),
    periodStart: s(snapshot?.periodStart),
    periodEnd: s(snapshot?.periodEnd),
    source: s(snapshot?.source),
    visits: fromNum(snapshot?.visits),
    signups: fromNum(snapshot?.signups),
    checkoutInitiated: fromNum(snapshot?.checkoutInitiated),
    purchases: fromNum(snapshot?.purchases),
    refunds: fromNum(snapshot?.refunds),
    pending: fromNum(snapshot?.pending),
    upsells: fromNum(snapshot?.upsells),
    grossRevenue: fromNum(snapshot?.grossRevenue),
    netRevenue: fromNum(snapshot?.netRevenue),
    notes: s(snapshot?.notes),
  };
}

/**
 * Capture/edit one funnel snapshot (docs/PRODUCT.md pillar 3). Grouped as
 * period → the funnel stages → revenue, so the numbers map straight onto the
 * page → checkout → purchase breakdown the engine reasons over.
 */
export default function FunnelForm({
  orgId,
  productId,
  snapshot,
}: {
  orgId: string;
  productId: string;
  snapshot?: FunnelWithId;
}) {
  const t = useTranslations("funnel");
  const separators = useCurrencySeparators();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const nonNeg = useMemo(
    () => yup.string().test("nn", t("error-number"), (v) => !v || (Number.isFinite(Number(v)) && Number(v) >= 0)),
    [t],
  );
  const validationSchema = useMemo(
    () =>
      yup.object({
        visits: nonNeg,
        signups: nonNeg,
        checkoutInitiated: nonNeg,
        purchases: nonNeg,
        refunds: nonNeg,
        pending: nonNeg,
        upsells: nonNeg,
        grossRevenue: nonNeg,
        netRevenue: nonNeg,
      }),
    [nonNeg],
  );

  const formik = useFormik<FormValues>({
    initialValues: initialValues(snapshot),
    validationSchema,
    validateOnBlur: true,
    onSubmit: async (values) => {
      setError(null);
      const result = await saveFunnelSnapshot({
        id: snapshot?.id,
        orgId,
        productId,
        label: values.label,
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
        source: values.source,
        visits: toNum(values.visits),
        signups: toNum(values.signups),
        checkoutInitiated: toNum(values.checkoutInitiated),
        purchases: toNum(values.purchases),
        refunds: toNum(values.refunds),
        pending: toNum(values.pending),
        upsells: toNum(values.upsells),
        grossRevenue: toNum(values.grossRevenue),
        netRevenue: toNum(values.netRevenue),
        notes: values.notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/funnel");
      router.refresh();
    },
  });

  const text = (
    name: keyof FormValues,
    label: string,
    opts: {
      multiline?: boolean;
      type?: string;
      mask?: "money" | "integer" | "percent";
      adornment?: string;
      hint?: string;
    } = {},
  ) => {
    const err = formik.touched[name] && (formik.errors[name] as string | undefined);
    return (
      <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth error={Boolean(err)}>
        <FormLabel component="label">{label}</FormLabel>
        <Input
          name={name}
          type={opts.mask ? "text" : (opts.type ?? "text")}
          multiline={opts.multiline}
          rows={opts.multiline ? 2 : undefined}
          value={formik.values[name]}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          inputComponent={opts.mask ? (NumericMaskInput as never) : undefined}
          inputProps={
            opts.mask
              ? {
                  thousand: separators.thousand,
                  decimal: separators.decimal,
                  decimalScale: opts.mask === "integer" ? 0 : 2,
                  inputMode: opts.mask === "integer" ? "numeric" : "decimal",
                }
              : undefined
          }
          startAdornment={opts.mask === "money" && opts.adornment ? opts.adornment : undefined}
          endAdornment={opts.mask === "percent" ? "%" : undefined}
        />
        {err ? (
          <Typography variant="body2" className="text-error mt-0.5">
            {err}
          </Typography>
        ) : (
          opts.hint && (
            <Typography variant="body2" className="text-text-secondary mt-0.5">
              {opts.hint}
            </Typography>
          )
        )}
      </FormControl>
    );
  };

  const section = (title: string, hint: string, children: React.ReactNode) => (
    <Card component="section" className="mb-5">
      <CardContent>
        <Typography variant="h6" component="h2" className="card-title mb-0">
          {title}
        </Typography>
        <Typography variant="body2" className="text-text-secondary mb-3">
          {hint}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );

  return (
    <Box component="form" onSubmit={formik.handleSubmit} className="flex flex-col">
      {section(
        t("section-period"),
        t("hint-period"),
        <>
          {text("label", t("field-label"))}
          {text("periodStart", t("field-periodStart"), { type: "date" })}
          {text("periodEnd", t("field-periodEnd"), { type: "date" })}
          {text("source", t("field-source"))}
        </>,
      )}

      {section(
        t("section-stages"),
        t("hint-stages"),
        <>
          {text("visits", t("field-visits"), { mask: "integer" })}
          {/* Trial-first funnels convert through here; direct-response ones
              leave it empty and the stage simply does not render. */}
          {text("signups", t("field-signups"), { mask: "integer", hint: t("hint-signups") })}
          {text("checkoutInitiated", t("field-checkoutInitiated"), { mask: "integer" })}
          {text("purchases", t("field-purchases"), { mask: "integer" })}
          {text("refunds", t("field-refunds"), { mask: "integer" })}
          {text("pending", t("field-pending"), { mask: "integer" })}
          {text("upsells", t("field-upsells"), { mask: "integer" })}
        </>,
      )}

      {section(
        t("section-revenue"),
        t("hint-revenue"),
        <>
          {text("grossRevenue", t("field-grossRevenue"), { mask: "money" })}
          {text("netRevenue", t("field-netRevenue"), { mask: "money" })}
          {text("notes", t("field-notes"), { multiline: true })}
        </>,
      )}

      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60! mb-4">
          {error}
        </Alert>
      )}

      <Box className="flex flex-row gap-2">
        <Button type="submit" variant="contained" disabled={formik.isSubmitting}>
          {formik.isSubmitting ? t("saving") : t("save")}
        </Button>
        <Button variant="text" color="grey" onClick={() => router.push("/funnel")}>
          {t("cancel")}
        </Button>
      </Box>
    </Box>
  );
}
