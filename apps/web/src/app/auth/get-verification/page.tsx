"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Alert, AlertTitle, Box, Divider, Paper, Typography } from "@mui/material";

import Logo from "@/components/logo/logo";
import NiCheckSquare from "@/icons/nexture/ni-check-square";

/**
 * Post-signup landing when the Supabase project requires email confirmation.
 * Honest single-purpose screen: tell the user a confirmation LINK was sent
 * (Supabase's default flow) and how to proceed. The template's demo version
 * with fake masked phone/email options was replaced at launch prep.
 */
export default function Page() {
  const t = useTranslations("auth");

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
                  {t("verify-title")}
                </Typography>
                <Typography variant="body1" className="text-text-primary">
                  {t("verify-body")}
                </Typography>
              </Box>

              <Alert severity="success" icon={<NiCheckSquare />} className="neutral bg-background-paper/60!">
                <AlertTitle variant="subtitle2">{t("email-sent-title")}</AlertTitle>
              </Alert>

              <Divider className="text-text-secondary my-0 text-sm"></Divider>
              <Box className="flex flex-col">
                <Typography variant="body1" className="text-text-secondary">
                  {t.rich("verify-back", {
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
