"use client";

import { registerExperimentFromDiagnosis } from "../experiments/actions";
import { useOrganization } from "../settings/organization/components/use-organization";
import { type DiagnosisRating, generateDiagnosis, getDiagnosisCreditInfo, recordDiagnosisFeedback } from "./actions";
import DiagnosisCard, { type DiagnosisFunnel, type DiagnosisMeta } from "./components/diagnosis-card";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Breadcrumbs, Button, Grid, MenuItem, Skeleton, TextField, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import LoadErrorState from "@/components/product/load-error-state";
import ProcessingOverlay, { type ProcessingStage } from "@/components/product/processing-overlay";
import NiBook from "@/icons/nexture/ni-book";
import NiFlask from "@/icons/nexture/ni-flask";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiSparkle from "@/icons/nexture/ni-sparkle";
import NiTag from "@/icons/nexture/ni-tag";
import { track } from "@/lib/analytics";
import { type DiagnosisOutput, isDiagnosisOutput } from "@/lib/diagnosis/schema";
import { createClient } from "@flyee/auth/client";

/**
 * Job: "what is my bottleneck, and what do I test next?" Success: the reader
 * leaves with a concrete action AND a success criterion they can check.
 *
 * Not a table of past runs: the latest diagnosis is the screen. History is a
 * quiet list underneath — it exists to be revisited (the seed of the
 * experiment memory), not to be managed.
 */

type DiagnosisRow = {
  id: string;
  output: DiagnosisOutput;
  created_at: string;
  had_campaign_data: boolean;
  knowledge_refs: { title: string; trust_level: number }[];
};

type ProductRow = { id: string; name: string; connectionId: string | null };

export function DiagnosisExperience({
  forcedProductId,
  workspace = false,
}: {
  forcedProductId?: string;
  workspace?: boolean;
} = {}) {
  const t = useTranslations("diagnosis");
  const tc = useTranslations("productCommon");
  const td = useTranslations("dashboard");
  const router = useRouter();
  const searchParams = useSearchParams();
  // Arriving from a product ("Gerar diagnóstico") must keep that product
  // selected — the context must survive the jump, not be re-guessed.
  const requestedProductId = forcedProductId ?? searchParams.get("product");
  const { configured, loading, loadError, userId, orgs, currentOrg } = useOrganization();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [rows, setRows] = useState<DiagnosisRow[]>([]);
  // The funnel numbers behind the latest diagnosis — null when none exist, and
  // the card then stays text rather than drawing a chart of nothing.
  const [funnel, setFunnel] = useState<DiagnosisFunnel | null>(null);
  const [feedbackByDiagnosis, setFeedbackByDiagnosis] = useState<Record<string, DiagnosisRating>>({});
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataLoadError, setDataLoadError] = useState(false);
  // Honesty gate (docs/PRODUCT.md maturity spectrum): the diagnosis is never
  // BLOCKED without campaign data, but spending credits to hear "não há base"
  // deserves a warning before the click, not after.
  const [hasCampaignData, setHasCampaignData] = useState(false);
  const [hasLaunchPlan, setHasLaunchPlan] = useState(false);
  const [creditCost, setCreditCost] = useState(0);

  const product = products.find((p) => p.id === selectedProductId) ?? null;
  const ready = productsLoaded && loaded;

  // The org's products drive the selector; the most recently updated is the
  // default so a single-product user never has to choose.
  const loadProducts = useCallback(async () => {
    if (!currentOrg) return;
    const supabase = createClient();
    const { data, error: productsError } = await supabase
      .from("products")
      .select("id, name, connection_id")
      .eq("org_id", currentOrg.id)
      .order("updated_at", { ascending: false });
    if (productsError) {
      setDataLoadError(true);
      setProductsLoaded(true);
      setLoaded(true);
      return;
    }
    const list = ((data ?? []) as { id: string; name: string; connection_id: string | null }[]).map((row) => ({
      id: row.id,
      name: row.name,
      connectionId: row.connection_id,
    }));
    setDataLoadError(false);
    setProducts(list);
    setSelectedProductId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev;
      // An explicit ?product= wins over "most recently updated".
      if (requestedProductId && list.some((p) => p.id === requestedProductId)) return requestedProductId;
      const lastProductId = window.localStorage.getItem(`seenaly:last-product:${currentOrg.id}`);
      if (lastProductId && list.some((p) => p.id === lastProductId)) return lastProductId;
      return list.length === 1 ? list[0].id : null;
    });
    setProductsLoaded(true);
  }, [currentOrg, requestedProductId]);

  const loadDiagnoses = useCallback(async () => {
    if (!selectedProductId) {
      setRows([]);
      setFeedbackByDiagnosis({});
      setLoaded(true);
      return;
    }
    setLoaded(false);
    const supabase = createClient();
    // Campaign diagnoses only — the readiness verdict (scope 'readiness') is a
    // DIFFERENT output shape and lives on /readiness. Loading it here would feed
    // DiagnosisCard an object with no `evidence`, crashing the whole screen.
    const [{ data, error: diagnosesError }, { data: funnelRow, error: funnelError }] = await Promise.all([
      supabase
        .from("diagnoses")
        .select("id, output, created_at, had_campaign_data, knowledge_refs")
        .eq("product_id", selectedProductId)
        .in("scope", ["product", "campaign"])
        .order("created_at", { ascending: false })
        .limit(10),
      // The same snapshot the engine reasoned from, so the card can SHOW the
      // numbers behind the words instead of only describing them.
      supabase
        .from("funnel_snapshots")
        .select("label, visits, signups, checkout_initiated, purchases, refunds, net_revenue")
        .eq("product_id", selectedProductId)
        .order("period_end", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (diagnosesError) {
      setDataLoadError(true);
      setLoaded(true);
      return;
    }
    // The funnel is ENRICHMENT: it makes the diagnosis richer, it is not the
    // diagnosis. So its failure degrades to "no funnel shown" and never takes
    // the answer the user came for off the screen. (Caught for real: the query
    // errors while migration 0034 — which adds funnel_snapshots.signups — is
    // still pending, and it was blanking the whole result.)
    setFunnel(
      funnelRow && !funnelError
        ? {
            label: (funnelRow.label as string | null) ?? null,
            counts: {
              visits: funnelRow.visits as number | null,
              signups: funnelRow.signups as number | null,
              checkout_initiated: funnelRow.checkout_initiated as number | null,
              purchases: funnelRow.purchases as number | null,
              refunds: funnelRow.refunds as number | null,
              net_revenue: funnelRow.net_revenue as number | null,
            },
          }
        : null,
    );
    // Defence in depth: never hand a malformed payload to the card (the app has
    // no granular error boundary, so one bad row would white-screen everything).
    const list = ((data as DiagnosisRow[]) ?? []).filter((r) => isDiagnosisOutput(r.output));
    setDataLoadError(false);
    setRows(list);

    // This user's own ratings on those diagnoses, to render the active choice.
    if (list.length > 0 && userId) {
      const { data: fb, error: feedbackError } = await supabase
        .from("diagnosis_feedback")
        .select("diagnosis_id, rating")
        .eq("user_id", userId)
        .in(
          "diagnosis_id",
          list.map((r) => r.id),
        );
      if (feedbackError) {
        setDataLoadError(true);
        setLoaded(true);
        return;
      }
      const map: Record<string, DiagnosisRating> = {};
      for (const row of (fb as { diagnosis_id: string; rating: DiagnosisRating }[]) ?? []) {
        map[row.diagnosis_id] = row.rating;
      }
      setFeedbackByDiagnosis(map);
    } else {
      setFeedbackByDiagnosis({});
    }
    setLoaded(true);
  }, [selectedProductId, userId]);

  const submitFeedback = async (diagnosisId: string, rating: DiagnosisRating) => {
    if (!currentOrg) return;
    const previous = feedbackByDiagnosis[diagnosisId];
    setFeedbackByDiagnosis((prev) => ({ ...prev, [diagnosisId]: rating })); // optimistic
    setFeedbackBusy(true);
    const result = await recordDiagnosisFeedback(currentOrg.id, diagnosisId, rating);
    setFeedbackBusy(false);
    if (result.ok) track("feedback_recorded", { rating });
    if (!result.ok) {
      setFeedbackByDiagnosis((prev) => {
        const next = { ...prev };
        if (previous) next[diagnosisId] = previous;
        else delete next[diagnosisId];
        return next;
      });
      setError(result.error);
    }
  };

  // Same signal products/[id]/layout.tsx uses for its workspace rail: a
  // connection alone is not data — it must be connected AND synced at least
  // once. Best-effort: a load error here silently keeps the warning hidden
  // rather than blocking the screen over a secondary signal.
  const loadCampaignDataSignal = useCallback(async () => {
    if (!product) {
      setHasCampaignData(false);
      setHasLaunchPlan(false);
      return;
    }
    const supabase = createClient();
    const [connectionResult, launchPlanResult] = await Promise.all([
      product.connectionId
        ? supabase
            .from("connections")
            .select("status, last_synced_at")
            .eq("id", product.connectionId)
            .eq("provider", "meta-ads")
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("diagnoses")
        .select("id", { count: "exact", head: true })
        .eq("product_id", product.id)
        .eq("scope", "launch_plan"),
    ]);
    const connection = connectionResult.data as { status: string; last_synced_at: string | null } | null;
    setHasCampaignData(connection?.status === "connected" && Boolean(connection.last_synced_at));
    setHasLaunchPlan((launchPlanResult.count ?? 0) > 0);
  }, [product]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadDiagnoses();
  }, [loadDiagnoses]);

  useEffect(() => {
    loadCampaignDataSignal();
  }, [loadCampaignDataSignal]);

  useEffect(() => {
    if (!currentOrg) return;
    getDiagnosisCreditInfo(currentOrg.id).then((info) => {
      if (info.ok) setCreditCost(info.cost);
    });
  }, [currentOrg]);

  useEffect(() => {
    if (!workspace && requestedProductId) {
      router.replace(`/products/${requestedProductId}/diagnosis`);
    }
  }, [requestedProductId, router, workspace]);

  useEffect(() => {
    if (!workspace && !requestedProductId && productsLoaded && selectedProductId) {
      router.replace(`/products/${selectedProductId}/diagnosis`);
    }
  }, [productsLoaded, requestedProductId, router, selectedProductId, workspace]);

  const generate = async () => {
    if (!selectedProductId) return;
    setError(null);
    setBusy(true);
    try {
      const result = await generateDiagnosis(selectedProductId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      track("diagnosis_generated");
      await loadDiagnoses();
    } finally {
      setBusy(false);
    }
  };

  const latest = rows[0];
  const history = rows.slice(1);

  // Mirrors what generateDiagnosis() actually does, in order.
  const stages: ProcessingStage[] = [
    { icon: <NiTag />, label: t("stage-context") },
    { icon: <NiFlask />, label: t("stage-memory") },
    { icon: <NiPulse />, label: t("stage-campaign") },
    { icon: <NiBook />, label: t("stage-knowledge") },
    { icon: <NiSparkle />, label: t("stage-writing") },
  ];

  const generateButton = (
    <Button variant="contained" startIcon={<NiSparkle size="small" />} onClick={generate} disabled={busy || !product}>
      {busy ? t("generating") : t("generate")}
    </Button>
  );

  return (
    <Grid container spacing={5} className="items-start">
      <ProcessingOverlay open={busy} title={t("generating")} stages={stages} patienceLabel={t("stage-patience")} />
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
          {!workspace && products.length > 1 && ready && (
            <Grid size={{ xs: 12, md: "auto" }}>
              <TextField
                select
                size="small"
                label={t("select-product")}
                value={selectedProductId ?? ""}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="min-w-56"
              >
                {products.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
          {product && ready && rows.length > 0 && <Grid size={{ xs: 12, md: "auto" }}>{generateButton}</Grid>}
        </Grid>

        {/* Honesty before the spend (docs/PRODUCT.md maturity spectrum): this
            screen is never gated without campaign data, but a credit-costing
            answer of "não há base para concluir" deserves a warning BEFORE
            the click, not a surprise after it — and a door to the Launch Plan
            when the product has not built one yet. */}
        {configured && ready && !dataLoadError && product && !hasCampaignData && (
          <Grid size={12}>
            <Alert
              severity="info"
              className="neutral bg-background-paper/60!"
              action={
                !hasLaunchPlan ? (
                  <Button
                    component={Link}
                    href={workspace ? `/products/${product.id}/launch` : `/launch?product=${product.id}`}
                    size="small"
                    color="primary"
                  >
                    {t("no-data-warning-cta-launch")}
                  </Button>
                ) : undefined
              }
            >
              {creditCost > 0 ? t("no-data-warning-body-cost", { cost: creditCost }) : t("no-data-warning-body")}
            </Alert>
          </Grid>
        )}

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

        {configured && currentOrg && dataLoadError && (
          <Grid size={12}>
            <LoadErrorState
              title={tc("load-error-title")}
              description={tc("load-error-body")}
              retryLabel={tc("retry")}
              onRetry={() => {
                setDataLoadError(false);
                loadProducts();
                loadDiagnoses();
              }}
            />
          </Grid>
        )}

        {configured && !loading && !loadError && orgs.length === 0 && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("no-org")}
            </Alert>
          </Grid>
        )}

        {/* Hold the space while memberships or diagnoses resolve — never blank. */}
        {configured && !dataLoadError && (loading || (currentOrg && !ready)) && (
          <Grid size={12}>
            <Skeleton variant="rounded" height={280} />
          </Grid>
        )}

        {/* No product context yet: the diagnosis has nothing to reason with. */}
        {currentOrg && ready && !dataLoadError && products.length === 0 && (
          <Grid size={12}>
            <EmptyState
              icon={<NiTag />}
              title={t("no-product-title")}
              description={t("no-product-body")}
              action={{ label: t("no-product-cta"), href: "/products/new" }}
            />
          </Grid>
        )}

        {currentOrg && ready && !dataLoadError && products.length > 1 && !product && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {tc("select-product-guidance")}
            </Alert>
          </Grid>
        )}

        {/* Context exists, no diagnosis yet: the ONE action is to generate it. */}
        {currentOrg && ready && !dataLoadError && product && rows.length === 0 && (
          <Grid size={12}>
            <EmptyState
              icon={<NiPulse />}
              title={t("empty-title")}
              description={t("empty-body", { product: product.name })}
              action={{ label: busy ? t("generating") : t("generate"), onClick: generate }}
            />
          </Grid>
        )}

        {error && (
          <Grid size={12}>
            <Alert severity="error" className="neutral bg-background-paper/60!">
              {error}
            </Alert>
          </Grid>
        )}

        {latest && (
          <Grid size={12}>
            <DiagnosisCard
              output={latest.output}
              meta={
                {
                  createdAt: latest.created_at,
                  hadCampaignData: latest.had_campaign_data,
                  knowledgeRefs: latest.knowledge_refs ?? [],
                } satisfies DiagnosisMeta
              }
              funnel={funnel}
              feedback={feedbackByDiagnosis[latest.id] ?? null}
              onFeedback={(rating) => submitFeedback(latest.id, rating)}
              feedbackBusy={feedbackBusy}
            />
            {/* Close the loop: turn the recommendation into a tracked experiment. */}
            <Box className="mt-3">
              <Button
                variant="outlined"
                color="grey"
                startIcon={<NiFlask size="small" />}
                disabled={registering}
                onClick={async () => {
                  setRegistering(true);
                  const result = await registerExperimentFromDiagnosis(latest.id);
                  setRegistering(false);
                  if (result.ok) {
                    track("experiment_registered");
                    router.push(
                      workspace && product
                        ? `/products/${product.id}/experiments/${result.id}`
                        : `/experiments/${result.id}`,
                    );
                  } else setError(result.error);
                }}
              >
                {registering ? t("registering-experiment") : t("register-experiment")}
              </Button>
              <Typography variant="body2" className="text-text-secondary mt-1">
                {t("register-experiment-hint")}
              </Typography>
            </Box>
          </Grid>
        )}

        {history.length > 0 && (
          <Grid size={12}>
            <Typography variant="h5" component="h2" className="mb-3">
              {t("history-title")}
            </Typography>
            <Box className="flex flex-col gap-2">
              {history.map((row) => (
                <Box key={row.id} className="border-grey-50 flex flex-col gap-0.5 border-b pb-2">
                  <Typography variant="body2" className="text-text-secondary">
                    {new Date(row.created_at).toLocaleString()} ·{" "}
                    {row.had_campaign_data ? t("with-campaign-data") : t("without-campaign-data")}
                  </Typography>
                  <Typography variant="body2" className="line-clamp-2">
                    {row.output.diagnosis}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}

export default function DiagnosisPage() {
  return <DiagnosisExperience />;
}
