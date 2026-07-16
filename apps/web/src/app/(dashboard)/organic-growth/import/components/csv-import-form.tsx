"use client";

import { importOrganicCsv } from "../../actions";
import { useFormik } from "formik";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import * as yup from "yup";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import NiArrowDown from "@/icons/nexture/ni-arrow-down";
import NiArrowUp from "@/icons/nexture/ni-arrow-up";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import { ORGANIC_CSV_TEMPLATE, parseOrganicCsv } from "@flyee/organic-growth";

interface ProductOption {
  id: string;
  name: string;
}

interface AccountOption {
  id: string;
  platform: "instagram" | "tiktok" | "youtube" | "linkedin";
  displayName: string;
  handle: string | null;
}

interface FormValues {
  productId: string;
  socialAccountId: string;
  csv: string;
  fileName: string;
}

export default function CsvImportForm({
  orgId,
  products,
  accounts,
}: {
  orgId: string;
  products: ProductOption[];
  accounts: AccountOption[];
}) {
  const t = useTranslations("organicGrowth");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  const validationSchema = useMemo(
    () =>
      yup.object({
        productId: yup.string().required(t("error-product-required")),
        socialAccountId: yup.string().required(t("error-account-required")),
        csv: yup.string().required(t("error-file-required")),
      }),
    [t],
  );

  const formik = useFormik<FormValues>({
    initialValues: {
      productId: products[0]?.id ?? "",
      socialAccountId: accounts[0]?.id ?? "",
      csv: "",
      fileName: "",
    },
    validationSchema,
    validateOnBlur: true,
    onSubmit: async (values) => {
      setError(null);
      setResultSummary(null);
      const result = await importOrganicCsv({ orgId, ...values });
      if (!result.ok) {
        setError(t(`error-${result.code}`));
        return;
      }
      setResultSummary(
        t("import-success", { imported: result.imported, updated: result.updated, rejected: result.rejected }),
      );
      router.push("/organic-growth/content");
      router.refresh();
    },
  });

  const account = accounts.find((item) => item.id === formik.values.socialAccountId) ?? accounts[0];
  const preview = useMemo(
    () =>
      formik.values.csv
        ? parseOrganicCsv(formik.values.csv, {
            defaultPlatform: account?.platform,
            defaultAccount: account?.handle || account?.displayName,
          })
        : null,
    [account, formik.values.csv],
  );

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) {
      setError(t("error-file-too-large"));
      return;
    }
    const text = await file.text();
    formik.setFieldValue("csv", text);
    formik.setFieldValue("fileName", file.name);
    setError(null);
  };

  const issueMessage = (issue: { code: string; column?: string }) =>
    t("csv-issue-message", {
      issue: t(`csv-issue-${issue.code.replaceAll("_", "-")}`),
      column: issue.column || t("csv-column-general"),
    });

  const downloadTemplate = () => {
    const blob = new Blob([ORGANIC_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "seenaly-organic-growth-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box component="form" onSubmit={formik.handleSubmit} className="flex flex-col gap-5">
      <Card component="section">
        <CardContent>
          <Typography variant="h5" component="h2" className="card-title mb-0">
            {t("import-scope-title")}
          </Typography>
          <Typography variant="body2" className="text-text-secondary mb-4">
            {t("import-scope-description")}
          </Typography>
          <Box className="grid gap-4 md:grid-cols-2">
            <FormControl className="outlined" variant="standard" size="small" fullWidth>
              <FormLabel component="label">{t("field-product")}</FormLabel>
              <Select
                name="productId"
                value={formik.values.productId}
                variant="standard"
                IconComponent={NiChevronDownSmall}
                onChange={formik.handleChange}
              >
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl className="outlined" variant="standard" size="small" fullWidth>
              <FormLabel component="label">{t("field-account")}</FormLabel>
              <Select
                name="socialAccountId"
                value={formik.values.socialAccountId}
                variant="standard"
                IconComponent={NiChevronDownSmall}
                onChange={formik.handleChange}
              >
                {accounts.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.handle || item.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <Card component="section">
        <CardContent className="flex flex-col gap-4">
          <Box className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <Box>
              <Typography variant="h5" component="h2" className="card-title mb-0">
                {t("import-file-title")}
              </Typography>
              <Typography variant="body2" className="text-text-secondary">
                {t("import-file-description")}
              </Typography>
            </Box>
            <Button
              type="button"
              variant="outlined"
              color="grey"
              startIcon={<NiArrowDown size="small" />}
              onClick={downloadTemplate}
            >
              {t("download-template")}
            </Button>
          </Box>

          <Box
            className="border-grey-100 flex flex-col items-center gap-3 rounded-3xl border border-dashed px-6 py-10 text-center"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              readFile(event.dataTransfer.files[0]);
            }}
          >
            <span className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-2xl">
              <NiArrowUp size="large" />
            </span>
            <Typography variant="subtitle1">{formik.values.fileName || t("import-drop-title")}</Typography>
            <Typography variant="body2" className="text-text-secondary max-w-md">
              {t("import-drop-description")}
            </Typography>
            <Button type="button" variant="contained" onClick={() => fileRef.current?.click()}>
              {t("choose-file")}
            </Button>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => readFile(event.target.files?.[0])}
            />
          </Box>

          {preview && (
            <Box className="flex flex-col gap-3">
              <Box className="flex flex-row flex-wrap gap-1.5">
                <Chip
                  size="small"
                  variant="outlined"
                  color={preview.acceptedRows > 0 ? "success" : "default"}
                  label={t("import-preview-accepted", { count: preview.acceptedRows })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={preview.rejectedRows > 0 ? "warning" : "default"}
                  label={t("import-preview-rejected", { count: preview.rejectedRows })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color="grey"
                  label={t("import-preview-delimiter", { delimiter: preview.delimiter })}
                />
              </Box>
              {preview.errors.length > 0 && (
                <Alert severity={preview.fatal ? "error" : "warning"} className="neutral bg-background-paper/60!">
                  {preview.errors.slice(0, 6).map((issue) => (
                    <Typography key={`${issue.row}-${issue.column}-${issue.code}`} variant="body2">
                      {t("import-row-error", { row: issue.row, message: issueMessage(issue) })}
                    </Typography>
                  ))}
                </Alert>
              )}
              {preview.warnings.length > 0 && (
                <Alert severity="info" className="neutral bg-background-paper/60!">
                  {preview.warnings.slice(0, 4).map((issue) => (
                    <Typography key={`${issue.row}-${issue.column}-${issue.code}`} variant="body2">
                      {t("import-row-error", { row: issue.row, message: issueMessage(issue) })}
                    </Typography>
                  ))}
                </Alert>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60!">
          {error}
        </Alert>
      )}
      {resultSummary && (
        <Alert severity="success" className="neutral bg-background-paper/60!">
          {resultSummary}
        </Alert>
      )}

      <Box className="flex flex-row gap-2">
        <Button
          type="submit"
          variant="contained"
          disabled={formik.isSubmitting || !preview || preview.fatal || preview.acceptedRows === 0}
        >
          {formik.isSubmitting ? t("importing") : t("import-submit")}
        </Button>
        <Button type="button" variant="text" color="grey" onClick={() => router.push("/organic-growth")}>
          {t("cancel")}
        </Button>
      </Box>
    </Box>
  );
}
