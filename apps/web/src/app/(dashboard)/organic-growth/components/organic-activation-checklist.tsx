"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

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
export const ORGANIC_ACTIVATION_FLOW = "organic-growth-activation";

interface LiveState {
  hasContext: boolean;
  hasSource: boolean;
  hasContent: boolean;
  hasReviewedClassification: boolean;
  hasReview: boolean;
}

/**
 * Org-scoped, state-driven path to the Organic Growth aha moment: the first
 * Review grounded in imported content. This stays separate from the app-wide
 * activation checklist because the add-on is optional.
 */
export default function OrganicActivationChecklist({ orgId, userId }: { orgId: string; userId: string }) {
  const t = useTranslations("organicGrowth");
  const [state, setState] = useState<OnboardingStateRow>(EMPTY_STATE);
  const [live, setLive] = useState<LiveState | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [
      persisted,
      settingsResult,
      contextResult,
      accountsResult,
      contentResult,
      classificationResult,
      reviewResult,
    ] = await Promise.all([
      getOnboardingState(supabase, { userId, orgId, flow: ORGANIC_ACTIVATION_FLOW }),
      supabase.from("organic_growth_settings").select("enabled").eq("org_id", orgId).maybeSingle(),
      supabase
        .from("social_account_products")
        .select("product_id, objective, desired_action")
        .eq("org_id", orgId)
        .eq("is_primary", true)
        .limit(1)
        .maybeSingle(),
      supabase.from("social_accounts").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("organic_content_items").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase
        .from("organic_content_classifications")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("source", "user"),
      supabase
        .from("organic_reviews")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "completed"),
    ]);
    const settings = settingsResult.data;
    const context = contextResult.data;
    setState(persisted);
    setLive({
      hasContext: Boolean(settings?.enabled && context?.product_id && context.objective && context.desired_action),
      hasSource: (accountsResult.count ?? 0) > 0,
      hasContent: (contentResult.count ?? 0) > 0,
      hasReviewedClassification: (classificationResult.count ?? 0) > 0,
      hasReview: (reviewResult.count ?? 0) > 0,
    });
  }, [orgId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const dismiss = async () => {
    setState((current) => ({ ...current, dismissed: true }));
    await dismissFlow(createClient(), { userId, orgId, flow: ORGANIC_ACTIVATION_FLOW });
  };

  if (!live) return null;

  const steps: OnboardingStep[] = [
    { key: "context", title: t("activation-step-context"), href: "/organic-growth/setup", done: live.hasContext },
    { key: "source", title: t("activation-step-source"), href: "/organic-growth/setup", done: live.hasSource },
    { key: "import", title: t("activation-step-import"), href: "/organic-growth/import", done: live.hasContent },
    {
      key: "classification",
      title: t("activation-step-classification"),
      href: "/organic-growth/content",
      done: live.hasReviewedClassification,
    },
    { key: "review", title: t("activation-step-review"), href: "/organic-growth", done: live.hasReview },
  ];

  if (state.dismissed || computeProgress(steps, state).complete) return null;

  return (
    <OnboardingChecklist
      title={t("activation-title")}
      description={t("activation-description")}
      steps={steps}
      state={state}
      onDismiss={dismiss}
    />
  );
}
