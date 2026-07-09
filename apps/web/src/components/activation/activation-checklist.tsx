"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Grid } from "@mui/material";

import OnboardingChecklist from "@/components/product/onboarding-checklist";
import { createClient } from "@flyee/auth/client";
import {
  computeProgress,
  dismissFlow,
  getOnboardingState,
  type OnboardingStateRow,
  type OnboardingStep,
} from "@flyee/onboarding";

const EMPTY_STATE: OnboardingStateRow = { completedSteps: [], dismissed: false, completedAt: null };
export const ACTIVATION_FLOW = "activation";

interface LiveState {
  hasProduct: boolean;
  hasDepth: boolean;
  hasMetaConnection: boolean;
}

/**
 * Seenaly's activation flow: product context -> (optional) Meta Ads -> first
 * diagnosis. Steps are marked done by LIVE product state, so the checklist
 * reflects reality rather than clicks.
 *
 * Maturity-spectrum invariant (docs/PRODUCT.md #6): connecting Meta Ads is
 * `required: false` — it enriches the diagnosis, it never gates value. The
 * required path is context -> diagnosis, which a zero-data beginner can walk.
 */
export default function ActivationChecklist({ orgId, userId }: { orgId: string; userId: string }) {
  const t = useTranslations("activation");
  const [state, setState] = useState<OnboardingStateRow>(EMPTY_STATE);
  const [live, setLive] = useState<LiveState | null>(null);

  const flowKey = { userId, orgId, flow: ACTIVATION_FLOW };

  const load = useCallback(async () => {
    const supabase = createClient();
    const [persisted, { data: products }, { data: connections }] = await Promise.all([
      getOnboardingState(supabase, { userId, orgId, flow: ACTIVATION_FLOW }),
      supabase.from("products").select("id, main_promise, target_cac").eq("org_id", orgId),
      supabase
        .from("connections")
        .select("id")
        .eq("org_id", orgId)
        .eq("provider", "meta-ads")
        .eq("status", "connected"),
    ]);
    setState(persisted);
    setLive({
      hasProduct: (products ?? []).length > 0,
      // "Enough context to reason with": a promise and a CAC guardrail.
      hasDepth: (products ?? []).some((p) => p.main_promise && p.target_cac !== null),
      hasMetaConnection: (connections ?? []).length > 0,
    });
  }, [orgId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const dismiss = async () => {
    setState((current) => ({ ...current, dismissed: true }));
    await dismissFlow(createClient(), flowKey);
  };

  if (!live) return null;

  const steps: OnboardingStep[] = [
    { key: "product-context", title: t("step-product"), href: "/products/new", done: live.hasProduct },
    { key: "context-depth", title: t("step-depth"), href: "/products", done: live.hasDepth },
    {
      key: "connect-meta",
      title: t("step-meta"),
      href: "/settings/connections",
      done: live.hasMetaConnection,
      // Never a prerequisite for value — only an enrichment.
      required: false,
    },
    // Becomes actionable when the diagnostic engine ships (roadmap phase 3).
    { key: "first-diagnosis", title: t("step-diagnosis"), done: false },
  ];

  // Decide visibility here (same rule as OnboardingChecklist) so callers never
  // wrap a null child in a layout slot and open an empty gap.
  if (state.dismissed || computeProgress(steps, state).complete) return null;

  return (
    <Grid size={12}>
      <OnboardingChecklist
        title={t("title")}
        description={t("description")}
        steps={steps}
        state={state}
        onDismiss={dismiss}
      />
    </Grid>
  );
}
