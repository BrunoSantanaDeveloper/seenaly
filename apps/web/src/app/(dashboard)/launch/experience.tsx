"use client";

import { registerExperimentFromLaunchStep } from "../experiments/actions";
import { useOrganization } from "../settings/organization/components/use-organization";
import { generateLaunchPlan, getLaunchPlanCreditInfo } from "./actions";
import LaunchPlanCard, { type LaunchPlanMeta } from "./components/launch-plan-card";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Breadcrumbs, FormControl, Grid, MenuItem, Select, Skeleton, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import LoadErrorState from "@/components/product/load-error-state";
import ProcessingOverlay, { type ProcessingStage } from "@/components/product/processing-overlay";
import NextTaskCard from "@/components/product-workspace/next-task";
import NiBook from "@/icons/nexture/ni-book";
import NiCrosshair from "@/icons/nexture/ni-crosshair";
import NiMoney from "@/icons/nexture/ni-money";
import NiRocket from "@/icons/nexture/ni-rocket";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiTag from "@/icons/nexture/ni-tag";
import { track } from "@/lib/analytics";
import { isLaunchPlanOutput, type LaunchPlanOutput } from "@/lib/launch-plan/schema";
import { createClient } from "@flyee/auth/client";

/**
 * Job: "with the structure I've proved and the money I've declared, what is
 * the smallest paid bet I should place first — and what should I leave
 * alone while it runs?" Success: the reader leaves knowing ONE event, ONE
 * daily number, an ordered sequence with preconditions, and a "do not
 * touch" list — the exact penhasco docs/PRODUCT.md phase 9 exists to close.
 *
 * Not a table of past plans: like diagnosis and the creative plan, the
 * LATEST plan is the screen. Zero-data is a supported first-run state, not
 * an error — this engine works without a Prontidão verdict or a Creative
 * Test Plan, it just says so honestly in the output.
 */

const STEP_KEY_PATTERN = /^Etapa do lançamento \[([^\]]+)\]/;

type ProductRow = { id: string; name: string };
type PlanState = { id: string; output: LaunchPlanOutput; meta: LaunchPlanMeta };

export function LaunchExperience({
  forcedProductId,
  workspace = false,
}: {
  forcedProductId?: string;
  workspace?: boolean;
} = {}) {
  const t = useTranslations("launchPlan");
  const tc = useTranslations("productCommon");
  const router = useRouter();
  // useSearchParams() must run unconditionally (rules-of-hooks) — called on
  // its own line first, with the forcedProductId fallback applied to its
  // RESULT rather than short-circuiting the call itself via `??`.
  const searchParams = useSearchParams();
  const requestedProductId = forcedProductId ?? searchParams.get("product");
  const { configured, loading, orgs, currentOrg } = useOrganization();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [dataLoadError, setDataLoadError] = useState(false);

  const [plan, setPlan] = useState<PlanState | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [registeredStepExperiments, setRegisteredStepExperiments] = useState<Record<string, string>>({});
  const [planCost, setPlanCost] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [registeringStepKey, setRegisteringStepKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    if (!currentOrg) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .eq("org_id", currentOrg.id)
      .order("updated_at", { ascending: false });
    if (error) {
      setDataLoadError(true);
      setProductsLoaded(true);
      return;
    }
    const list = (data as ProductRow[]) ?? [];
    setDataLoadError(false);
    setProducts(list);
    setProductId((current) => {
      if (requestedProductId && list.some((item) => item.id === requestedProductId)) return requestedProductId;
      return current ?? list[0]?.id ?? null;
    });
    setProductsLoaded(true);
  }, [currentOrg, requestedProductId]);

  const loadPlan = useCallback(async () => {
    if (!productId) return;
    const supabase = createClient();
    const { data: planRow, error } = await supabase
      .from("diagnoses")
      .select("id, output, created_at, knowledge_refs")
      .eq("product_id", productId)
      .eq("scope", "launch_plan")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      setPlanLoaded(true);
      return;
    }
    if (!planRow || !isLaunchPlanOutput(planRow.output)) {
      setPlan(null);
      setRegisteredStepExperiments({});
      setPlanLoaded(true);
      return;
    }
    const output = planRow.output;
    const { data: experimentRows } = await supabase
      .from("experiments")
      .select("id, change_made")
      .eq("diagnosis_id", planRow.id as string);
    const byKey: Record<string, string> = {};
    for (const row of (experimentRows ?? []) as { id: string; change_made: string | null }[]) {
      const match = STEP_KEY_PATTERN.exec(row.change_made ?? "");
      if (match) byKey[match[1]] = row.id;
    }
    setPlan({
      id: planRow.id as string,
      output,
      meta: {
        createdAt: planRow.created_at as string,
        knowledgeRefs: (planRow.knowledge_refs as LaunchPlanMeta["knowledgeRefs"]) ?? [],
      },
    });
    setRegisteredStepExperiments(byKey);
    setPlanLoaded(true);
  }, [productId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);
  useEffect(() => {
    setPlanLoaded(false);
    loadPlan();
  }, [loadPlan]);
  useEffect(() => {
    if (!currentOrg) return;
    getLaunchPlanCreditInfo(currentOrg.id).then((info) => {
      if (info.ok) setPlanCost(info.cost);
    });
  }, [currentOrg]);
  useEffect(() => {
    if (!workspace && requestedProductId) router.replace(`/products/${requestedProductId}/launch`);
  }, [requestedProductId, router, workspace]);

  const handleGenerate = useCallback(async () => {
    if (!productId || generating) return;
    setGenerating(true);
    setActionError(null);
    const result = await generateLaunchPlan(productId);
    if (result.ok) {
      track("launch_plan_generated");
      await loadPlan();
    } else {
      setActionError(
        result.code === "insufficient_credits" && result.cost != null
          ? t("error-insufficient-credits-detail", { cost: result.cost, balance: result.balance ?? 0 })
          : t(`error-${result.code}`),
      );
    }
    setGenerating(false);
  }, [generating, loadPlan, productId, t]);

  const handleRegisterStep = useCallback(
    async (key: string) => {
      if (!plan || registeringStepKey) return;
      setRegisteringStepKey(key);
      setActionError(null);
      const result = await registerExperimentFromLaunchStep(plan.id, key);
      if (result.ok) {
        track("experiment_registered");
        await loadPlan();
        // A registered step leaves the queue — re-read the rail so it agrees.
        if (workspace) router.refresh();
      } else {
        setActionError(result.error);
      }
      setRegisteringStepKey(null);
    },
    [loadPlan, plan, registeringStepKey, router, workspace],
  );

  const generatingStages: ProcessingStage[] = [
    { icon: <NiTag />, label: t("stage-context") },
    { icon: <NiShieldCheck />, label: t("stage-readiness") },
    { icon: <NiBook />, label: t("stage-knowledge") },
    { icon: <NiMoney />, label: t("stage-math") },
    { icon: <NiCrosshair />, label: t("stage-writing") },
  ];

  const hasProduct = Boolean(productId);
  const ready = productsLoaded && (!hasProduct || planLoaded);
  const creativesHref = workspace && productId ? `/products/${productId}/creatives` : `/creatives?product=${productId}`;
  const readinessHref = workspace && productId ? `/products/${productId}/readiness` : `/readiness?product=${productId}`;
  const productContextHref = workspace && productId ? `/products/${productId}` : `/products/${productId}`;
  const experimentHref = (experimentId: string) =>
    workspace && productId ? `/products/${productId}/experiments/${experimentId}` : `/experiments/${experimentId}`;

  return (
    <Grid container spacing={5} className="items-start">
      <ProcessingOverlay
        open={generating}
        title={t("generating")}
        stages={generatingStages}
        patienceLabel={t("stage-patience")}
      />
      <Grid size={"grow"} spacing={5} container>
        <Grid size={12} spacing={2.5} container className="items-center">
          <Grid size={{ xs: 12, md: "grow" }}>
            <Typography variant={workspace ? "h2" : "h1"} component={workspace ? "h2" : "h1"} className="mb-0">
              {t("title")}
            </Typography>
            <Breadcrumbs>
              <Link color="inherit" href="/home">
                {t("crumb-home")}
              </Link>
              <Typography variant="body2">{t("title")}</Typography>
            </Breadcrumbs>
          </Grid>
          {!workspace && products.length > 1 && productId && (
            <Grid size={{ xs: 12, md: "auto" }}>
              <FormControl className="outlined w-56" variant="standard" size="small">
                <Select
                  value={productId}
                  size="small"
                  variant="standard"
                  onChange={(e) => setProductId(e.target.value)}
                >
                  {products.map((product) => (
                    <MenuItem key={product.id} value={product.id}>
                      {product.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>

        {!configured && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("not-configured")}
            </Alert>
          </Grid>
        )}

        {configured && !loading && orgs.length === 0 && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("no-org")}
            </Alert>
          </Grid>
        )}

        {currentOrg && dataLoadError && (
          <Grid size={12}>
            <LoadErrorState
              title={tc("load-error-title")}
              description={tc("load-error-body")}
              retryLabel={tc("retry")}
              onRetry={() => {
                setDataLoadError(false);
                loadProducts();
                loadPlan();
              }}
            />
          </Grid>
        )}

        {currentOrg && !dataLoadError && !ready && (
          <Grid size={12}>
            <Skeleton variant="rounded" height={280} />
          </Grid>
        )}

        {currentOrg && !dataLoadError && ready && products.length === 0 && (
          <Grid size={12}>
            <EmptyState
              icon={<NiTag />}
              title={t("no-product-title")}
              description={t("no-product-body")}
              action={{ label: t("no-product-cta"), href: "/products/new" }}
            />
          </Grid>
        )}

        {actionError && (
          <Grid size={12}>
            <Alert severity="error" className="neutral bg-background-paper/60!" onClose={() => setActionError(null)}>
              {actionError}
            </Alert>
          </Grid>
        )}

        {hasProduct && !dataLoadError && ready && plan && (
          <Grid size={12}>
            <LaunchPlanCard
              plan={plan.output}
              meta={plan.meta}
              registeredStepExperiments={registeredStepExperiments}
              onRegisterStep={handleRegisterStep}
              registeringStepKey={registeringStepKey}
              onRegenerate={handleGenerate}
              regenerating={generating}
              regenerateCost={planCost}
              creativesHref={creativesHref}
              readinessHref={readinessHref}
              productContextHref={productContextHref}
              experimentHref={experimentHref}
            />
          </Grid>
        )}

        {/* No plan yet: this IS the aha path. The bridge framing carries even
            with zero Prontidão/creative evidence — the engine degrades
            honestly rather than gating on either. */}
        {hasProduct && !dataLoadError && ready && !plan && (
          <Grid size={12}>
            <EmptyState
              icon={<NiRocket />}
              title={t("empty-title")}
              description={t("empty-body")}
              action={{
                label: generating
                  ? t("generating")
                  : planCost > 0
                    ? t("generate-cost", { cost: planCost })
                    : t("generate"),
                onClick: handleGenerate,
              }}
            />
          </Grid>
        )}

        {workspace && (
          <Grid size={12}>
            <NextTaskCard skipSource="launch_plan" />
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}

export default function LaunchPage() {
  return <LaunchExperience />;
}
