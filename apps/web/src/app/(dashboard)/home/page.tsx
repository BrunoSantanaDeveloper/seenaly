"use client";

import { computeCompleteness } from "../products/lib/completeness";
import { mapProductRow } from "../products/lib/map";
import type { ProductWithChildren } from "../products/types";
import { useOrganization } from "../settings/organization/components/use-organization";
import TaskQueueCard, { TaskQueueEmptyCard } from "./components/task-queue-card";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Skeleton,
  Typography,
} from "@mui/material";

import ActivationChecklist from "@/components/activation/activation-checklist";
import { TONE, type Tone } from "@/components/marketing/tone";
import EmptyState from "@/components/product/empty-state";
import LoadErrorState from "@/components/product/load-error-state";
import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiCamera from "@/icons/nexture/ni-camera";
import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";
import NiCheck from "@/icons/nexture/ni-check";
import NiDatabase from "@/icons/nexture/ni-database";
import NiFlask from "@/icons/nexture/ni-flask";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiRocket from "@/icons/nexture/ni-rocket";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiSparkle from "@/icons/nexture/ni-sparkle";
import NiTag from "@/icons/nexture/ni-tag";
import NiTrendUp from "@/icons/nexture/ni-trend-up";
import { isCreativePlanOutput } from "@/lib/creative-plan/schema";
import { nextJourneyStage } from "@/lib/journey";
import { buildJourneyTasks, type JourneyTask } from "@/lib/journey-tasks";
import { isLaunchPlanOutput } from "@/lib/launch-plan/schema";
import { toReadinessProfile } from "@/lib/readiness/checklist";
import { isReadinessOutput } from "@/lib/readiness/schema";
import { cn } from "@/lib/utils";
import { createClient } from "@flyee/auth/client";

/**
 * Seenaly's post-login decision surface.
 *
 * Job: answer "what should I do next for THIS product?". With multiple
 * products, the scope is explicit and persisted; no recommendation is ever
 * derived from a silently chosen "most recently updated" row.
 */

type ConnectionRow = { id: string; name: string; status: string; last_synced_at: string | null };

const CONNECTION_STATUS_COLOR: Record<string, "default" | "success" | "error"> = {
  connected: "success",
  error: "error",
  disabled: "default",
};

const PRODUCT_STATUS_COLOR: Record<string, "default" | "success" | "warning"> = {
  draft: "warning",
  active: "success",
  archived: "default",
};

type Progress = {
  hasReadiness: boolean;
  hasCreativePlan: boolean;
  creativeCount: number;
  hasLaunchPlan: boolean;
  hasDiagnosis: boolean;
  hasExperiment: boolean;
};

const EMPTY_PROGRESS: Progress = {
  hasReadiness: false,
  hasCreativePlan: false,
  creativeCount: 0,
  hasLaunchPlan: false,
  hasDiagnosis: false,
  hasExperiment: false,
};

type NextKey =
  | "product"
  | "context"
  | "readiness"
  | "creative-plan"
  | "launch"
  | "diagnosis"
  | "experiments"
  | "iterate";

const NEXT_CONFIG: Record<NextKey, { tone: Tone; icon: React.ReactNode }> = {
  product: { tone: "primary", icon: <NiTag aria-hidden /> },
  context: { tone: "primary", icon: <NiTag aria-hidden /> },
  readiness: { tone: "accent-4", icon: <NiShieldCheck aria-hidden /> },
  "creative-plan": { tone: "accent-1", icon: <NiCamera aria-hidden /> },
  launch: { tone: "accent-2", icon: <NiRocket aria-hidden /> },
  diagnosis: { tone: "accent-1", icon: <NiPulse aria-hidden /> },
  experiments: { tone: "accent-3", icon: <NiFlask aria-hidden /> },
  iterate: { tone: "primary", icon: <NiSparkle aria-hidden /> },
};

const HERO_GRADIENT: Record<Tone, string> = {
  primary: "from-primary/15 to-accent-3/10",
  secondary: "from-secondary/15 to-accent-1/10",
  "accent-1": "from-accent-1/15 to-accent-3/10",
  "accent-2": "from-accent-2/15 to-accent-4/10",
  "accent-3": "from-accent-3/15 to-primary/10",
  "accent-4": "from-accent-4/15 to-accent-2/10",
};

export default function HomePage() {
  const t = useTranslations("home");
  const tp = useTranslations("products");
  const tc = useTranslations("connections");
  const td = useTranslations("dashboard");
  const tcm = useTranslations("productCommon");
  const { configured, loading, loadError, userId, orgs, currentOrg } = useOrganization();

  const [products, setProducts] = useState<ProductWithChildren[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionRow | null>(null);
  const [hasCampaignData, setHasCampaignData] = useState(false);
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [selectedProductLoaded, setSelectedProductLoaded] = useState(false);
  const [dataLoadError, setDataLoadError] = useState(false);
  const selectedLoadRequest = useRef(0);

  const resetSelectedState = useCallback(() => {
    setConnection(null);
    setHasCampaignData(false);
    setProgress(EMPTY_PROGRESS);
  }, []);

  const loadProducts = useCallback(async () => {
    if (!currentOrg) return;
    selectedLoadRequest.current += 1;
    setProductsLoaded(false);
    setSelectedProductLoaded(false);
    setDataLoadError(false);
    setProducts([]);
    setSelectedProductId(null);
    resetSelectedState();

    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*, product_objections(content), product_proofs(kind, content)")
      .eq("org_id", currentOrg.id)
      .order("updated_at", { ascending: false });

    if (error) {
      setDataLoadError(true);
      setProductsLoaded(true);
      setSelectedProductLoaded(true);
      return;
    }

    const mapped = ((data ?? []) as Record<string, unknown>[]).map((row) =>
      mapProductRow(row, {
        objections: (row.product_objections as { content: string }[]) ?? [],
        proofs: (row.product_proofs as { kind: string | null; content: string }[]) ?? [],
      }),
    );
    const storedProductId = window.localStorage.getItem(`seenaly:last-product:${currentOrg.id}`);
    const selected =
      mapped.length === 1
        ? mapped[0].id
        : storedProductId && mapped.some((item) => item.id === storedProductId)
          ? storedProductId
          : null;

    setProducts(mapped);
    setSelectedProductId(selected);
    setProductsLoaded(true);
    if (!selected) setSelectedProductLoaded(true);
  }, [currentOrg, resetSelectedState]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const product = useMemo(
    () => products.find((item) => item.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const loadSelectedProduct = useCallback(
    async (selected: ProductWithChildren) => {
      const request = ++selectedLoadRequest.current;
      setSelectedProductLoaded(false);
      setDataLoadError(false);
      resetSelectedState();

      const supabase = createClient();
      const [readiness, creativePlan, creatives, launchPlan, diagnoses, experiments] = await Promise.all([
        supabase
          .from("diagnoses")
          .select("id", { count: "exact", head: true })
          .eq("product_id", selected.id)
          .eq("scope", "readiness"),
        supabase
          .from("diagnoses")
          .select("id", { count: "exact", head: true })
          .eq("product_id", selected.id)
          .eq("scope", "creative_plan"),
        supabase.from("creatives").select("id", { count: "exact", head: true }).eq("product_id", selected.id),
        supabase
          .from("diagnoses")
          .select("id", { count: "exact", head: true })
          .eq("product_id", selected.id)
          .eq("scope", "launch_plan"),
        supabase.from("diagnoses").select("id").eq("product_id", selected.id).in("scope", ["product", "campaign"]),
        supabase
          .from("experiments")
          .select("diagnosis_id")
          .eq("product_id", selected.id)
          .not("diagnosis_id", "is", null),
      ]);

      let linkedConnection: ConnectionRow | null = null;
      let campaignDataCount = 0;
      let connectionError = null;
      let campaignDataError = null;
      if (selected.connectionId) {
        const [connectionResult, campaignDataResult] = await Promise.all([
          supabase
            .from("connections")
            .select("id, name, status, last_synced_at")
            .eq("id", selected.connectionId)
            .eq("provider", "meta-ads")
            .maybeSingle(),
          supabase
            .from("meta_insights_daily")
            .select("id", { count: "exact", head: true })
            .eq("connection_id", selected.connectionId),
        ]);
        linkedConnection = (connectionResult.data as ConnectionRow | null) ?? null;
        campaignDataCount = campaignDataResult.count ?? 0;
        connectionError = connectionResult.error;
        campaignDataError = campaignDataResult.error;
      }

      if (request !== selectedLoadRequest.current) return;
      if (
        readiness.error ||
        creativePlan.error ||
        creatives.error ||
        launchPlan.error ||
        diagnoses.error ||
        experiments.error ||
        connectionError ||
        campaignDataError
      ) {
        setDataLoadError(true);
        setSelectedProductLoaded(true);
        return;
      }

      const paidDiagnosisIds = new Set((diagnoses.data ?? []).map((row) => row.id));
      setConnection(linkedConnection);
      setHasCampaignData(
        linkedConnection?.status === "connected" && Boolean(linkedConnection.last_synced_at) && campaignDataCount > 0,
      );
      setProgress({
        hasReadiness: (readiness.count ?? 0) > 0,
        hasCreativePlan: (creativePlan.count ?? 0) > 0,
        creativeCount: creatives.count ?? 0,
        hasLaunchPlan: (launchPlan.count ?? 0) > 0,
        hasDiagnosis: paidDiagnosisIds.size > 0,
        hasExperiment: (experiments.data ?? []).some(
          (experiment) => experiment.diagnosis_id && paidDiagnosisIds.has(experiment.diagnosis_id),
        ),
      });
      setSelectedProductLoaded(true);
    },
    [resetSelectedState],
  );

  useEffect(() => {
    if (!productsLoaded) return;
    if (!product) {
      selectedLoadRequest.current += 1;
      resetSelectedState();
      setSelectedProductLoaded(true);
      return;
    }
    void loadSelectedProduct(product);
  }, [loadSelectedProduct, product, productsLoaded, resetSelectedState]);

  // The unified queue (lib/journey-tasks.ts): everything it reads is already
  // persisted by the three pre-paid engines, so this is navigation, not a new
  // diagnosis — zero LLM calls, zero credits. `tasksKnown` distinguishes "no
  // engine has ever run" (render nothing, the journey tiles below already
  // guide setup) from "engines ran and the queue is empty" (an honest,
  // muted completion card, not silence).
  const [tasks, setTasks] = useState<JourneyTask[]>([]);
  const [tasksKnown, setTasksKnown] = useState(false);

  const loadTaskQueue = useCallback(async () => {
    if (!product) {
      setTasks([]);
      setTasksKnown(false);
      return;
    }
    const supabase = createClient();
    const [{ data: readinessRow }, { data: creativePlanRow }, { data: launchPlanRow }] = await Promise.all([
      supabase
        .from("diagnoses")
        .select("id, output")
        .eq("product_id", product.id)
        .eq("scope", "readiness")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("diagnoses")
        .select("id, output")
        .eq("product_id", product.id)
        .eq("scope", "creative_plan")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("diagnoses")
        .select("id, output")
        .eq("product_id", product.id)
        .eq("scope", "launch_plan")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let readinessInput: Parameters<typeof buildJourneyTasks>[0]["readiness"] = null;
    if (readinessRow && isReadinessOutput(readinessRow.output)) {
      const [{ data: profileRow }, { data: experimentRows }] = await Promise.all([
        supabase.from("product_readiness").select("*").eq("product_id", product.id).maybeSingle(),
        supabase
          .from("experiments")
          .select("change_made")
          .eq("diagnosis_id", readinessRow.id as string),
      ]);
      readinessInput = {
        output: readinessRow.output,
        profile: toReadinessProfile(profileRow as Record<string, unknown> | null),
        registeredChangeMade: new Set(
          ((experimentRows ?? []) as { change_made: string | null }[])
            .map((row) => row.change_made)
            .filter((value): value is string => Boolean(value)),
        ),
      };
    }

    let creativePlanInput: Parameters<typeof buildJourneyTasks>[0]["creativePlan"] = null;
    if (creativePlanRow && isCreativePlanOutput(creativePlanRow.output)) {
      const { data: links } = await supabase
        .from("creative_plan_links")
        .select("hypothesis_key, creative_id")
        .eq("diagnosis_id", creativePlanRow.id as string);
      const linkRows = (links ?? []) as { hypothesis_key: string; creative_id: string }[];
      const creativeIds = linkRows.map((link) => link.creative_id);
      const publishedCount: Record<string, number> = {};
      if (creativeIds.length > 0) {
        const { data: publications } = await supabase
          .from("organic_content_items")
          .select("creative_id")
          .in("creative_id", creativeIds)
          .limit(1000);
        const counts = new Map<string, number>();
        for (const publication of (publications ?? []) as { creative_id: string | null }[]) {
          if (!publication.creative_id) continue;
          counts.set(publication.creative_id, (counts.get(publication.creative_id) ?? 0) + 1);
        }
        for (const link of linkRows) publishedCount[link.hypothesis_key] = counts.get(link.creative_id) ?? 0;
      }
      creativePlanInput = { output: creativePlanRow.output, publishedCount };
    }

    let launchPlanInput: Parameters<typeof buildJourneyTasks>[0]["launchPlan"] = null;
    if (launchPlanRow && isLaunchPlanOutput(launchPlanRow.output)) {
      const { data: experimentRows } = await supabase
        .from("experiments")
        .select("change_made")
        .eq("diagnosis_id", launchPlanRow.id as string);
      const registeredStepKeys = new Set<string>();
      for (const row of (experimentRows ?? []) as { change_made: string | null }[]) {
        const match = /^Etapa do lançamento \[([^\]]+)\]/.exec(row.change_made ?? "");
        if (match) registeredStepKeys.add(match[1]);
      }
      launchPlanInput = { output: launchPlanRow.output, registeredStepKeys };
    }

    setTasksKnown(Boolean(readinessInput || creativePlanInput || launchPlanInput));
    setTasks(
      buildJourneyTasks({
        productId: product.id,
        workspace: false,
        readiness: readinessInput,
        creativePlan: creativePlanInput,
        launchPlan: launchPlanInput,
      }),
    );
  }, [product]);

  useEffect(() => {
    void loadTaskQueue();
  }, [loadTaskQueue]);

  const handleProductChange = (productId: string) => {
    if (!currentOrg) return;
    window.localStorage.setItem(`seenaly:last-product:${currentOrg.id}`, productId);
    setSelectedProductId(productId);
  };

  const completeness = product ? computeCompleteness(product) : null;
  const loaded = productsLoaded && selectedProductLoaded;
  const selectionRequired = productsLoaded && products.length > 1 && !product;
  const hasCreativeEvidence = progress.hasCreativePlan || progress.creativeCount > 0;

  // One shared ladder (lib/journey.ts) instead of a fourth hand-copy: it is
  // the piece that keeps "diagnosis" from ever being recommended before there
  // is campaign data to read. "iterate" is home's own cosmetic wrap for the
  // terminal state once a first diagnosis already exists.
  const stage = product
    ? nextJourneyStage({
        hasContext: Boolean(completeness?.ready),
        hasReadiness: progress.hasReadiness,
        hasCreativeEvidence,
        hasLaunchPlan: progress.hasLaunchPlan,
        hasDiagnosis: progress.hasDiagnosis,
        hasExperiment: progress.hasExperiment,
        hasCampaignData,
      })
    : "context";
  const nextKey: NextKey = !product
    ? "product"
    : stage === "creatives"
      ? "creative-plan"
      : stage === "diagnosis" && progress.hasDiagnosis
        ? "iterate"
        : stage;
  const next = NEXT_CONFIG[nextKey];
  const nextHref =
    nextKey === "product"
      ? "/products/new"
      : nextKey === "context"
        ? `/products/${product!.id}`
        : nextKey === "creative-plan"
          ? `/products/${product!.id}/creatives`
          : nextKey === "iterate"
            ? `/products/${product!.id}/diagnosis`
            : `/products/${product!.id}/${nextKey}`;

  const journey = product
    ? [
        {
          id: "context",
          tone: "primary" as Tone,
          icon: <NiTag aria-hidden />,
          href: `/products/${product.id}`,
          done: Boolean(completeness?.ready),
        },
        {
          id: "readiness",
          tone: "accent-4" as Tone,
          icon: <NiShieldCheck aria-hidden />,
          href: `/products/${product.id}/readiness`,
          done: progress.hasReadiness,
        },
        {
          id: "creative-plan",
          tone: "accent-1" as Tone,
          icon: <NiCamera aria-hidden />,
          href: `/products/${product.id}/creatives`,
          done: hasCreativeEvidence,
        },
        {
          id: "launch",
          tone: "accent-2" as Tone,
          icon: <NiRocket aria-hidden />,
          href: `/products/${product.id}/launch`,
          done: progress.hasLaunchPlan,
        },
        {
          id: "diagnosis",
          tone: "accent-1" as Tone,
          icon: <NiPulse aria-hidden />,
          href: `/products/${product.id}/diagnosis`,
          done: progress.hasDiagnosis,
        },
        {
          id: "experiments",
          tone: "accent-3" as Tone,
          icon: <NiFlask aria-hidden />,
          href: `/products/${product.id}/experiments`,
          done: progress.hasExperiment,
        },
      ]
    : [];

  const resources = product
    ? [
        {
          id: "data",
          icon: <NiDatabase size="small" aria-hidden />,
          href: product.connectionId ? "/settings/connections" : `/products/${product.id}`,
          ready: hasCampaignData,
          optional: true,
        },
        {
          id: "creatives",
          icon: <NiCamera size="small" aria-hidden />,
          href: `/products/${product.id}/creatives`,
          ready: progress.creativeCount > 0,
          optional: false,
        },
        {
          id: "funnel",
          icon: <NiChartFunnel size="small" aria-hidden />,
          href: `/products/${product.id}/funnel`,
          ready: false,
          optional: false,
        },
        {
          id: "organic",
          icon: <NiTrendUp size="small" aria-hidden />,
          href: `/products/${product.id}/organic`,
          ready: false,
          optional: true,
        },
      ]
    : [];

  const subtitle = product
    ? t("subtitle-product", { product: product.name })
    : productsLoaded && products.length > 1
      ? t("subtitle-portfolio")
      : t("subtitle");

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <Grid size={12}>
          <Box className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <Box>
              <Typography variant="h1" component="h1" className="mb-1">
                {t("title")}
              </Typography>
              <Typography variant="body1" className="text-text-secondary max-w-2xl">
                {subtitle}
              </Typography>
            </Box>

            {productsLoaded && products.length > 1 && (
              <FormControl size="small" className="w-full md:w-72">
                <InputLabel id="home-product-label">{t("product-selector-label")}</InputLabel>
                <Select
                  labelId="home-product-label"
                  value={selectedProductId ?? ""}
                  label={t("product-selector-label")}
                  onChange={(event) => handleProductChange(event.target.value)}
                >
                  <MenuItem value="" disabled>
                    {t("product-selector-placeholder")}
                  </MenuItem>
                  {products.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </Grid>

        {!configured && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("not-configured")}
            </Alert>
          </Grid>
        )}

        {configured && loadError && (
          <Grid size={12}>
            <Alert severity="error" className="neutral bg-background-paper/60!">
              {td("org-load-error")}
            </Alert>
          </Grid>
        )}

        {configured && !loading && !loadError && orgs.length === 0 && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("no-org")}
            </Alert>
          </Grid>
        )}

        {configured && loading && (
          <Grid size={12}>
            <Skeleton variant="rounded" height={140} />
          </Grid>
        )}

        {currentOrg && !loaded && !dataLoadError && (
          <>
            <Grid size={12}>
              <Skeleton variant="rounded" height={160} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Skeleton variant="rounded" height={180} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Skeleton variant="rounded" height={180} />
            </Grid>
          </>
        )}

        {currentOrg && loaded && selectionRequired && (
          <Grid size={12}>
            <Card component="section">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="bg-primary/10 text-primary-dark dark:text-primary-light flex h-14 w-14 items-center justify-center rounded-2xl">
                  <NiTag size="medium" aria-hidden />
                </span>
                <Typography variant="h4" component="h2">
                  {t("choose-product-title")}
                </Typography>
                <Typography variant="body1" className="text-text-secondary max-w-xl">
                  {t("choose-product-body", { count: products.length })}
                </Typography>
                <Typography variant="body2" className="text-text-secondary">
                  {t("choose-product-hint")}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {currentOrg && product && userId && loaded && !dataLoadError && (
          <ActivationChecklist
            key={product.id}
            orgId={currentOrg.id}
            userId={userId}
            productId={product.id}
            productName={product.name}
          />
        )}

        {currentOrg && dataLoadError && (
          <Grid size={12}>
            <LoadErrorState
              title={tcm("load-error-title")}
              description={tcm("load-error-body")}
              retryLabel={tcm("retry")}
              onRetry={() => (product ? void loadSelectedProduct(product) : void loadProducts())}
            />
          </Grid>
        )}

        {currentOrg && loaded && !dataLoadError && !selectionRequired && (
          <Grid size={12}>
            <Card component="section" className="relative isolate overflow-hidden">
              <div
                aria-hidden
                className={cn("pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br", HERO_GRADIENT[next.tone])}
              />
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -top-8 -right-6 -z-10 opacity-[0.07] [&_svg]:h-44 [&_svg]:w-44",
                  TONE[next.tone].text,
                )}
              >
                {next.icon}
              </span>
              <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <span
                  className={cn(
                    "flex h-14 w-14 flex-none items-center justify-center rounded-2xl [&_svg]:h-7 [&_svg]:w-7",
                    TONE[next.tone].softBg,
                    TONE[next.tone].text,
                  )}
                >
                  {next.icon}
                </span>
                <Box className="grow">
                  <Typography variant="body2" className="text-text-secondary mb-0.5 tracking-wide uppercase">
                    {product ? t("next-eyebrow-product", { product: product.name }) : t("next-eyebrow")}
                  </Typography>
                  <Typography variant="h4" component="h2" className="mb-1">
                    {t(`next-${nextKey}-title`)}
                  </Typography>
                  <Typography variant="body1" className="text-text-secondary max-w-2xl leading-6">
                    {t(`next-${nextKey}-body`)}
                  </Typography>
                </Box>
                <Box className="flex flex-none flex-col gap-2 sm:items-end">
                  <Button
                    className="min-h-11!"
                    variant="contained"
                    LinkComponent={Link}
                    href={nextHref}
                    endIcon={<NiArrowRight size="small" aria-hidden />}
                  >
                    {t(`next-${nextKey}-cta`)}
                  </Button>
                  {product && (
                    <Button
                      className="min-h-11!"
                      variant="text"
                      color="grey"
                      LinkComponent={Link}
                      href={`/products/${product.id}`}
                    >
                      {t("next-open-product")}
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {currentOrg && loaded && !dataLoadError && product && (
          <>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card component="section" className="h-full">
                <CardContent className="flex h-full flex-col gap-3">
                  <Box className="flex flex-row items-center gap-3">
                    <span className="bg-primary/10 text-primary-dark dark:text-primary-light flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
                      <NiTag size="small" aria-hidden />
                    </span>
                    <Box className="grow">
                      <Typography variant="h5" component="h2" className="card-title mb-0">
                        {t("context-title-product", { product: product.name })}
                      </Typography>
                    </Box>
                    <Chip
                      label={tp(`status-${product.status}`)}
                      size="small"
                      variant="outlined"
                      color={PRODUCT_STATUS_COLOR[product.status] ?? "default"}
                    />
                  </Box>

                  {completeness && (
                    <Box className="flex flex-col gap-1.5">
                      <Box className="flex flex-row flex-wrap items-center gap-2">
                        <Typography variant="body2" className="text-text-secondary grow">
                          {t("context-depth")}
                        </Typography>
                        <Typography
                          variant="subtitle2"
                          className="text-primary-dark dark:text-primary-light tabular-nums"
                        >
                          {completeness.score}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={completeness.score}
                        aria-label={t("context-progress-label", { product: product.name })}
                      />
                      <Typography variant="body2" className="text-text-secondary">
                        {completeness.ready ? t("context-ready") : t("context-needs-essentials")}
                      </Typography>
                      {completeness.missing.length > 0 && (
                        <Typography variant="body2" className="text-text-secondary">
                          {t("context-next")}: {tp(`field-${completeness.missing[0]}`)}
                        </Typography>
                      )}
                    </Box>
                  )}

                  <Box className="mt-auto pt-2">
                    <Button
                      className="min-h-11!"
                      variant="outlined"
                      color="grey"
                      LinkComponent={Link}
                      href={`/products/${product.id}`}
                    >
                      {t("context-open")}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              {!connection ? (
                <EmptyState
                  icon={<NiDatabase />}
                  title={t("meta-empty-title-product", { product: product.name })}
                  description={t("meta-empty-body-product")}
                  action={{
                    label: t("meta-link"),
                    href: `/products/${product.id}`,
                    variant: "outlined",
                  }}
                  className="h-full"
                />
              ) : (
                <Card component="section" className="h-full">
                  <CardContent className="flex h-full flex-col gap-3">
                    <Box className="flex flex-row items-center gap-3">
                      <span className="bg-accent-4/10 text-accent-4-dark dark:text-accent-4-light flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
                        <NiDatabase size="small" aria-hidden />
                      </span>
                      <Typography variant="h5" component="h2" className="card-title mb-0 grow">
                        {t("meta-title-product", { product: product.name })}
                      </Typography>
                      <Chip
                        label={tc(`status-${connection.status}`)}
                        size="small"
                        variant="outlined"
                        color={CONNECTION_STATUS_COLOR[connection.status] ?? "default"}
                      />
                    </Box>

                    <Typography variant="subtitle1" className="truncate">
                      {connection.name}
                    </Typography>
                    <Typography variant="body2" className="text-text-secondary">
                      {hasCampaignData
                        ? t("meta-data-ready")
                        : connection.status === "connected"
                          ? t("meta-linked-no-data")
                          : t("meta-linked-unavailable")}
                    </Typography>
                    <Typography variant="body2" className="text-text-secondary">
                      {connection.last_synced_at
                        ? t("meta-synced-at", { when: new Date(connection.last_synced_at).toLocaleString() })
                        : t("meta-never-synced")}
                    </Typography>

                    <Box className="mt-auto pt-2">
                      <Button
                        className="min-h-11!"
                        variant="outlined"
                        color="grey"
                        LinkComponent={Link}
                        href="/settings/connections"
                      >
                        {t("meta-manage")}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Grid>

            {/* The unified queue leads: it is the answer to "what do I
                actually do today", ranked across all three pre-paid engines
                at once. Nothing to render when no engine has ever run —
                the journey map right below already carries that job. */}
            {tasksKnown && (
              <Grid size={12}>{tasks.length > 0 ? <TaskQueueCard tasks={tasks} /> : <TaskQueueEmptyCard />}</Grid>
            )}

            <Grid size={12} className="mt-2">
              <Typography variant="h5" component="h2" className="card-title mb-0">
                {t("journey-title-product", { product: product.name })}
              </Typography>
              <Typography variant="body2" className="text-text-secondary max-w-2xl">
                {t("journey-subtitle-product")}
              </Typography>
            </Grid>

            {journey.map((tile) => (
              <Grid key={tile.id} size={{ xs: 6, sm: 6, xl: "grow" }}>
                <Card
                  component={Link}
                  href={tile.href}
                  className="group hover:shadow-darker-sm focus-visible:outline-text-primary block h-full no-underline transition-all hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3"
                >
                  <CardContent className="flex h-full min-h-32 flex-col gap-2 sm:min-h-40">
                    <Box className="flex flex-row items-start justify-between gap-2">
                      <span
                        className={cn(
                          "flex h-10 w-10 flex-none items-center justify-center rounded-2xl",
                          TONE[tile.tone].softBg,
                          TONE[tile.tone].text,
                        )}
                      >
                        {tile.icon}
                      </span>
                      {tile.done && (
                        <span className="bg-success/10 text-success-content inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5">
                          <NiCheck size="small" aria-hidden />
                          <span className="hidden text-xs font-medium tracking-wide uppercase sm:inline">
                            {t("journey-done")}
                          </span>
                        </span>
                      )}
                    </Box>

                    <Box className="grow">
                      <Typography variant="subtitle1" component="h3" className="mb-0.5">
                        {t(`journey-${tile.id}`)}
                      </Typography>
                      <Typography variant="body2" className="text-text-secondary hidden leading-5 sm:block">
                        {t(`journey-desc-${tile.id}`)}
                      </Typography>
                    </Box>

                    <span
                      aria-hidden
                      className={cn(
                        "inline-flex translate-x-0 items-center transition-transform group-hover:translate-x-1",
                        TONE[tile.tone].text,
                      )}
                    >
                      <NiArrowRight size="small" />
                    </span>
                  </CardContent>
                </Card>
              </Grid>
            ))}

            <Grid size={12}>
              <Card component="section">
                <CardContent className="flex flex-col gap-3">
                  <Box>
                    <Typography variant="h5" component="h2" className="card-title mb-0">
                      {t("resources-title")}
                    </Typography>
                    <Typography variant="body2" className="text-text-secondary">
                      {t("resources-subtitle")}
                    </Typography>
                  </Box>
                  <Box className="flex flex-row flex-wrap gap-2">
                    {resources.map((resource) => (
                      <Button
                        key={resource.id}
                        className="min-h-11!"
                        variant="outlined"
                        color="grey"
                        LinkComponent={Link}
                        href={resource.href}
                        startIcon={resource.icon}
                        endIcon={resource.ready ? <NiCheck size="small" aria-hidden /> : undefined}
                      >
                        {t(`resource-${resource.id}`)}
                        {resource.optional ? ` · ${t("journey-optional")}` : ""}
                      </Button>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>
    </Grid>
  );
}
