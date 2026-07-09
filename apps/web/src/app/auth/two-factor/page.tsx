"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, Box, Button, FormControl, FormLabel, Input, Paper, Typography } from "@mui/material";

import Logo from "@/components/logo/logo";
import { DEFAULTS } from "@/config";
import { resolvePostAuthDestination } from "@/lib/onboarding";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

/** Step-up screen: verifies the TOTP code and raises the session to AAL2. */
export default function TwoFactor() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured) {
        router.replace("/auth/sign-in");
        return;
      }
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find((factor) => factor.status === "verified");
      if (!totp) {
        // No verified factor — nothing to challenge.
        router.replace(DEFAULTS.appRoot);
        return;
      }
      setFactorId(totp.id);
    };
    load();
  }, [router]);

  const verify = async () => {
    if (!factorId || code.trim().length < 6 || busy) return;
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) {
        setError(challengeError?.message ?? "Could not start the challenge.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const destination = user ? await resolvePostAuthDestination(supabase, user.id) : DEFAULTS.appRoot;
      router.push(next ?? destination);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/sign-in");
    router.refresh();
  };

  return (
    <Box className="bg-waves flex min-h-screen w-full items-center justify-center bg-cover bg-center p-4">
      <Paper elevation={3} className="bg-background-paper shadow-darker-xs w-lg max-w-full rounded-4xl py-14">
        <Box className="flex flex-col gap-6 px-8 sm:px-14">
          <Box className="flex justify-center">
            <Logo classNameMobile="hidden" />
          </Box>
          <Box className="flex flex-col">
            <Typography variant="h1" component="h1" className="mb-2">
              Two-factor authentication
            </Typography>
            <Typography variant="body1" className="text-text-primary">
              Enter the 6-digit code from your authenticator app to continue.
            </Typography>
          </Box>

          <Box
            component="form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              verify();
            }}
          >
            <FormControl className="outlined" variant="standard" size="small">
              <FormLabel component="label">Authentication code</FormLabel>
              <Input
                autoFocus
                value={code}
                inputProps={{ inputMode: "numeric", maxLength: 6 }}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              />
            </FormControl>

            {error && (
              <Alert severity="error" className="neutral bg-background-paper/60!">
                {error}
              </Alert>
            )}

            <Button type="submit" variant="contained" disabled={!factorId || code.length < 6 || busy}>
              {busy ? "Verifying..." : "Verify"}
            </Button>
            <Button color="grey" variant="text" onClick={signOut}>
              Sign out and use another account
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
