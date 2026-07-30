"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Box, CircularProgress } from "@mui/material";

import { getOnboardingFlowKey, isOnboardingEnabled, ONBOARDING_STEPS } from "@/lib/onboarding";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";
import { computeProgress, getOnboardingState } from "@flyee/onboarding";

/**
 * Protects dashboard routes: if a new user has NOT completed the initial onboarding,
 * forces a redirect to `/onboarding` until the setup wizard is finished.
 */
export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const check = async () => {
      if (!isSupabaseConfigured || !isOnboardingEnabled) {
        if (active) setChecking(false);
        return;
      }

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (active) setChecking(false);
          return;
        }

        const key = await getOnboardingFlowKey(supabase, user.id);
        const state = await getOnboardingState(supabase, key);
        const progress = computeProgress(ONBOARDING_STEPS, state);

        // A failed READ is not "never onboarded" — redirecting on it bounced
        // a fully-onboarded user to /onboarding on any transient Supabase
        // failure (error ≠ empty). Unknown state fails OPEN: stay put.
        if (!state.readFailed && !state.completedAt && !progress.complete) {
          router.replace("/onboarding");
          return;
        }
      } catch {
        // Fall back gracefully on error to avoid blocking the user
      } finally {
        if (active) setChecking(false);
      }
    };

    check();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (checking) {
    return (
      <Box className="flex min-h-[50vh] w-full items-center justify-center p-4">
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
}
