"use client";

import { saveCreative } from "../actions";
import type { CreativeSource, CreativeStatus, CreativeWithId } from "../types";
import { useFormik } from "formik";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import * as yup from "yup";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  Input,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";

interface FormValues {
  name: string;
  status: CreativeStatus;
  format: string;
  funnelStage: string;
  durationSeconds: string;
  angle: string;
  promise: string;
  pain: string;
  desire: string;
  objection: string;
  hook: string;
  firstScene: string;
  cta: string;
  proofType: string;
  visualStyle: string;
  emotion: string;
  presumedAudience: string;
  resultSummary: string;
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
const s = (value: string | null | undefined) => value ?? "";

function initialValues(creative?: CreativeWithId): FormValues {
  return {
    name: creative?.name ?? "",
    status: creative?.status ?? "idea",
    format: s(creative?.format),
    funnelStage: s(creative?.funnelStage),
    durationSeconds: creative?.durationSeconds != null ? String(creative.durationSeconds) : "",
    angle: s(creative?.angle),
    promise: s(creative?.promise),
    pain: s(creative?.pain),
    desire: s(creative?.desire),
    objection: s(creative?.objection),
    hook: s(creative?.hook),
    firstScene: s(creative?.firstScene),
    cta: s(creative?.cta),
    proofType: s(creative?.proofType),
    visualStyle: s(creative?.visualStyle),
    emotion: s(creative?.emotion),
    presumedAudience: s(creative?.presumedAudience),
    resultSummary: s(creative?.resultSummary),
    notes: s(creative?.notes),
  };
}

/**
 * Capture/edit a tagged creative (docs/PRODUCT.md pillar 4). The taxonomy is
 * grouped by the diagnostic layers of the creative card (strategy → execution
 * → result), so tagging teaches the "why" instead of being a flat form dump.
 */
export default function CreativeForm({
  orgId,
  productId,
  source = "planned",
  metaCreativeId,
  connectionId,
  creative,
}: {
  orgId: string;
  productId: string;
  source?: CreativeSource;
  metaCreativeId?: string | null;
  connectionId?: string | null;
  creative?: CreativeWithId;
}) {
  const t = useTranslations("creatives");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const validationSchema = useMemo(
    () =>
      yup.object({
        name: yup.string().trim().required(t("error-name-required")),
        durationSeconds: yup
          .string()
          .test("num", t("error-number"), (v) => !v || (Number.isFinite(Number(v)) && Number(v) >= 0)),
      }),
    [t],
  );

  const formik = useFormik<FormValues>({
    initialValues: initialValues(creative),
    validationSchema,
    validateOnBlur: true,
    onSubmit: async (values) => {
      setError(null);
      const result = await saveCreative({
        id: creative?.id,
        orgId,
        productId,
        name: values.name,
        status: values.status,
        source: creative?.source ?? source,
        connectionId: creative?.connectionId ?? connectionId ?? null,
        metaCreativeId: creative?.metaCreativeId ?? metaCreativeId ?? "",
        format: values.format,
        funnelStage: values.funnelStage,
        durationSeconds: toNum(values.durationSeconds),
        thumbnailUrl: creative?.thumbnailUrl ?? "",
        angle: values.angle,
        promise: values.promise,
        pain: values.pain,
        desire: values.desire,
        objection: values.objection,
        hook: values.hook,
        firstScene: values.firstScene,
        cta: values.cta,
        proofType: values.proofType,
        visualStyle: values.visualStyle,
        emotion: values.emotion,
        presumedAudience: values.presumedAudience,
        resultSummary: values.resultSummary,
        notes: values.notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/creatives");
      router.refresh();
    },
  });

  const text = (name: keyof FormValues, label: string, opts: { multiline?: boolean; type?: string } = {}) => {
    const err = formik.touched[name] && (formik.errors[name] as string | undefined);
    return (
      <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth error={Boolean(err)}>
        <FormLabel component="label">{label}</FormLabel>
        <Input
          name={name}
          type={opts.type ?? "text"}
          multiline={opts.multiline}
          rows={opts.multiline ? 2 : undefined}
          value={formik.values[name]}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
        />
        {err && (
          <Typography variant="body2" className="text-error mt-0.5">
            {err}
          </Typography>
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
        t("section-identity"),
        t("hint-identity"),
        <>
          {text("name", t("field-name"))}
          <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth>
            <FormLabel component="label">{t("field-status")}</FormLabel>
            <Select
              name="status"
              value={formik.values.status}
              variant="standard"
              IconComponent={NiChevronDownSmall}
              onChange={formik.handleChange}
            >
              <MenuItem value="idea">{t("status-idea")}</MenuItem>
              <MenuItem value="testing">{t("status-testing")}</MenuItem>
              <MenuItem value="winner">{t("status-winner")}</MenuItem>
              <MenuItem value="paused">{t("status-paused")}</MenuItem>
              <MenuItem value="archived">{t("status-archived")}</MenuItem>
            </Select>
          </FormControl>
          {text("format", t("field-format"))}
          {text("funnelStage", t("field-funnelStage"))}
          {text("durationSeconds", t("field-duration"), { type: "number" })}
        </>,
      )}

      {section(
        t("section-strategy"),
        t("hint-strategy"),
        <>
          {text("angle", t("field-angle"))}
          {text("promise", t("field-promise"))}
          {text("pain", t("field-pain"))}
          {text("desire", t("field-desire"))}
          {text("objection", t("field-objection"))}
          {text("presumedAudience", t("field-presumedAudience"))}
        </>,
      )}

      {section(
        t("section-execution"),
        t("hint-execution"),
        <>
          {text("hook", t("field-hook"), { multiline: true })}
          {text("firstScene", t("field-firstScene"))}
          {text("cta", t("field-cta"))}
          {text("proofType", t("field-proofType"))}
          {text("visualStyle", t("field-visualStyle"))}
          {text("emotion", t("field-emotion"))}
        </>,
      )}

      {section(
        t("section-result"),
        t("hint-result"),
        <>
          {text("resultSummary", t("field-resultSummary"), { multiline: true })}
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
        <Button variant="text" color="grey" onClick={() => router.push("/creatives")}>
          {t("cancel")}
        </Button>
      </Box>
    </Box>
  );
}
