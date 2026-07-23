"use client";

import { saveExperiment } from "../actions";
import type { ExperimentStatus, ExperimentWithId } from "../types";
import { useFormik } from "formik";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import * as yup from "yup";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormLabel,
  Input,
  ListItemText,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import { NumericMaskInput, useCurrencySeparators } from "@/components/product/fields";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiFlask from "@/icons/nexture/ni-flask";
import { createClient } from "@flyee/auth/client";

interface FormValues {
  title: string;
  status: ExperimentStatus;
  hypothesis: string;
  changeMade: string;
  reason: string;
  periodStart: string;
  periodEnd: string;
  budget: string;
  primaryMetric: string;
  secondaryMetric: string;
  result: string;
  conclusion: string;
  nextStep: string;
  notes: string;
  creativeIds: string[];
}

// Formik parses type="number" inputs to float, so at runtime these "string"
// fields can hold numbers — normalize before trimming.
const toNum = (value: string | number): number | null => {
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};
const s = (v: string | null | undefined) => v ?? "";

function initialValues(experiment?: ExperimentWithId): FormValues {
  return {
    title: experiment?.title ?? "",
    status: experiment?.status ?? "planned",
    hypothesis: s(experiment?.hypothesis),
    changeMade: s(experiment?.changeMade),
    reason: s(experiment?.reason),
    periodStart: s(experiment?.periodStart),
    periodEnd: s(experiment?.periodEnd),
    budget: experiment?.budget != null ? String(experiment.budget) : "",
    primaryMetric: s(experiment?.primaryMetric),
    secondaryMetric: s(experiment?.secondaryMetric),
    result: s(experiment?.result),
    conclusion: s(experiment?.conclusion),
    nextStep: s(experiment?.nextStep),
    notes: s(experiment?.notes),
    creativeIds: experiment?.creativeIds ?? [],
  };
}

/**
 * Capture/edit one experiment (docs/PRODUCT.md experiment memory). Grouped as
 * hypothesis → execution → result → learning, so the form mirrors the arc of
 * a real test and the "conclusion/next step" that make it reusable knowledge.
 */
export default function ExperimentForm({
  orgId,
  productId,
  experiment,
  returnHref = "/experiments",
}: {
  orgId: string;
  productId: string;
  experiment?: ExperimentWithId;
  returnHref?: string;
}) {
  const t = useTranslations("experiments");
  const separators = useCurrencySeparators();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [concluded, setConcluded] = useState(false);
  const [creatives, setCreatives] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("creatives")
      .select("id, name")
      .eq("product_id", productId)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setCreatives(data ?? []));
  }, [productId]);

  const validationSchema = useMemo(
    () => yup.object({ title: yup.string().trim().required(t("error-title-required")) }),
    [t],
  );

  const formik = useFormik<FormValues>({
    initialValues: initialValues(experiment),
    validationSchema,
    validateOnBlur: true,
    onSubmit: async (values) => {
      setError(null);
      const result = await saveExperiment({
        id: experiment?.id,
        orgId,
        productId,
        diagnosisId: experiment?.diagnosisId ?? null,
        title: values.title,
        status: values.status,
        hypothesis: values.hypothesis,
        changeMade: values.changeMade,
        reason: values.reason,
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
        budget: toNum(values.budget),
        primaryMetric: values.primaryMetric,
        secondaryMetric: values.secondaryMetric,
        result: values.result,
        conclusion: values.conclusion,
        nextStep: values.nextStep,
        notes: values.notes,
        creativeIds: values.creativeIds,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Concluding an experiment changed the memory the engine reads — offer a
      // fresh diagnosis in place instead of silently returning to the list.
      if (result.justConcluded) {
        setConcluded(true);
        router.refresh();
        return;
      }
      router.push(returnHref);
      router.refresh();
    },
  });

  const text = (
    name: keyof FormValues,
    label: string,
    opts: { multiline?: boolean; type?: string; mask?: "money" | "integer" | "percent"; adornment?: string } = {},
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
          value={formik.values[name] as string}
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

  if (concluded) {
    return (
      <EmptyState
        icon={<NiFlask />}
        title={t("concluded-title")}
        description={t("concluded-body")}
        action={{ label: t("concluded-cta-diagnosis"), href: "/diagnosis" }}
        secondaryAction={{ label: t("concluded-cta-back"), href: "/experiments" }}
      />
    );
  }

  return (
    <Box component="form" onSubmit={formik.handleSubmit} className="flex flex-col">
      {section(
        t("section-hypothesis"),
        t("hint-hypothesis"),
        <>
          {text("title", t("field-title"))}
          <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth>
            <FormLabel component="label">{t("field-status")}</FormLabel>
            <Select
              name="status"
              value={formik.values.status}
              variant="standard"
              IconComponent={NiChevronDownSmall}
              onChange={formik.handleChange}
            >
              <MenuItem value="planned">{t("status-planned")}</MenuItem>
              <MenuItem value="running">{t("status-running")}</MenuItem>
              <MenuItem value="concluded">{t("status-concluded")}</MenuItem>
              <MenuItem value="abandoned">{t("status-abandoned")}</MenuItem>
            </Select>
          </FormControl>
          {text("hypothesis", t("field-hypothesis"), { multiline: true })}
          {text("reason", t("field-reason"), { multiline: true })}
        </>,
      )}

      {section(
        t("section-execution"),
        t("hint-execution"),
        <>
          {text("changeMade", t("field-changeMade"), { multiline: true })}
          {text("periodStart", t("field-periodStart"), { type: "date" })}
          {text("periodEnd", t("field-periodEnd"), { type: "date" })}
          {text("budget", t("field-budget"), { mask: "money" })}
          {text("primaryMetric", t("field-primaryMetric"))}
          {text("secondaryMetric", t("field-secondaryMetric"))}
          {creatives.length > 0 && (
            <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth>
              <FormLabel component="label">{t("field-creatives")}</FormLabel>
              <Select
                multiple
                value={formik.values.creativeIds}
                variant="standard"
                IconComponent={NiChevronDownSmall}
                onChange={(e) => formik.setFieldValue("creativeIds", e.target.value)}
                renderValue={(selected) =>
                  creatives
                    .filter((c) => (selected as string[]).includes(c.id))
                    .map((c) => c.name)
                    .join(", ")
                }
              >
                {creatives.map((creative) => (
                  <MenuItem key={creative.id} value={creative.id}>
                    <Checkbox
                      checked={formik.values.creativeIds.includes(creative.id)}
                      slotProps={{ input: { "aria-label": creative.name } }}
                    />
                    <ListItemText primary={creative.name} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </>,
      )}

      {section(
        t("section-result"),
        t("hint-result"),
        <>
          {text("result", t("field-result"), { multiline: true })}
          {text("conclusion", t("field-conclusion"), { multiline: true })}
          {text("nextStep", t("field-nextStep"), { multiline: true })}
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
        <Button variant="text" color="grey" onClick={() => router.push(returnHref)}>
          {t("cancel")}
        </Button>
      </Box>
    </Box>
  );
}
