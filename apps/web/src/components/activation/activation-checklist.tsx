"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  hasCreativeEvidence: boolean;
  hasMetaConnection: boolean;
  hasDiagnosis: boolean;
}

type ActivationProductRow = {
  id: string;
  main_promise: string | null;
  audience: string | null;
  connection_id: string | null;
};

/**
 * Live activation path. On the Home it is scoped to the explicitly active
 * product; on the portfolio it retains the organization-level overview.
 */
export default function ActivationChecklist({
  orgId,
  userId,
  productId,
  productName,
}: {
  orgId: string;
  userId: string;
  productId?: string;
  productName?: string;
}) {
  const t = useTranslations("activation");
  const [state, setState] = useState<OnboardingStateRow>(EMPTY_STATE);
  const [live, setLive] = useState<LiveState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const flow = productId ? `${ACTIVATION_FLOW}:${productId}` : ACTIVATION_FLOW;
  const flowKey = useMemo(() => ({ userId, orgId, flow }), [flow, orgId, userId]);

  const load = useCallback(async () => {
    setRefreshing(true);
    const supabase = createClient();

    const productsQuery = supabase
      .from("products")
      .select("id, main_promise, audience, connection_id")
      .eq("org_id", orgId);
    const paidDiagnosesQuery = supabase
      .from("diagnoses")
      .select("id", { count: "exact", head: true })
      .in("scope", ["product", "campaign"]);
    const readinessQuery = supabase
      .from("diagnoses")
      .select("id", { count: "exact", head: true })
      .eq("scope", "readiness");
    const creativePlanQuery = supabase
      .from("diagnoses")
      .select("id", { count: "exact", head: true })
      .eq("scope", "creative_plan");
    const creativesQuery = supabase.from("creatives").select("id", { count: "exact", head: true });

    const [
      persisted,
      { data: products, error: productsError },
      { count: diagnoses, error: diagnosesError },
      { count: readinessVerdicts, error: readinessError },
      { count: creativePlans, error: creativePlansError },
      { count: creatives, error: creativesError },
    ] = await Promise.all([
      getOnboardingState(supabase, flowKey),
      productId ? productsQuery.eq("id", productId) : productsQuery,
      productId ? paidDiagnosesQuery.eq("product_id", productId) : paidDiagnosesQuery.eq("org_id", orgId),
      productId ? readinessQuery.eq("product_id", productId) : readinessQuery.eq("org_id", orgId),
      productId ? creativePlanQuery.eq("product_id", productId) : creativePlanQuery.eq("org_id", orgId),
      productId ? creativesQuery.eq("product_id", productId) : creativesQuery.eq("org_id", orgId),
    ]);

    const productRows = (products ?? []) as ActivationProductRow[];
    let hasMetaConnection = false;
    let connectionsError = null;
    if (productId) {
      const connectionId = productRows[0]?.connection_id;
      if (connectionId) {
        const result = await supabase
          .from("connections")
          .select("id", { count: "exact", head: true })
          .eq("id", connectionId)
          .eq("provider", "meta-ads")
          .eq("status", "connected");
        hasMetaConnection = (result.count ?? 0) > 0;
        connectionsError = result.error;
      }
    } else {
      const result = await supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("provider", "meta-ads")
        .eq("status", "connected");
      hasMetaConnection = (result.count ?? 0) > 0;
      connectionsError = result.error;
    }

    if (productsError || connectionsError || diagnosesError || readinessError || creativePlansError || creativesError) {
      setLoadError(true);
      setRefreshing(false);
      return;
    }

    setLoadError(false);
    setState(persisted);
    setLive({
      hasProduct: productRows.length > 0,
      // Same essential context used by computeCompleteness: promise + audience
      // (the product name is guaranteed for a persisted product).
      hasDepth: productRows.some((product) => Boolean(product.main_promise && product.audience)),
      hasReadiness: (readinessVerdicts ?? 0) > 0,
      hasCreativeEvidence: (creativePlans ?? 0) > 0 || (creatives ?? 0) > 0,
      hasMetaConnection,
      hasDiagnosis: (diagnoses ?? 0) > 0,
    });
    setRefreshing(false);
  }, [flowKey, orgId, productId]);

  useEffect(() => {
    void load();
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

  const href = (stage: "context" | "readiness" | "creatives" | "diagnosis") =>
    productId ? `/products/${productId}${stage === "context" ? "" : `/${stage}`}` : `/${stage}`;
  const steps: OnboardingStep[] = [
    {
      key: "product-context",
      title: t("step-product"),
      href: productId ? href("context") : "/products/new",
      done: live.hasProduct,
    },
    { key: "context-depth", title: t("step-depth"), href: href("context"), done: live.hasDepth },
    { key: "readiness", title: t("step-readiness"), href: href("readiness"), done: live.hasReadiness },
    {
      key: "creative-evidence",
      title: t("step-creative-evidence"),
      href: href("creatives"),
      done: live.hasCreativeEvidence,
    },
    { key: "first-diagnosis", title: t("step-diagnosis"), href: href("diagnosis"), done: live.hasDiagnosis },
    {
      key: "connect-meta",
      title: t("step-meta"),
      href: productId ? href("context") : "/settings/connections",
      done: live.hasMetaConnection,
      required: false,
    },
  ];

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
          title={productName ? t("title-product", { product: productName }) : t("title")}
          description={productName ? t("description-product") : t("description")}
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
