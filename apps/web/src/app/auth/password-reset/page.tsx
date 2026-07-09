"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { Alert, Box, Button, Divider, FormControl, FormLabel, Input, Paper, Typography } from "@mui/material";

import Logo from "@/components/logo/logo";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

export default function Page() {
  const router = useRouter();
  const [data, setData] = useState({
    email: "",
  });
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    if (!isSupabaseConfigured) {
      setServerError("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
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
                  Reset Password
                </Typography>
                <Typography variant="body1" className="text-text-primary">
                  Get an email about how to reset your password securely.
                </Typography>
              </Box>

              <Box className="flex flex-col gap-5">
                <Box component={"form"} onSubmit={handleSubmit} className="flex flex-col">
                  <FormControl className="outlined" variant="standard" size="small">
                    <FormLabel component="label">Email</FormLabel>
                    <Input
                      placeholder=""
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
                      Continue
                    </Button>
                  </Box>

                  <Typography variant="body2" className="text-text-secondary">
                    By clicking Continue, Sign in with Google, or Sign in with GitHub, you agree to the{" "}
                    <Link
                      target="_blank"
                      href="/auth/terms-and-conditions"
                      className="link-primary link-underline-hover"
                    >
                      Terms and Conditions
                    </Link>{" "}
                    and{" "}
                    <Link target="_blank" href="/auth/privacy-policy" className="link-primary link-underline-hover">
                      Privacy Policy
                    </Link>
                    .
                  </Typography>
                </Box>
              </Box>
              <Divider className="text-text-secondary my-0 text-sm"></Divider>
              <Box className="flex flex-col">
                <Typography variant="h6" component="h6">
                  Sign in
                </Typography>
                <Typography variant="body1" className="text-text-secondary">
                  If you already have an account, please{" "}
                  <Link href="/auth/sign-in" className="link-primary link-underline-hover">
                    sign in
                  </Link>
                  .
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
