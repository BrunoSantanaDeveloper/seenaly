"use client";

import { useFormik } from "formik";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import * as Yup from "yup";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  Grid,
  Input,
  Tooltip,
  Typography,
} from "@mui/material";

import NiExclamationSquare from "@/icons/nexture/ni-exclamation-square";
import { createClient } from "@flyee/auth/client";

const InputErrorTooltip = ({ title }: { title: string }) => (
  <Tooltip title={title}>
    <span className="text-error ml-auto leading-4">
      <NiExclamationSquare size="small" />
    </span>
  </Tooltip>
);

const buildEmailSchema = (t: (key: string) => string) =>
  Yup.object({
    email: Yup.string().email(t("error-email-invalid")).required(t("error-email-required")),
  });

const buildPasswordSchema = (t: (key: string) => string) =>
  Yup.object({
    password: Yup.string().min(8, t("error-password-min")).required(t("error-password-required")),
    confirm: Yup.string()
      .oneOf([Yup.ref("password")], t("error-password-match"))
      .required(t("error-password-confirm")),
  });

/**
 * Real account credentials: change the sign-in email (Supabase sends a
 * confirmation to both addresses) and the password. 2FA lives in
 * /settings/security.
 */
export default function AccountCard() {
  const t = useTranslations("settings");
  const [currentEmail, setCurrentEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"sent" | "error" | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<"saved" | "error" | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentEmail(user?.email ?? "");
    };
    load();
  }, []);

  const emailForm = useFormik({
    initialValues: { email: "" },
    validationSchema: buildEmailSchema(t),
    validateOnBlur: false,
    validateOnMount: false,
    onSubmit: async (values, helpers) => {
      setEmailStatus(null);
      setEmailError(null);
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ email: values.email.trim() });
      if (error) {
        setEmailStatus("error");
        setEmailError(error.message);
        return;
      }
      setEmailStatus("sent");
      helpers.resetForm();
    },
  });

  const passwordForm = useFormik({
    initialValues: { password: "", confirm: "" },
    validationSchema: buildPasswordSchema(t),
    validateOnBlur: false,
    validateOnMount: false,
    onSubmit: async (values, helpers) => {
      setPasswordStatus(null);
      setPasswordError(null);
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) {
        setPasswordStatus("error");
        setPasswordError(error.message);
        return;
      }
      setPasswordStatus("saved");
      helpers.resetForm();
    },
  });

  return (
    <Grid size={12}>
      <Card component="section">
        <CardContent>
          <Typography variant="h5" component="h2" className="card-title">
            {t("account-section")}
          </Typography>

          <Box component="form" onSubmit={emailForm.handleSubmit} className="mb-8 flex max-w-md flex-col gap-3">
            <Typography variant="subtitle2">{t("signin-email")}</Typography>
            {emailStatus === "sent" && (
              <Alert severity="success" className="neutral bg-background-paper/60!">
                {t("email-confirmation-sent")}
              </Alert>
            )}
            {emailStatus === "error" && (
              <Alert severity="error" className="neutral bg-background-paper/60!">
                {emailError ?? t("email-update-failed")}
              </Alert>
            )}
            <FormControl className="outlined" variant="standard" size="small" fullWidth>
              <Box className="flex flex-row items-center">
                <FormLabel component="label">{t("new-email")}</FormLabel>
                {emailForm.touched.email && emailForm.errors.email && (
                  <InputErrorTooltip title={emailForm.errors.email} />
                )}
              </Box>
              <Input
                name="email"
                type="email"
                autoComplete="email"
                placeholder={currentEmail || undefined}
                value={emailForm.values.email}
                onChange={emailForm.handleChange}
                onBlur={emailForm.handleBlur}
              />
            </FormControl>
            <Box>
              <Button type="submit" variant="outlined" size="small" disabled={emailForm.isSubmitting}>
                {t("change-email")}
              </Button>
            </Box>
          </Box>

          <Box component="form" onSubmit={passwordForm.handleSubmit} className="flex max-w-md flex-col gap-3">
            <Typography variant="subtitle2">{t("password-section")}</Typography>
            {passwordStatus === "saved" && (
              <Alert severity="success" className="neutral bg-background-paper/60!">
                {t("password-updated")}
              </Alert>
            )}
            {passwordStatus === "error" && (
              <Alert severity="error" className="neutral bg-background-paper/60!">
                {passwordError ?? t("password-update-failed")}
              </Alert>
            )}
            <FormControl className="outlined" variant="standard" size="small" fullWidth>
              <Box className="flex flex-row items-center">
                <FormLabel component="label">{t("new-password")}</FormLabel>
                {passwordForm.touched.password && passwordForm.errors.password && (
                  <InputErrorTooltip title={passwordForm.errors.password} />
                )}
              </Box>
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                value={passwordForm.values.password}
                onChange={passwordForm.handleChange}
                onBlur={passwordForm.handleBlur}
              />
            </FormControl>
            <FormControl className="outlined" variant="standard" size="small" fullWidth>
              <Box className="flex flex-row items-center">
                <FormLabel component="label">{t("confirm-password")}</FormLabel>
                {passwordForm.touched.confirm && passwordForm.errors.confirm && (
                  <InputErrorTooltip title={passwordForm.errors.confirm} />
                )}
              </Box>
              <Input
                name="confirm"
                type="password"
                autoComplete="new-password"
                value={passwordForm.values.confirm}
                onChange={passwordForm.handleChange}
                onBlur={passwordForm.handleBlur}
              />
            </FormControl>
            <Box>
              <Button type="submit" variant="outlined" size="small" disabled={passwordForm.isSubmitting}>
                {t("change-password")}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );
}
