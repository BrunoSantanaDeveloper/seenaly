"use client";
import { ContactResult, submitContact } from "./actions";
import { useFormik } from "formik";
import { useTranslations } from "next-intl";
import { useState } from "react";
import * as Yup from "yup";

import { Alert, Box, Button, FormControl, FormLabel, Input, Tooltip } from "@mui/material";

import NiExclamationSquare from "@/icons/nexture/ni-exclamation-square";

const InputErrorTooltip = ({ title }: { title: string }) => {
  return (
    <Tooltip title={title}>
      <span className="text-error ml-auto leading-4">
        <NiExclamationSquare size="small" />
      </span>
    </Tooltip>
  );
};

export default function ContactForm() {
  const t = useTranslations("marketing");
  const [result, setResult] = useState<ContactResult["status"] | null>(null);

  const validationSchema = Yup.object({
    name: Yup.string().required(t("contact-required")),
    email: Yup.string().email(t("contact-invalid-email")).required(t("contact-required")),
    message: Yup.string().required(t("contact-required")),
  });

  const formik = useFormik({
    initialValues: { name: "", email: "", message: "" },
    validationSchema,
    onSubmit: async (values, helpers) => {
      setResult(null);
      const { status } = await submitContact(values);
      setResult(status);
      if (status === "sent") helpers.resetForm();
    },
    validateOnBlur: false,
    validateOnMount: false,
  });

  return (
    <Box component="form" onSubmit={formik.handleSubmit} className="mx-auto flex w-full max-w-xl flex-col">
      <FormControl className="outlined" variant="standard" size="small">
        <FormLabel component="label" className="flex flex-row">
          {t("contact-name")}
          {formik.touched.name && formik.errors.name && <InputErrorTooltip title={formik.errors.name} />}
        </FormLabel>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          value={formik.values.name}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
        />
      </FormControl>

      <FormControl className="outlined" variant="standard" size="small">
        <FormLabel component="label" className="flex flex-row">
          {t("contact-email")}
          {formik.touched.email && formik.errors.email && <InputErrorTooltip title={formik.errors.email} />}
        </FormLabel>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
        />
      </FormControl>

      <FormControl className="outlined" variant="standard" size="small">
        <FormLabel component="label" className="flex flex-row">
          {t("contact-message")}
          {formik.touched.message && formik.errors.message && <InputErrorTooltip title={formik.errors.message} />}
        </FormLabel>
        <Input
          id="message"
          name="message"
          multiline
          minRows={5}
          value={formik.values.message}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
        />
      </FormControl>

      {result === "sent" && (
        <Alert severity="success" className="mb-4">
          {t("contact-success")}
        </Alert>
      )}
      {result === "not-configured" && (
        <Alert severity="info" className="mb-4">
          {t("contact-not-configured")}
        </Alert>
      )}
      {result === "error" && (
        <Alert severity="error" className="mb-4">
          {t("contact-error")}
        </Alert>
      )}

      <Button type="submit" variant="contained" color="primary" size="large" disabled={formik.isSubmitting}>
        {t("contact-submit")}
      </Button>
    </Box>
  );
}
