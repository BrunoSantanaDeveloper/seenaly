"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Grid } from "@mui/material";

import LoadErrorState from "@/components/product/load-error-state";
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
  hasReadiness: boolean;
  hasMetaConnection: boolean;
  hasDiagnosis: boolean;
}

/**
 * Seenaly's activation flow: product context -> (optional) Meta Ads -> first
 * diagnosis. Steps are marked done by LIVE product state, so the checklist
 * reflects reality rather than clicks.
 *
 * Maturity-spectrum invariant (docs/PRODUCT.md #6): connecting Meta Ads is
 * `required: false` — it enriches the diagnosis, it never gates value. The
 * required path is context -> diagnosis, which a zero-data beginner can walk.
 *
 * This intentionally supersedes the template's generic onboarding scaffold
 * (`@/lib/onboarding` + OnboardingChecklistCard): that one is user-scoped and
 * click-based, whereas Seenaly's activation is org-scoped and reflects real
 * state. `ONBOARDING_STEPS` is kept empty so the two never both render — see
 * the note in `@/lib/onboarding`.
 */
export default function ActivationChecklist({ orgId, userId }: { orgId: string; userId: string }) {
  const t = useTranslations("activation");
  const [state, setState] = useState<OnboardingStateRow>(EMPTY_STATE);
  const [live, setLive] = useState<LiveState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const flowKey = { userId, orgId, flow: ACTIVATION_FLOW };

  const load = useCallback(async () => {
    setRefreshing(true);
    const supabase = createClient();
    const [
      persisted,
      { data: products, error: productsError },
      { data: connections, error: connectionsError },
      { count: diagnoses, error: diagnosesError },
      { count: readinessVerdicts, error: readinessError },
    ] = await Promise.all([
      getOnboardingState(supabase, { userId, orgId, flow: ACTIVATION_FLOW }),
      supabase.from("products").select("id, main_promise, target_cac").eq("org_id", orgId),
      supabase
        .from("connections")
        .select("id")
        .eq("org_id", orgId)
        .eq("provider", "meta-ads")
        .eq("status", "connected"),
      // Readiness verdicts live in the same table (scope = 'readiness') and
      // must NOT count as the first campaign diagnosis — they are a different
      // step of the journey.
      supabase
        .from("diagnoses")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .neq("scope", "readiness"),
      supabase
        .from("diagnoses")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("scope", "readiness"),
    ]);
    if (productsError || connectionsError || diagnosesError || readinessError) {
      setLoadError(true);
      setRefreshing(false);
      return;
    }
    setLoadError(false);
    setState(persisted);
    setLive({
      hasProduct: (products ?? []).length > 0,
      // "Enough context to reason with": a promise and a CAC guardrail.
      hasDepth: (products ?? []).some((p) => p.main_promise && p.target_cac !== null),
      hasReadiness: (readinessVerdicts ?? 0) > 0,
      hasMetaConnection: (connections ?? []).length > 0,
      // The activation moment: the org has received a real diagnosis.
      hasDiagnosis: (diagnoses ?? 0) > 0,
    });
    setRefreshing(false);
  }, [orgId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const dismiss = async () => {
    setState((current) => ({ ...current, dismissed: true }));
    await dismissFlow(createClient(), flowKey);
  };

  if (!live && loadError) {
    return (
      <Grid size={12}>
        <LoadErrorState
          title={t("load-error-title")}
          description={t("load-error-body")}
          retryLabel={t("retry")}
          onRetry={() => void load()}
          busy={refreshing}
        />
      </Grid>
    );
  }
  if (!live) return null;

  const steps: OnboardingStep[] = [
    { key: "product-context", title: t("step-product"), href: "/products/new", done: live.hasProduct },
    { key: "context-depth", title: t("step-depth"), href: "/products", done: live.hasDepth },
    // Before paying for traffic: audit the structure. Costs no media budget,
    // so it belongs ahead of both the Meta connection and the diagnosis.
    { key: "readiness", title: t("step-readiness"), href: "/readiness", done: live.hasReadiness },
    { key: "first-diagnosis", title: t("step-diagnosis"), href: "/diagnosis", done: live.hasDiagnosis },
    {
      key: "connect-meta",
      title: t("step-meta"),
      href: "/settings/connections",
      done: live.hasMetaConnection,
      // Never a prerequisite for value — only an enrichment.
      required: false,
    },
  ];

  // Decide visibility here (same rule as OnboardingChecklist) so callers never
  // wrap a null child in a layout slot and open an empty gap.
  if (state.dismissed || computeProgress(steps, state).complete) return null;

  return (
    <>
      {loadError && (
        <Grid size={12}>
          <LoadErrorState
            title={t("load-error-title")}
            description={t("load-error-body")}
            retryLabel={t("retry")}
            onRetry={() => void load()}
            busy={refreshing}
          />
        </Grid>
      )}
      <Grid size={12}>
        <OnboardingChecklist
          title={t("title")}
          description={t("description")}
          dismissLabel={t("dismiss")}
          optionalLabel={t("optional-label")}
          steps={steps}
          state={state}
          onDismiss={dismiss}
        />
      </Grid>
    </>
  );
}
