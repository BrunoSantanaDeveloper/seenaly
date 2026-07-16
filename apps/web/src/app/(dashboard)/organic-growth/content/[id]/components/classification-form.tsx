"use client";

import { classifyOrganicContent, saveOrganicClassification } from "../../../actions";
import type { OrganicClassificationInput } from "../../../types";
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
import NiSparkle from "@/icons/nexture/ni-sparkle";
import { ORGANIC_FUNNEL_STAGES, ORGANIC_NARRATIVE_TYPES, ORGANIC_STRATEGIC_INTENTS } from "@flyee/organic-growth";

type FormValues = Omit<OrganicClassificationInput, "orgId" | "contentId" | "productId" | "correctedFromId">;

const EMPTY: FormValues = {
  funnelStage: "",
  strategicIntent: "",
  narrativeType: "",
  theme: "",
  hook: "",
  angle: "",
  promise: "",
  pain: "",
  desire: "",
  objection: "",
  proof: "",
  cta: "",
  audience: "",
  visualStyle: "",
  toneOfVoice: "",
};

export default function ClassificationForm({
  orgId,
  productId,
  contentId,
  classificationId,
  initial,
  onSaved,
}: {
  orgId: string;
  productId: string;
  contentId: string;
  classificationId?: string | null;
  initial?: Partial<FormValues>;
  onSaved?: () => void | Promise<void>;
}) {
  const t = useTranslations("organicGrowth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);

  const validationSchema = useMemo(
    () =>
      yup.object({
        funnelStage: yup.string().required(t("error-funnel-stage-required")),
        strategicIntent: yup.string().required(t("error-intent-required")),
        narrativeType: yup.string().required(t("error-narrative-required")),
      }),
    [t],
  );

  const formik = useFormik<FormValues>({
    initialValues: { ...EMPTY, ...initial },
    enableReinitialize: true,
    validationSchema,
    validateOnBlur: true,
    onSubmit: async (values) => {
      setError(null);
      const result = await saveOrganicClassification({
        orgId,
        productId,
        contentId,
        correctedFromId: classificationId,
        ...values,
      });
      if (!result.ok) {
        setError(t(`error-${result.code}`));
        return;
      }
      await onSaved?.();
      router.refresh();
    },
  });

  const select = (
    name: "funnelStage" | "strategicIntent" | "narrativeType",
    label: string,
    values: readonly string[],
  ) => {
    const errorText = formik.touched[name] ? formik.errors[name] : undefined;
    return (
      <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth error={Boolean(errorText)}>
        <FormLabel component="label">{label}</FormLabel>
        <Select
          name={name}
          value={formik.values[name]}
          variant="standard"
          IconComponent={NiChevronDownSmall}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
        >
          {values.map((value) => (
            <MenuItem key={value} value={value}>
              {t(`${name === "funnelStage" ? "funnel" : name === "strategicIntent" ? "intent" : "narrative"}-${value}`)}
            </MenuItem>
          ))}
        </Select>
        {errorText && (
          <Typography variant="body2" className="text-error mt-0.5">
            {errorText}
          </Typography>
        )}
      </FormControl>
    );
  };

  const text = (name: Exclude<keyof FormValues, "funnelStage" | "strategicIntent" | "narrativeType">) => (
    <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth>
      <FormLabel component="label">{t(`field-${name}`)}</FormLabel>
      <Input name={name} value={formik.values[name]} onChange={formik.handleChange} onBlur={formik.handleBlur} />
    </FormControl>
  );

  const runAi = async () => {
    setError(null);
    setClassifying(true);
    const result = await classifyOrganicContent({ orgId, productId, contentId });
    setClassifying(false);
    if (!result.ok) {
      setError(t(`error-${result.code}`));
      return;
    }
    await onSaved?.();
    router.refresh();
  };

  return (
    <Card component="section">
      <CardContent>
        <Box className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <Box>
            <Typography variant="h5" component="h2" className="card-title mb-0">
              {t("classification-title")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("classification-description")}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="grey"
            startIcon={<NiSparkle size="small" />}
            disabled={classifying || formik.isSubmitting}
            onClick={runAi}
          >
            {classifying ? t("classifying") : t("classify-ai")}
          </Button>
        </Box>

        <Box component="form" onSubmit={formik.handleSubmit}>
          <Box className="grid gap-x-4 md:grid-cols-3">
            {select("funnelStage", t("field-funnel-stage"), ORGANIC_FUNNEL_STAGES)}
            {select("strategicIntent", t("field-strategic-intent"), ORGANIC_STRATEGIC_INTENTS)}
            {select("narrativeType", t("field-narrative-type"), ORGANIC_NARRATIVE_TYPES)}
          </Box>
          <Box className="grid gap-x-4 md:grid-cols-2">
            {text("theme")}
            {text("hook")}
            {text("angle")}
            {text("promise")}
            {text("pain")}
            {text("desire")}
            {text("objection")}
            {text("proof")}
            {text("cta")}
            {text("audience")}
            {text("visualStyle")}
            {text("toneOfVoice")}
          </Box>

          {error && (
            <Alert severity="error" className="neutral bg-background-paper/60! mb-3">
              {error}
            </Alert>
          )}

          <Button type="submit" variant="contained" disabled={formik.isSubmitting || classifying}>
            {formik.isSubmitting ? t("saving") : t("classification-save")}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
