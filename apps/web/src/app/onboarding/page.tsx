"use client";

import ProductForm from "../(dashboard)/products/components/product-form";
import { useOrganization } from "../(dashboard)/settings/organization/components/use-organization";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Alert, Box, CircularProgress, Container, Paper, Typography } from "@mui/material";

import Logo from "@/components/logo/logo";
import { DEFAULTS } from "@/config";
import NiSparkle from "@/icons/nexture/ni-sparkle";
import { getOnboardingFlowKey, isOnboardingEnabled, ONBOARDING_STEPS } from "@/lib/onboarding";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";
import { completeStep, type FlowKey, getOnboardingState } from "@flyee/onboarding";

/**
 * Post-signup full-screen setup wizard — forced on first login for new users.
 * Collects the core Product Context (the heart of Seenaly's AI engine)
 * before releasing the user into the main dashboard.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations("product");
  const { configured, loading: orgLoading, currentOrg } = useOrganization();
  const [flowKey, setFlowKey] = useState<FlowKey | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!isSupabaseConfigured || !isOnboardingEnabled) {
        router.replace(DEFAULTS.appRoot);
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
      const key = await getOnboardingFlowKey(supabase, user.id);
      const state = await getOnboardingState(supabase, key);
      if (state.completedAt) {
        router.replace(DEFAULTS.appRoot);
        return;
      }
      setFlowKey(key);
      setReady(true);
    };
    check();
  }, [router]);

  const handleProductSaved = async (productId: string) => {
    if (flowKey) {
      const supabase = createClient();
      const required = ONBOARDING_STEPS.filter((step) => step.required !== false).map((step) => step.key);
      await completeStep(supabase, flowKey, "welcome-and-product", required);
    }
    router.push(`/readiness?product=${productId}&new=1`);
    router.refresh();
  };

  if (!ready || orgLoading) {
    return (
      <Box className="flex min-h-screen w-full items-center justify-center p-4">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="bg-waves flex min-h-screen w-full flex-col items-center justify-center bg-cover bg-center px-4 py-10">
      <Container maxWidth="lg" className="flex flex-col items-center gap-8">
        <Box className="flex flex-col items-center text-center">
          <Logo classNameMobile="hidden" />
        </Box>

        <Paper elevation={3} className="bg-background-paper shadow-darker-xs w-full max-w-4xl rounded-4xl p-6 sm:p-10">
          <Box className="mb-8 flex flex-col gap-2 text-center sm:text-left">
            <Box className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
                <NiSparkle size="medium" />
              </span>
              <Typography variant="h2" component="h1">
                {t("onboardingTitle")}
              </Typography>
            </Box>
            <Typography variant="body1" className="text-text-secondary max-w-2xl leading-relaxed">
              {t("onboardingHint")}
            </Typography>
          </Box>

          {!configured && (
            <Alert severity="info" className="neutral bg-background-paper/60! mb-6">
              {t("not-configured")}
            </Alert>
          )}

          {configured && currentOrg && (
            <ProductForm orgId={currentOrg.id} variant="wizard" onSaveSuccess={handleProductSaved} />
          )}
        </Paper>
      </Container>
    </Box>
  );
}
