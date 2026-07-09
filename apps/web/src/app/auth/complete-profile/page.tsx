"use client";
import { useFormik } from "formik";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import * as yup from "yup";

import {
  Alert,
  AlertTitle,
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";

import Logo from "@/components/logo/logo";
import { DEFAULTS } from "@/config";
import NiCrossSquare from "@/icons/nexture/ni-cross-square";
import { resolvePostAuthDestination } from "@/lib/onboarding";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

const validationSchema = yup.object({
  name: yup.string().required("The field is required").min(3, "Should be at least 3 characters"),
  company: yup.string().required("The field is required").min(3, "Should be at least 3 characters"),
});

const InputErrorTooltip = ({ title }: { title: string }) => {
  return (
    <Box className="relative">
      <Tooltip title={title} arrow className="absolute -top-1.5">
        <Button
          startIcon={<NiCrossSquare size="small" />}
          color="error"
          size="small"
          className="group icon-only bg-transparent! outline-0!"
        ></Button>
      </Tooltip>
    </Box>
  );
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    // NFD splits an accented letter into base + combining mark; strip the
    // marks so the slug stays clean ASCII.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Setup step for a first-time OAuth (Google/GitHub) user: OAuth provisions the
 * account but never runs the sign-up form, so we collect the company name here
 * and create their first organization (the piece the sign-up trigger does for
 * email/password users). Name is pre-filled from the provider profile.
 *
 * Guards itself: a user who already belongs to an organization is redirected
 * to the app, so the page can't be reached spuriously.
 */
export default function Page() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const formik = useFormik({
    initialValues: { name: "", company: "" },
    validationSchema,
    validateOnBlur: false,
    validateOnMount: false,
    onSubmit: async (values) => {
      setServerError(null);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/sign-in");
        return;
      }

      // Keep the profile display name in sync if the user edited it.
      await supabase.from("profiles").update({ display_name: values.name.trim() }).eq("id", user.id);

      // create_organization (security definer) makes the caller the owner —
      // the RLS-safe path to insert an org + first membership.
      const slug = `${slugify(values.company)}-${Math.random().toString(36).slice(2, 8)}`;
      const { error } = await supabase.rpc("create_organization", {
        org_name: values.company.trim(),
        org_slug: slug,
      });
      if (error) {
        setServerError(error.message);
        return;
      }

      const destination = await resolvePostAuthDestination(supabase, user.id);
      router.push(destination);
      router.refresh();
    },
  });

  const { resetForm } = formik;

  useEffect(() => {
    const check = async () => {
      if (!isSupabaseConfigured) {
        router.replace("/auth/sign-in");
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/sign-in");
        return;
      }
      // Already set up (has an organization) -> nothing to complete.
      const { data: membership } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (membership) {
        router.replace(DEFAULTS.appRoot);
        return;
      }
      const meta = user.user_metadata ?? {};
      const suggestedName = meta.full_name ?? meta.name ?? meta.display_name ?? user.email?.split("@")[0] ?? "";
      resetForm({ values: { name: suggestedName, company: "" } });
      setReady(true);
    };
    check();
  }, [router, resetForm]);

  if (!ready) return null;

  return (
    <Box className="bg-waves flex min-h-screen w-full items-center justify-center bg-cover bg-center p-4">
      <Paper elevation={3} className="bg-background-paper shadow-darker-xs w-lg max-w-full rounded-4xl py-14">
        <Box className="flex flex-col gap-4 px-8 sm:px-14">
          <Box className="flex flex-col">
            <Box className="mb-14 flex justify-center">
              <Logo classNameMobile="hidden" />
            </Box>

            <Box className="flex flex-col gap-10">
              <Box className="flex flex-col">
                <Typography variant="h1" component="h1" className="mb-2">
                  Almost there
                </Typography>
                <Typography variant="body1" className="text-text-primary">
                  Tell us your organization name to finish setting up your account.
                </Typography>
              </Box>

              <Box
                component={"form"}
                onSubmit={(event) => {
                  setSubmitted(true);
                  formik.handleSubmit(event);
                }}
                className="flex flex-col"
              >
                <FormControl className="outlined" variant="standard" size="small">
                  <FormLabel component="label" className="flex flex-row">
                    Name
                    {formik.touched.name && formik.errors.name && <InputErrorTooltip title={formik.errors.name} />}
                  </FormLabel>
                  <Input
                    id="name"
                    name="name"
                    value={formik.values.name}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                </FormControl>

                <FormControl className="outlined" variant="standard" size="small">
                  <FormLabel component="label" className="flex flex-row">
                    Company
                    {formik.touched.company && formik.errors.company && (
                      <InputErrorTooltip title={formik.errors.company} />
                    )}
                  </FormLabel>
                  <Input
                    id="company"
                    name="company"
                    value={formik.values.company}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                </FormControl>

                {submitted && !formik.isValid && (
                  <Alert severity="error" icon={<NiCrossSquare />} className="neutral bg-background-paper/60! mb-4">
                    <AlertTitle variant="subtitle2">Please complete the required fields.</AlertTitle>
                  </Alert>
                )}

                {serverError && (
                  <Alert severity="error" icon={<NiCrossSquare />} className="neutral bg-background-paper/60! mb-4">
                    <AlertTitle variant="subtitle2">Could not finish setup</AlertTitle>
                    <Typography variant="body2" className="text-text-primary">
                      {serverError}
                    </Typography>
                  </Alert>
                )}

                <Button type="submit" variant="contained" className="mb-4" disabled={formik.isSubmitting}>
                  Continue
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
