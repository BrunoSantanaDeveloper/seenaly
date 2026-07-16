"use client";

import { saveOrganicSetup } from "../../actions";
import type { OrganicPlatform } from "../../types";
import { FormikProvider, useFormik } from "formik";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import * as yup from "yup";

import { Alert, Box, FormControl, FormLabel, Input, MenuItem, Select, Typography } from "@mui/material";

import SetupWizard, { type WizardStep } from "@/components/product/setup-wizard";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";

interface ProductOption {
  id: string;
  name: string;
  audience: string | null;
  mainPromise: string | null;
}

interface FormValues {
  productId: string;
  platform: OrganicPlatform;
  accountName: string;
  accountHandle: string;
  objective: string;
  desiredAction: string;
  analysisWindowDays: string;
}

export default function OrganicSetupForm({ orgId, products }: { orgId: string; products: ProductOption[] }) {
  const t = useTranslations("organicGrowth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const validationSchema = useMemo(
    () =>
      yup.object({
        productId: yup.string().required(t("error-product-required")),
        accountName: yup.string().trim().required(t("error-account-required")),
        objective: yup.string().trim().required(t("error-objective-required")),
        desiredAction: yup.string().trim().required(t("error-action-required")),
      }),
    [t],
  );

  const formik = useFormik<FormValues>({
    initialValues: {
      productId: products[0]?.id ?? "",
      platform: "instagram",
      accountName: "",
      accountHandle: "",
      objective: "",
      desiredAction: "",
      analysisWindowDays: "30",
    },
    validationSchema,
    validateOnBlur: true,
    onSubmit: async (values) => {
      setError(null);
      const result = await saveOrganicSetup({
        orgId,
        productId: values.productId,
        platform: values.platform,
        accountName: values.accountName,
        accountHandle: values.accountHandle,
        objective: values.objective,
        desiredAction: values.desiredAction,
        analysisWindowDays: Number(values.analysisWindowDays),
      });
      if (!result.ok) {
        setError(t(`error-${result.code}`));
        return;
      }
      router.push("/organic-growth/import");
      router.refresh();
    },
  });

  const fieldError = (name: keyof FormValues) =>
    formik.touched[name] ? (formik.errors[name] as string | undefined) : undefined;

  const textField = (name: "accountName" | "accountHandle" | "objective" | "desiredAction", label: string) => {
    const fieldErrorText = fieldError(name);
    return (
      <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth error={Boolean(fieldErrorText)}>
        <FormLabel component="label">{label}</FormLabel>
        <Input name={name} value={formik.values[name]} onChange={formik.handleChange} onBlur={formik.handleBlur} />
        {fieldErrorText && (
          <Typography variant="body2" className="text-error mt-0.5">
            {fieldErrorText}
          </Typography>
        )}
      </FormControl>
    );
  };

  const productBlock = (
    <FormControl
      className="outlined"
      variant="standard"
      size="small"
      fullWidth
      error={Boolean(fieldError("productId"))}
    >
      <FormLabel component="label">{t("field-product")}</FormLabel>
      <Select
        name="productId"
        value={formik.values.productId}
        variant="standard"
        IconComponent={NiChevronDownSmall}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
      >
        {products.map((product) => (
          <MenuItem key={product.id} value={product.id}>
            {product.name}
          </MenuItem>
        ))}
      </Select>
      {fieldError("productId") && (
        <Typography variant="body2" className="text-error mt-0.5">
          {fieldError("productId")}
        </Typography>
      )}
    </FormControl>
  );

  const sourceBlock = (
    <>
      <Alert severity="info" className="neutral bg-background-paper/60! mb-4">
        {t("setup-source-beta-hint")}
      </Alert>
      <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth>
        <FormLabel component="label">{t("field-platform")}</FormLabel>
        <Select
          name="platform"
          value={formik.values.platform}
          variant="standard"
          IconComponent={NiChevronDownSmall}
          onChange={formik.handleChange}
        >
          <MenuItem value="instagram">{t("platform-instagram")}</MenuItem>
        </Select>
      </FormControl>
      {textField("accountName", t("field-account-name"))}
      {textField("accountHandle", t("field-account-handle"))}
    </>
  );

  const objectiveBlock = (
    <>
      {textField("objective", t("field-objective"))}
      {textField("desiredAction", t("field-desired-action"))}
    </>
  );

  const periodBlock = (
    <>
      <FormControl className="outlined" variant="standard" size="small" fullWidth>
        <FormLabel component="label">{t("field-analysis-window")}</FormLabel>
        <Select
          name="analysisWindowDays"
          value={formik.values.analysisWindowDays}
          variant="standard"
          IconComponent={NiChevronDownSmall}
          onChange={formik.handleChange}
        >
          {[14, 30, 60, 90].map((days) => (
            <MenuItem key={days} value={String(days)}>
              {t("days", { count: days })}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Typography variant="body2" className="text-text-secondary mt-2">
        {t("setup-period-hint")}
      </Typography>
    </>
  );

  const steps: WizardStep[] = [
    {
      title: t("setup-step-product-title"),
      hint: t("setup-step-product-hint"),
      content: productBlock,
      canAdvance: Boolean(formik.values.productId),
    },
    {
      title: t("setup-step-source-title"),
      hint: t("setup-step-source-hint"),
      content: sourceBlock,
      canAdvance: Boolean(formik.values.accountName.trim()),
    },
    {
      title: t("setup-step-objective-title"),
      hint: t("setup-step-objective-hint"),
      content: objectiveBlock,
      canAdvance: Boolean(formik.values.objective.trim() && formik.values.desiredAction.trim()),
    },
    {
      title: t("setup-step-period-title"),
      hint: t("setup-step-period-hint"),
      content: periodBlock,
    },
  ];

  return (
    <FormikProvider value={formik}>
      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60! mb-4">
          {error}
        </Alert>
      )}
      <Box component="form" onSubmit={formik.handleSubmit}>
        <SetupWizard
          steps={steps}
          onComplete={() => formik.submitForm()}
          completeLabel={formik.isSubmitting ? t("saving") : t("setup-finish")}
          backLabel={t("back")}
          continueLabel={t("continue")}
          stepLabel={(current, total) => t("step", { current, total })}
        />
      </Box>
    </FormikProvider>
  );
}
