"use client";

import { registerExperimentFromPlanHypothesis } from "../experiments/actions";
import { useOrganization } from "../settings/organization/components/use-organization";
import CreativePlanCard, { type HypothesisCoverage, type PlanMeta } from "./components/creative-plan-card";
import CreativesBoard, { type CreativeCard } from "./components/creatives-board";
import { generateCreativePlan, getCreativePlanCreditInfo, materializeHypothesis } from "./plan-actions";
import type { CreativeStatus } from "./types";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  FormControl,
  Grid,
  MenuItem,
  Select,
  Skeleton,
  Typography,
} from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import LoadErrorState from "@/components/product/load-error-state";
import ProcessingOverlay, { type ProcessingStage } from "@/components/product/processing-overlay";
import NiBook from "@/icons/nexture/ni-book";
import NiBulbOn from "@/icons/nexture/ni-bulb-on";
import NiCamera from "@/icons/nexture/ni-camera";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiPlus from "@/icons/nexture/ni-plus";
import NiTag from "@/icons/nexture/ni-tag";
import type { CreativePlanOutput } from "@/lib/creative-plan/schema";
import { isCreativePlanOutput } from "@/lib/creative-plan/schema";
import { isCreativeFormat } from "@/lib/creative-taxonomy";
import { createClient } from "@flyee/auth/client";

/**
 * Job: "what should I make/test next, and why did the winners win?" Success:
 * a tagged library where patterns are visible. Grouped by test lifecycle, not
 * a management table. Zero data → the Creative Test Plan is the aha path (the
 * beginner with an empty library is exactly who it serves); manual entry stays
 * one click away. No product yet → nudge to product context.
 */

type ProductRow = { id: string; name: string };

/** The active plan: latest `diagnoses` row with scope='creative_plan'. */
type PlanState = { id: string; output: CreativePlanOutput; meta: PlanMeta };

export function CreativesExperience({
  forcedProductId,
  workspace = false,
}: {
  forcedProductId?: string;
  workspace?: boolean;
} = {}) {
  const t = useTranslations("creatives");
  const tc = useTranslations("productCommon");
  const router = useRouter();
  const requestedProductId = useSearchParams().get("product");
  const { configured, loading, orgs, currentOrg } = useOrganization();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [rows, setRows] = useState<CreativeCard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dataLoadError, setDataLoadError] = useState(false);

  const [plan, setPlan] = useState<PlanState | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [coverage, setCoverage] = useState<Record<string, HypothesisCoverage>>({});
  const [planCost, setPlanCost] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [materializingKey, setMaterializingKey] = useState<string | null>(null);
  const [registeringKey, setRegisteringKey] = useState<string | null>(null);

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
      setLoaded(true);
      return;
    }
    const list = (data as ProductRow[]) ?? [];
    setDataLoadError(false);
    setProducts(list);
    setProductId((current) => {
      if (forcedProductId && list.some((item) => item.id === forcedProductId)) return forcedProductId;
      return current ?? list[0]?.id ?? null;
    });
    if (list.length === 0) setLoaded(true);
  }, [currentOrg, forcedProductId]);

  const loadCreatives = useCallback(async () => {
    if (!productId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("creatives")
      .select("id, name, status, angle, hook, format")
      .eq("product_id", productId)
      .order("updated_at", { ascending: false });
    if (error) {
      setDataLoadError(true);
      setLoaded(true);
      return;
    }
    setDataLoadError(false);
    setRows(
      (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status as CreativeStatus,
        angle: row.angle,
        hook: row.hook,
        format: row.format,
      })),
    );
    setLoaded(true);
  }, [productId]);

  /**
   * The active plan + the REAL state of each hypothesis: link row → in
   * library; linked organic publications → published/read counts; journal row
   * → experiment. All read from the DB — coverage is never asserted.
   */
  const loadPlan = useCallback(async () => {
    if (!productId) return;
    const supabase = createClient();
    const { data: planRow, error } = await supabase
      .from("diagnoses")
      .select("id, output, created_at, knowledge_refs")
      .eq("product_id", productId)
      .eq("scope", "creative_plan")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      setPlanLoaded(true);
      return;
    }
    if (!planRow || !isCreativePlanOutput(planRow.output)) {
      setPlan(null);
      setCoverage({});
      setPlanLoaded(true);
      return;
    }

    const output = planRow.output as CreativePlanOutput;
    const [{ data: links }, { data: experimentRows }] = await Promise.all([
      supabase
        .from("creative_plan_links")
        .select("hypothesis_key, creative_id")
        .eq("diagnosis_id", planRow.id as string),
      supabase
        .from("experiments")
        .select("id, change_made")
        .eq("diagnosis_id", planRow.id as string),
    ]);

    const linkRows = (links ?? []) as { hypothesis_key: string; creative_id: string }[];
    const creativeIds = linkRows.map((link) => link.creative_id);
    const counts = new Map<string, number>();
    if (creativeIds.length > 0) {
      const { data: publications } = await supabase
        .from("organic_content_items")
        .select("creative_id")
        .in("creative_id", creativeIds)
        .limit(1000);
      for (const publication of (publications ?? []) as { creative_id: string | null }[]) {
        if (!publication.creative_id) continue;
        counts.set(publication.creative_id, (counts.get(publication.creative_id) ?? 0) + 1);
      }
    }

    // The experiment's change line embeds "[key]" (the idempotency anchor).
    const experimentByKey = new Map<string, string>();
    for (const row of (experimentRows ?? []) as { id: string; change_made: string | null }[]) {
      const match = /^Teste orgânico \[([^\]]+)\]/.exec(row.change_made ?? "");
      if (match) experimentByKey.set(match[1], row.id);
    }

    const nextCoverage: Record<string, HypothesisCoverage> = {};
    for (const hypothesis of output.hypotheses) {
      const link = linkRows.find((entry) => entry.hypothesis_key === hypothesis.key);
      nextCoverage[hypothesis.key] = {
        creativeId: link?.creative_id,
        organicCount: link ? (counts.get(link.creative_id) ?? 0) : 0,
        experimentId: experimentByKey.get(hypothesis.key),
      };
    }

    setPlan({
      id: planRow.id as string,
      output,
      meta: {
        createdAt: planRow.created_at as string,
        knowledgeRefs: (planRow.knowledge_refs as PlanMeta["knowledgeRefs"]) ?? [],
      },
    });
    setCoverage(nextCoverage);
    setPlanLoaded(true);
  }, [productId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);
  useEffect(() => {
    loadCreatives();
  }, [loadCreatives]);
  useEffect(() => {
    setPlanLoaded(false);
    loadPlan();
  }, [loadPlan]);
  useEffect(() => {
    if (!currentOrg) return;
    getCreativePlanCreditInfo(currentOrg.id).then((info) => {
      if (info.ok) setPlanCost(info.cost);
    });
  }, [currentOrg]);
  useEffect(() => {
    if (!workspace && requestedProductId) router.replace(`/products/${requestedProductId}/creatives`);
  }, [requestedProductId, router, workspace]);

  const handleGenerate = useCallback(async () => {
    if (!productId || generating) return;
    setGenerating(true);
    setActionError(null);
    const result = await generateCreativePlan(productId);
    if (result.ok) {
      await loadPlan();
    } else {
      setActionError(
        result.code === "insufficient_credits" && result.cost != null
          ? t("plan-error-credits", { cost: result.cost, balance: result.balance ?? 0 })
          : result.error,
      );
    }
    setGenerating(false);
  }, [generating, loadPlan, productId, t]);

  const handleMaterialize = useCallback(
    async (key: string) => {
      if (!plan || materializingKey) return;
      setMaterializingKey(key);
      setActionError(null);
      const result = await materializeHypothesis(plan.id, key);
      if (result.ok) {
        await Promise.all([loadPlan(), loadCreatives()]);
      } else {
        setActionError(result.error);
      }
      setMaterializingKey(null);
    },
    [loadCreatives, loadPlan, materializingKey, plan],
  );

  const handleRegisterExperiment = useCallback(
    async (key: string) => {
      if (!plan || registeringKey) return;
      setRegisteringKey(key);
      setActionError(null);
      const result = await registerExperimentFromPlanHypothesis(plan.id, key);
      if (result.ok) {
        await loadPlan();
      } else {
        setActionError(result.error);
      }
      setRegisteringKey(null);
    },
    [loadPlan, plan, registeringKey],
  );

  /** The REAL pipeline steps (context → library → knowledge → hypotheses). */
  const generatingStages: ProcessingStage[] = useMemo(
    () => [
      { icon: <NiTag />, label: t("plan-stage-context") },
      { icon: <NiCamera />, label: t("plan-stage-library") },
      { icon: <NiBook />, label: t("plan-stage-knowledge") },
      { icon: <NiBulbOn />, label: t("plan-stage-writing") },
    ],
    [t],
  );

  const hasProduct = Boolean(productId);
  const isEmpty = hasProduct && loaded && rows.length === 0;
  // The creative detail lives only at /creatives/[id] (no workspace-nested route).
  const creativeHref = (creativeId: string) => `/creatives/${creativeId}`;
  const experimentHref = (experimentId: string) =>
    workspace && productId ? `/products/${productId}/experiments/${experimentId}` : `/experiments/${experimentId}`;

  return (
    <Grid container spacing={5} className="items-start">
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
          <Grid size={{ xs: 12, md: "auto" }}>
            <Box className="flex flex-row items-center gap-2">
              {!workspace && products.length > 1 && productId && (
                <FormControl className="outlined w-56" variant="standard" size="small">
                  <Select
                    value={productId}
                    size="small"
                    variant="standard"
                    IconComponent={NiChevronDownSmall}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    {products.map((product) => (
                      <MenuItem key={product.id} value={product.id}>
                        {product.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {hasProduct && !isEmpty && (
                <Button
                  variant="contained"
                  startIcon={<NiPlus size="small" />}
                  onClick={() => router.push(`/creatives/new?product=${productId}`)}
                >
                  {t("new-creative")}
                </Button>
              )}
            </Box>
          </Grid>
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
                loadCreatives();
                loadPlan();
              }}
            />
          </Grid>
        )}

        {currentOrg && !dataLoadError && !loaded && (
          <Grid size={12}>
            <Skeleton variant="rounded" height={200} />
          </Grid>
        )}

        {/* No product yet: creatives hang off a product, so send them there first. */}
        {currentOrg && !dataLoadError && loaded && products.length === 0 && (
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

        {/* The active plan — the map of which evidence is still missing. */}
        {hasProduct && !dataLoadError && planLoaded && plan && (
          <Grid size={12}>
            <CreativePlanCard
              productId={productId ?? ""}
              plan={plan.output}
              meta={plan.meta}
              coverage={coverage}
              onMaterialize={handleMaterialize}
              materializingKey={materializingKey}
              onRegisterExperiment={handleRegisterExperiment}
              registeringKey={registeringKey}
              onRegenerate={handleGenerate}
              regenerating={generating}
              regenerateCost={planCost}
              creativeHref={creativeHref}
              experimentHref={experimentHref}
            />
          </Grid>
        )}

        {/* Empty library, no plan yet: the plan IS the path to value — a
            beginner has nothing to register manually, so generating hypotheses
            is the primary nudge and manual entry stays one click away. */}
        {!dataLoadError && isEmpty && planLoaded && !plan && (
          <Grid size={12}>
            <EmptyState
              icon={<NiCamera />}
              title={t("empty-title")}
              description={t("empty-plan-body")}
              action={{
                label: generating
                  ? t("plan-generating")
                  : planCost > 0
                    ? t("plan-generate-cost", { cost: planCost })
                    : t("plan-generate"),
                onClick: handleGenerate,
              }}
              secondaryAction={{ label: t("empty-cta"), href: `/creatives/new?product=${productId}` }}
            />
          </Grid>
        )}

        {/* Library has creatives but no plan: the board leads; the plan stays
            available as a secondary offer, not a nag. */}
        {!dataLoadError && hasProduct && loaded && rows.length > 0 && planLoaded && !plan && (
          <Grid size={12}>
            <Alert
              severity="info"
              className="neutral bg-background-paper/60!"
              action={
                <Button size="small" color="primary" disabled={generating} onClick={handleGenerate}>
                  {generating
                    ? t("plan-generating")
                    : planCost > 0
                      ? t("plan-generate-cost", { cost: planCost })
                      : t("plan-generate")}
                </Button>
              }
            >
              {t("plan-offer")}
            </Alert>
          </Grid>
        )}

        {hasProduct && loaded && rows.length > 0 && (
          <CreativesBoard
            creatives={rows}
            columnLabel={(status) => t(`status-${status}`)}
            angleLabel={t("field-angle")}
            formatLabel={(value) => (isCreativeFormat(value) ? t(`format-${value}`) : value)}
          />
        )}
      </Grid>

      <ProcessingOverlay
        open={generating}
        title={t("plan-generating")}
        stages={generatingStages}
        patienceLabel={t("plan-stage-patience")}
      />
    </Grid>
  );
}

export default function CreativesPage() {
  return <CreativesExperience />;
}
