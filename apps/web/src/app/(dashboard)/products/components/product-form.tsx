"use client";

import { saveProduct } from "../actions";
import { computeCompleteness } from "../lib/completeness";
import type { ProductInput, ProductStatus, ProductWithChildren } from "../types";
import { FormikProvider, useFormik } from "formik";
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
  FormControl,
  FormLabel,
  Input,
  LinearProgress,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import SetupWizard, { type WizardStep } from "@/components/product/setup-wizard";
import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiPlus from "@/icons/nexture/ni-plus";
import { createClient } from "@flyee/auth/client";

interface FormValues {
  name: string;
  status: ProductStatus;
  description: string;
  currency: string;
  price: string;
  unitCost: string;
  marginPct: string;
  avgTicket: string;
  ltv: string;
  targetCac: string;
  monthlyBudget: string;
  conversionType: string;
  funnelStage: string;
  audience: string;
  mainPromise: string;
  landingPageUrl: string;
  landingConversionRate: string;
  optimizationEvent: string;
  notes: string;
  connectionId: string;
  metaAccountId: string;
  objections: string[];
  proofs: { kind: string; content: string }[];
}

// Formik parses type="number" inputs to float, so at runtime these "string"
// fields can hold numbers — normalize before trimming.
const toNum = (value: string | number): number | null => {
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};
const fromNum = (value: number | null | undefined): string =>
  value === null || value === undefined ? "" : String(value);

function initialValues(product?: ProductWithChildren): FormValues {
  return {
    name: product?.name ?? "",
    status: product?.status ?? "draft",
    description: product?.description ?? "",
    currency: product?.currency ?? "BRL",
    price: fromNum(product?.price),
    unitCost: fromNum(product?.unitCost),
    marginPct: fromNum(product?.marginPct),
    avgTicket: fromNum(product?.avgTicket),
    ltv: fromNum(product?.ltv),
    targetCac: fromNum(product?.targetCac),
    monthlyBudget: fromNum(product?.monthlyBudget),
    conversionType: product?.conversionType ?? "",
    funnelStage: product?.funnelStage ?? "",
    audience: product?.audience ?? "",
    mainPromise: product?.mainPromise ?? "",
    landingPageUrl: product?.landingPageUrl ?? "",
    landingConversionRate: fromNum(product?.landingConversionRate),
    optimizationEvent: product?.optimizationEvent ?? "",
    notes: product?.notes ?? "",
    connectionId: product?.connectionId ?? "",
    metaAccountId: product?.metaAccountId ?? "",
    objections: product?.objections?.length ? product.objections : [],
    proofs: product?.proofs?.length ? product.proofs : [],
  };
}

function toInput(values: FormValues, orgId: string, id?: string): ProductInput {
  return {
    id,
    orgId,
    name: values.name,
    status: values.status,
    description: values.description,
    currency: values.currency,
    price: toNum(values.price),
    unitCost: toNum(values.unitCost),
    marginPct: toNum(values.marginPct),
    avgTicket: toNum(values.avgTicket),
    ltv: toNum(values.ltv),
    targetCac: toNum(values.targetCac),
    monthlyBudget: toNum(values.monthlyBudget),
    conversionType: values.conversionType,
    funnelStage: values.funnelStage,
    audience: values.audience,
    mainPromise: values.mainPromise,
    landingPageUrl: values.landingPageUrl,
    landingConversionRate: toNum(values.landingConversionRate),
    optimizationEvent: values.optimizationEvent,
    notes: values.notes,
    connectionId: values.connectionId || null,
    metaAccountId: values.metaAccountId,
    objections: values.objections,
    proofs: values.proofs,
  };
}

/**
 * Capture the product context — the heart of the product (docs/PRODUCT.md).
 *
 * `variant="wizard"` (first-run creation): progressive disclosure, one block
 * per screen with a progress rail, so a long context capture never feels long.
 * `variant="sections"` (editing): everything at once plus the completeness
 * meter — competence feedback on how much context the engine has to reason with.
 * The two never stack progress mechanics.
 */
export default function ProductForm({
  orgId,
  product,
  variant = "sections",
}: {
  orgId: string;
  product?: ProductWithChildren;
  variant?: "sections" | "wizard";
}) {
  const t = useTranslations("products");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<{ id: string; name: string }[]>([]);

  const nonNegative = useMemo(
    () => (max?: number) =>
      yup.string().test("non-negative", t("error-number"), (value) => {
        if (!value || value.trim() === "") return true;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 && (max === undefined || parsed <= max);
      }),
    [t],
  );

  const validationSchema = useMemo(
    () =>
      yup.object({
        name: yup.string().trim().required(t("error-name-required")),
        price: nonNegative(),
        unitCost: nonNegative(),
        marginPct: nonNegative(100),
        avgTicket: nonNegative(),
        ltv: nonNegative(),
        targetCac: nonNegative(),
        monthlyBudget: nonNegative(),
        landingConversionRate: nonNegative(100),
        landingPageUrl: yup
          .string()
          .test("url", t("error-url"), (value) => !value || /^https?:\/\/.+/.test(value.trim())),
      }),
    [nonNegative, t],
  );

  const formik = useFormik<FormValues>({
    initialValues: initialValues(product),
    validationSchema,
    validateOnBlur: true,
    validateOnMount: false,
    onSubmit: async (values) => {
      setError(null);
      const result = await saveProduct(toInput(values, orgId, product?.id));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/products/${result.id}`);
      router.refresh();
    },
  });

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("connections")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("provider", "meta-ads")
      .then(({ data }) => setConnections(data ?? []));
  }, [orgId]);

  const completeness = computeCompleteness(toInput(formik.values, orgId, product?.id));

  const text = (name: keyof FormValues, label: string, opts: { multiline?: boolean; type?: string } = {}) => {
    const err = formik.touched[name] && (formik.errors[name] as string | undefined);
    return (
      <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth error={Boolean(err)}>
        <FormLabel component="label">{label}</FormLabel>
        <Input
          name={name}
          type={opts.type ?? "text"}
          multiline={opts.multiline}
          rows={opts.multiline ? 3 : undefined}
          value={formik.values[name] as string}
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

  // ---- Content blocks, shared by both variants ----

  const identityBlock = (
    <>
      {text("name", t("field-name"))}
      {text("description", t("field-description"), { multiline: true })}
      <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth>
        <FormLabel component="label">{t("field-status")}</FormLabel>
        <Select
          name="status"
          value={formik.values.status}
          variant="standard"
          IconComponent={NiChevronDownSmall}
          onChange={formik.handleChange}
        >
          <MenuItem value="draft">{t("status-draft")}</MenuItem>
          <MenuItem value="active">{t("status-active")}</MenuItem>
          <MenuItem value="archived">{t("status-archived")}</MenuItem>
        </Select>
      </FormControl>
    </>
  );

  const economicsBlock = (
    <>
      {text("currency", t("field-currency"))}
      {text("price", t("field-price"), { type: "number" })}
      {text("unitCost", t("field-unitCost"), { type: "number" })}
      {text("marginPct", t("field-marginPct"), { type: "number" })}
      {text("avgTicket", t("field-avgTicket"), { type: "number" })}
      {text("ltv", t("field-ltv"), { type: "number" })}
      {text("targetCac", t("field-targetCac"), { type: "number" })}
      {text("monthlyBudget", t("field-monthlyBudget"), { type: "number" })}
    </>
  );

  const positioningBlock = (
    <>
      {text("mainPromise", t("field-mainPromise"), { multiline: true })}
      {text("audience", t("field-audience"), { multiline: true })}
      <ListEditor
        label={t("field-objections")}
        addLabel={t("add-objection")}
        items={formik.values.objections}
        onChange={(next) => formik.setFieldValue("objections", next)}
        render={(value, onChange) => <Input fullWidth value={value} onChange={(e) => onChange(e.target.value)} />}
        empty={() => ""}
      />
      <Box className="mt-3">
        <ListEditor
          label={t("field-proofs")}
          addLabel={t("add-proof")}
          items={formik.values.proofs}
          onChange={(next) => formik.setFieldValue("proofs", next)}
          render={(value, onChange) => (
            <Box className="flex grow flex-col gap-1 sm:flex-row">
              <Input
                className="sm:w-40"
                placeholder={t("field-proof-kind")}
                value={value.kind}
                onChange={(e) => onChange({ ...value, kind: e.target.value })}
              />
              <Input
                fullWidth
                placeholder={t("field-proof-content")}
                value={value.content}
                onChange={(e) => onChange({ ...value, content: e.target.value })}
              />
            </Box>
          )}
          empty={() => ({ kind: "", content: "" })}
        />
      </Box>
    </>
  );

  const funnelBlock = (
    <>
      {text("conversionType", t("field-conversionType"))}
      {text("funnelStage", t("field-funnelStage"))}
      {text("landingPageUrl", t("field-landingPageUrl"))}
      {text("landingConversionRate", t("field-landingConversionRate"), { type: "number" })}
      {text("optimizationEvent", t("field-optimizationEvent"))}
      {text("notes", t("field-notes"), { multiline: true })}
    </>
  );

  const metaBlock = (
    <FormControl className="outlined" variant="standard" size="small" fullWidth>
      <FormLabel component="label">{t("field-connection")}</FormLabel>
      <Select
        name="connectionId"
        value={formik.values.connectionId}
        variant="standard"
        displayEmpty
        IconComponent={NiChevronDownSmall}
        onChange={formik.handleChange}
      >
        <MenuItem value="">{t("connection-none")}</MenuItem>
        {connections.map((connection) => (
          <MenuItem key={connection.id} value={connection.id}>
            {connection.name}
          </MenuItem>
        ))}
      </Select>
      {connections.length === 0 && (
        <Typography variant="body2" className="text-text-secondary mt-1">
          {t("connection-hint")}
        </Typography>
      )}
    </FormControl>
  );

  const blocks = [
    { key: "identity", title: t("section-identity"), hint: t("hint-identity"), content: identityBlock },
    { key: "economics", title: t("section-economics"), hint: t("hint-economics"), content: economicsBlock },
    { key: "positioning", title: t("section-positioning"), hint: t("hint-positioning"), content: positioningBlock },
    { key: "funnel", title: t("section-funnel"), hint: t("hint-funnel"), content: funnelBlock },
    { key: "meta", title: t("section-meta"), hint: t("hint-meta"), content: metaBlock },
  ];

  const errorAlert = error && (
    <Alert severity="error" className="neutral bg-background-paper/60! mb-4">
      {error}
    </Alert>
  );

  // ---- Wizard: one decision block per screen, visible progress rail ----
  if (variant === "wizard") {
    const nameValid = formik.values.name.trim().length > 0;
    const steps: WizardStep[] = blocks.map((block, index) => ({
      title: block.title,
      hint: block.hint,
      content: block.content,
      canAdvance: index === 0 ? nameValid : true,
    }));

    return (
      <FormikProvider value={formik}>
        {errorAlert}
        <SetupWizard
          steps={steps}
          onComplete={() => formik.submitForm()}
          completeLabel={formik.isSubmitting ? t("saving") : t("wizard-finish")}
          backLabel={t("wizard-back")}
          continueLabel={t("wizard-continue")}
          stepLabel={(current, total) => t("wizard-step", { current, total })}
        />
      </FormikProvider>
    );
  }

  // ---- Sections: full context at once + completeness (competence feedback) ----
  return (
    <FormikProvider value={formik}>
      <Box component="form" onSubmit={formik.handleSubmit} className="flex flex-col">
        <Card className="mb-5">
          <CardContent className="flex flex-col gap-2">
            <Box className="flex flex-row items-center gap-3">
              <Typography variant="subtitle2" className="grow">
                {t("completeness-title")}
              </Typography>
              <Typography variant="subtitle2" className="text-primary">
                {completeness.score}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={completeness.score} />
            {completeness.missing.length > 0 && (
              <Typography variant="body2" className="text-text-secondary">
                {t("completeness-next")}: {t(`field-${completeness.missing[0]}`)}
              </Typography>
            )}
          </CardContent>
        </Card>

        {blocks.map((block) => (
          <Card key={block.key} component="section" className="mb-5">
            <CardContent>
              <Typography variant="h6" component="h2" className="card-title mb-3">
                {block.title}
              </Typography>
              {block.content}
            </CardContent>
          </Card>
        ))}

        {errorAlert}

        <Box className="flex flex-row gap-2">
          <Button type="submit" variant="contained" disabled={formik.isSubmitting}>
            {formik.isSubmitting ? t("saving") : t("save")}
          </Button>
          <Button variant="text" color="grey" onClick={() => router.push("/products")}>
            {t("cancel")}
          </Button>
        </Box>
      </Box>
    </FormikProvider>
  );
}

/** Small repeatable-list editor used for objections and proofs. */
function ListEditor<T>({
  label,
  addLabel,
  items,
  onChange,
  render,
  empty,
}: {
  label: string;
  addLabel: string;
  items: T[];
  onChange: (next: T[]) => void;
  render: (value: T, onChange: (next: T) => void) => React.ReactNode;
  empty: () => T;
}) {
  return (
    <FormControl className="outlined" variant="standard" size="small" fullWidth>
      <FormLabel component="label">{label}</FormLabel>
      <Box className="flex flex-col gap-2">
        {items.map((item, index) => (
          <Box key={index} className="flex flex-row items-start gap-2">
            {render(item, (next) => onChange(items.map((current, i) => (i === index ? next : current))))}
            <Button
              className="icon-only shrink-0"
              size="small"
              color="grey"
              variant="text"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <NiBinEmpty size="medium" />
            </Button>
          </Box>
        ))}
        <Button
          size="small"
          color="grey"
          variant="outlined"
          className="self-start"
          startIcon={<NiPlus size="small" />}
          onClick={() => onChange([...items, empty()])}
        >
          {addLabel}
        </Button>
      </Box>
    </FormControl>
  );
}
