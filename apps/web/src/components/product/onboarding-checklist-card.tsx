"use client";

import { useCallback, useEffect, useState } from "react";

import OnboardingChecklist from "@/components/product/onboarding-checklist";
import { isOnboardingEnabled, ONBOARDING_FLOW, ONBOARDING_STEPS } from "@/lib/onboarding";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";
import { dismissFlow, getOnboardingState, type OnboardingStateRow } from "@flyee/onboarding";

/**
 * Drop-in activation card for the app home: reads the user's onboarding
 * state and renders the checklist until they're activated. Renders nothing
 * when onboarding is not declared, Supabase is unconfigured, the flow is
 * complete, or the user dismissed it — safe to mount unconditionally.
 */
export default function OnboardingChecklistCard({ title, className }: { title?: string; className?: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<OnboardingStateRow | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured || !isOnboardingEnabled) return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setState(await getOnboardingState(supabase, { userId: user.id, flow: ONBOARDING_FLOW }));
    };
    load();
  }, []);

  const handleDismiss = useCallback(async () => {
    if (!userId) return;
    setState((current) => (current ? { ...current, dismissed: true } : current));
    await dismissFlow(createClient(), { userId, flow: ONBOARDING_FLOW });
  }, [userId]);

  if (!state) return null;

  return (
    <OnboardingChecklist
      title={title}
      steps={ONBOARDING_STEPS}
      state={state}
      onDismiss={handleDismiss}
      className={className}
    />
  );
}
