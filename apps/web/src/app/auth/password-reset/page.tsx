"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import React, { useState } from "react";

import { Alert, Box, Button, Divider, FormControl, FormLabel, Input, Paper, Typography } from "@mui/material";

import Logo from "@/components/logo/logo";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

export default function Page() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [data, setData] = useState({
    email: "",
  });
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    if (!isSupabaseConfigured) {
      setServerError(t("error-not-configured"));
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/password-new`,
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    router.push("/auth/password-sent");
  };

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
                  {t("reset-password")}
                </Typography>
                <Typography variant="body1" className="text-text-primary">
                  {t("reset-subtitle")}
                </Typography>
              </Box>

              <Box className="flex flex-col gap-5">
                <Box component={"form"} onSubmit={handleSubmit} className="flex flex-col">
                  <FormControl className="outlined" variant="standard" size="small">
                    <FormLabel component="label">{t("email-label")}</FormLabel>
                    <Input
                      placeholder=""
                      type="email"
                      autoComplete="email"
                      value={data.email}
                      onChange={(e) => setData({ ...data, email: e.target.value })}
                    />
                  </FormControl>

                  {serverError && (
                    <Alert severity="error" className="neutral bg-background-paper/60! mb-4">
                      {serverError}
                    </Alert>
                  )}
                  <Box className="flex flex-col gap-2">
                    <Button type="submit" variant="contained" className="mb-4">
                      {t("continue")}
                    </Button>
                  </Box>

                  <Typography variant="body2" className="text-text-secondary">
                    {t.rich("legal-agreement", {
                      terms: (chunks) => (
                        <Link target="_blank" href="/legal/terms" className="link-primary link-underline-hover">
                          {chunks}
                        </Link>
                      ),
                      privacy: (chunks) => (
                        <Link target="_blank" href="/legal/privacy" className="link-primary link-underline-hover">
                          {chunks}
                        </Link>
                      ),
                    })}
                  </Typography>
                </Box>
              </Box>
              <Divider className="text-text-secondary my-0 text-sm"></Divider>
              <Box className="flex flex-col">
                <Typography variant="h6" component="h6">
                  {t("have-account-title")}
                </Typography>
                <Typography variant="body1" className="text-text-secondary">
                  {t.rich("have-account-body", {
                    link: (chunks) => (
                      <Link href="/auth/sign-in" className="link-primary link-underline-hover">
                        {chunks}
                      </Link>
                    ),
                  })}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
