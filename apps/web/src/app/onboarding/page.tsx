"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Box, Typography } from "@mui/material";

import Logo from "@/components/logo/logo";
import SetupWizard, { type WizardStep } from "@/components/product/setup-wizard";
import { DEFAULTS } from "@/config";
import { getOnboardingFlowKey, isOnboardingEnabled, ONBOARDING_STEPS } from "@/lib/onboarding";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";
import { completeStep, type FlowKey, getOnboardingState } from "@flyee/onboarding";

/**
 * Post-signup setup — the path to the aha moment, NOT a demo dashboard.
 * Guards itself: with no declared flow (template default) or an already
 * activated user, it steps aside to the app root.
 *
 * Derived projects replace WIZARD_STEPS with the real setup/personalization
 * screens and, per the onboarding research, close with a screen that SHOWS
 * what the answers unlocked (a populated home beats an empty one).
 */
export default function Onboarding() {
  const router = useRouter();
  const t = useTranslations("product");
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

  const finish = async () => {
    if (!flowKey) return;
    const supabase = createClient();
    const required = ONBOARDING_STEPS.filter((step) => step.required !== false).map((step) => step.key);
    // Mark the wizard's own step; the remaining checklist steps live on the
    // app home, where progress keeps nudging the user (completion drive).
    await completeStep(supabase, flowKey, "welcome", required);
    router.push(DEFAULTS.appRoot);
    router.refresh();
  };

  if (!ready) return null;

  // Replace with the project's real setup steps.
  const steps: WizardStep[] = [
    {
      title: t("onboardingTitle"),
      hint: t("onboardingHint"),
      content: (
        <Typography variant="body1" className="text-text-secondary leading-6">
          {t("onboardingScaffold")}
        </Typography>
      ),
    },
  ];

  return (
    <Box className="flex min-h-screen w-full flex-col items-center justify-center gap-8 p-4">
      <Logo classNameMobile="hidden" />
      <SetupWizard steps={steps} onComplete={finish} completeLabel={t("getStarted")} />
    </Box>
  );
}
