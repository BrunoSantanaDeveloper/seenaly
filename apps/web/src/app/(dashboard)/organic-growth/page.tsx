"use client";

import { useOrganization } from "../settings/organization/components/use-organization";
import {
  createExperimentFromOrganicRecommendation,
  generateOrganicReview,
  recordOrganicRecommendationFeedback,
  setOrganicGrowthEnabled,
} from "./actions";
import DataQualityCard, { type OrganicDataQuality } from "./components/data-quality-card";
import FunnelCoverage, { type CoverageBucket } from "./components/funnel-coverage";
import OrganicActivationChecklist from "./components/organic-activation-checklist";
import OrganicGrowthHeader from "./components/organic-growth-header";
import RecommendationCard from "./components/recommendation-card";
import type { OrganicRecommendationRow, RecommendationFeedback } from "./types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Card, CardContent, Chip, Grid, Skeleton, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import NiCamera from "@/icons/nexture/ni-camera";
import NiChartLineBar from "@/icons/nexture/ni-chart-line-bar";
import NiNetwork from "@/icons/nexture/ni-network";
import NiSparkle from "@/icons/nexture/ni-sparkle";
import { createClient } from "@flyee/auth/client";

interface ViewState {
  entitled: boolean;
  subscriptionActive: boolean;
  enabled: boolean;
  analysisWindowDays: number;
  product: { id: string; name: string } | null;
  account: { id: string; platform: string; name: string | null; handle: string | null } | null;
  contentCount: number;
  reviewedClassificationCount: number;
  review: {
    id: string;
    period_start: string;
    period_end: string;
    summary: Record<string, unknown>;
    insufficient_data: boolean;
    missing_data: string[];
    confidence: "baixa" | "media" | "alta" | null;
    data_quality: Record<string, unknown>;
    scores: Record<string, unknown>;
    created_at: string;
  } | null;
  recommendations: OrganicRecommendationRow[];
}

const EMPTY_VIEW: ViewState = {
  entitled: false,
  subscriptionActive: false,
  enabled: false,
  analysisWindowDays: 30,
  product: null,
  account: null,
  contentCount: 0,
  reviewedClassificationCount: 0,
  review: null,
  recommendations: [],
};

function countFromCoverage(value: unknown, total: number): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  const ratio = parsed > 1 ? parsed / 100 : parsed;
  return Math.round(Math.max(0, Math.min(1, ratio)) * total);
}

export default function OrganicGrowthPage() {
  const t = useTranslations("organicGrowth");
  const router = useRouter();
  const { configured, loading, userId, currentOrg } = useOrganization();
  const [view, setView] = useState<ViewState>(EMPTY_VIEW);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentOrg || !userId) return;
    setLoaded(false);
    const supabase = createClient();
    const [entitlementResult, settingsResult, accountLinkResult] = await Promise.all([
      supabase.rpc("org_entitlements", { target_org: currentOrg.id }),
      supabase
        .from("organic_growth_settings")
        .select("enabled, analysis_window_days")
        .eq("org_id", currentOrg.id)
        .maybeSingle(),
      supabase
        .from("social_account_products")
        .select("social_account_id, product_id, is_primary")
        .eq("org_id", currentOrg.id)
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const entitlement = entitlementResult.data as {
      active?: boolean;
      limits?: Record<string, unknown>;
    } | null;
    const base: ViewState = {
      ...EMPTY_VIEW,
      subscriptionActive: Boolean(entitlement?.active),
      entitled: entitlement?.limits?.organic_growth === true,
      enabled: Boolean(settingsResult.data?.enabled),
      analysisWindowDays: settingsResult.data?.analysis_window_days ?? 30,
    };
    const accountLink = accountLinkResult.data;
    if (!accountLink) {
      setView(base);
      setLoaded(true);
      return;
    }

    const [productResult, accountResult] = await Promise.all([
      supabase.from("products").select("id, name").eq("id", accountLink.product_id).maybeSingle(),
      supabase
        .from("social_accounts")
        .select("id, platform, name, handle")
        .eq("id", accountLink.social_account_id)
        .maybeSingle(),
    ]);
    const product = productResult.data;
    const account = accountResult.data;
    if (!product || !account) {
      setView(base);
      setLoaded(true);
      return;
    }

    const { data: contentLinks } = await supabase
      .from("organic_content_products")
      .select("content_id")
      .eq("org_id", currentOrg.id)
      .eq("product_id", product.id);
    const linkedIds = (contentLinks ?? []).map((link) => link.content_id);
    let contentIds: string[] = [];
    if (linkedIds.length > 0) {
      const { data: accountContents } = await supabase
        .from("organic_content_items")
        .select("id")
        .eq("org_id", currentOrg.id)
        .eq("social_account_id", account.id)
        .eq("status", "published")
        .in("id", linkedIds);
      contentIds = (accountContents ?? []).map((content) => content.id);
    }

    let reviewedClassificationCount = 0;
    if (contentIds.length > 0) {
      const { count } = await supabase
        .from("organic_content_classifications")
        .select("id", { count: "exact", head: true })
        .eq("org_id", currentOrg.id)
        .eq("product_id", product.id)
        .eq("source", "user")
        .in("content_id", contentIds);
      reviewedClassificationCount = count ?? 0;
    }

    const { data: review } = await supabase
      .from("organic_reviews")
      .select(
        "id, period_start, period_end, summary, insufficient_data, missing_data, confidence, data_quality, scores, created_at",
      )
      .eq("org_id", currentOrg.id)
      .eq("product_id", product.id)
      .eq("social_account_id", account.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let recommendations: OrganicRecommendationRow[] = [];
    if (review) {
      const { data: recommendationRows } = await supabase
        .from("organic_recommendations")
        .select("*")
        .eq("review_id", review.id)
        .order("rank");
      const recommendationIds = (recommendationRows ?? []).map((item) => item.id);
      const [evidenceResult, feedbackResult, experimentResult] =
        recommendationIds.length > 0
          ? await Promise.all([
              supabase
                .from("organic_recommendation_evidence")
                .select("id, recommendation_id, kind, description, content_id, value, observed_at")
                .in("recommendation_id", recommendationIds)
                .order("sort"),
              supabase
                .from("organic_recommendation_feedback")
                .select("recommendation_id, rating")
                .eq("user_id", userId)
                .in("recommendation_id", recommendationIds),
              supabase
                .from("organic_recommendation_experiments")
                .select("recommendation_id, experiment_id")
                .in("recommendation_id", recommendationIds),
            ])
          : [{ data: [] }, { data: [] }, { data: [] }];
      recommendations = (recommendationRows ?? []).map((row) => ({
        id: row.id,
        kind: row.kind,
        diagnosis: row.diagnosis,
        context: row.context,
        hypothesis: row.hypothesis,
        recommended_action: row.recommended_action,
        priority: row.priority,
        estimated_effort: row.effort,
        expected_impact: row.impact,
        risk: row.risk ?? "",
        confidence: row.confidence,
        success_criterion: row.success_criterion,
        next_review: row.reevaluation_window,
        status: row.status,
        rank: row.rank,
        experiment_id: experimentResult.data?.find((item) => item.recommendation_id === row.id)?.experiment_id ?? null,
        evidence: (evidenceResult.data ?? [])
          .filter((item) => item.recommendation_id === row.id)
          .map((item) => ({
            id: item.id,
            kind: item.kind,
            fact: item.description,
            content_id: item.content_id,
            value: item.value,
            observed_at: item.observed_at,
          })),
        feedback: (feedbackResult.data ?? []).find((item) => item.recommendation_id === row.id)?.rating ?? null,
      })) as OrganicRecommendationRow[];
    }

    setView({
      ...base,
      product,
      account,
      contentCount: contentIds.length,
      reviewedClassificationCount,
      review: review as ViewState["review"],
      recommendations,
    });
    setLoaded(true);
  }, [currentOrg, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (enabled: boolean) => {
    if (!currentOrg) return;
    setBusy("toggle");
    setError(null);
    const result = await setOrganicGrowthEnabled(currentOrg.id, enabled);
    setBusy(null);
    if (!result.ok) setError(t(`error-${result.code}`));
    else if (enabled && !view.account) router.push("/organic-growth/setup");
    else load();
  };

  const generate = async () => {
    if (!currentOrg || !view.product || !view.account) return;
    setBusy("review");
    setError(null);
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - Math.max(1, view.analysisWindowDays - 1));
    const result = await generateOrganicReview({
      orgId: currentOrg.id,
      productId: view.product.id,
      socialAccountId: view.account.id,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
    });
    setBusy(null);
    if (!result.ok) {
      setError(t(`error-${result.code}`));
      return;
    }
    router.push(`/organic-growth/reviews/${result.id}`);
    router.refresh();
  };

  const feedback = async (recommendationId: string, rating: RecommendationFeedback) => {
    if (!currentOrg) return;
    setBusy(recommendationId);
    const result = await recordOrganicRecommendationFeedback({ orgId: currentOrg.id, recommendationId, rating });
    setBusy(null);
    if (!result.ok) setError(t(`error-${result.code}`));
    else load();
  };

  const experiment = async (recommendationId: string) => {
    if (!currentOrg) return;
    setBusy(recommendationId);
    const result = await createExperimentFromOrganicRecommendation({ orgId: currentOrg.id, recommendationId });
    setBusy(null);
    if (!result.ok) setError(t(`error-${result.code}`));
    else router.push(`/experiments/${result.id}`);
  };

  const qualitySource = view.review?.data_quality ?? {};
  const score = Number(qualitySource.score ?? 0);
  const quality: OrganicDataQuality = {
    score,
    contentCount: Number(qualitySource.scopedContents ?? view.contentCount),
    comparableCount: countFromCoverage(qualitySource.comparableCohortCoverage, view.contentCount),
    classifiedCount: countFromCoverage(qualitySource.classificationCoverage, view.contentCount),
    withMetricsCount: countFromCoverage(qualitySource.performanceMetricCoverage, view.contentCount),
    missing: Array.isArray(qualitySource.issues) ? (qualitySource.issues as string[]) : [],
  };
  const funnel = (view.review?.scores?.funnelCoverage ?? null) as {
    totalContents?: number;
    stages?: { stage: string; count: number; share: number }[];
  } | null;
  const coverage: CoverageBucket[] = (funnel?.stages ?? [])
    .filter((item) => item.count > 0)
    .map((item) => ({ key: item.stage, count: item.count, percent: item.share * 100 }));
  const summaryText = String(view.review?.summary?.text ?? "");

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <OrganicGrowthHeader
          title={t("title")}
          actions={
            loaded && view.enabled ? (
              <Box className="flex flex-row flex-wrap gap-2">
                {view.contentCount > 0 && (
                  <Button
                    variant="contained"
                    startIcon={<NiSparkle size="small" />}
                    disabled={busy === "review"}
                    onClick={generate}
                  >
                    {busy === "review" ? t("review-generating") : t("review-generate")}
                  </Button>
                )}
                <Button variant="text" color="grey" disabled={busy === "toggle"} onClick={() => toggle(false)}>
                  {t("deactivation-cta")}
                </Button>
              </Box>
            ) : null
          }
        />

        {!configured && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("not-configured")}
            </Alert>
          </Grid>
        )}
        {configured && !loading && !currentOrg && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("no-org")}
            </Alert>
          </Grid>
        )}
        {currentOrg && !loaded && (
          <>
            <Grid size={12}>
              <Skeleton variant="rounded" height={180} />
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <Skeleton variant="rounded" height={260} />
            </Grid>
            <Grid size={{ xs: 12, lg: 6 }}>
              <Skeleton variant="rounded" height={260} />
            </Grid>
          </>
        )}

        {error && (
          <Grid size={12}>
            <Alert severity="error" className="neutral bg-background-paper/60!">
              {error}
            </Alert>
          </Grid>
        )}

        {currentOrg && loaded && (!view.subscriptionActive || !view.entitled) && (
          <Grid size={12}>
            <EmptyState
              icon={<NiChartLineBar />}
              title={t("entitlement-title")}
              description={t("entitlement-body")}
              action={{ label: t("entitlement-cta"), href: "/settings/billing" }}
            />
          </Grid>
        )}

        {currentOrg && loaded && view.entitled && !view.enabled && (
          <Grid size={12}>
            <EmptyState
              icon={<NiChartLineBar />}
              title={t("activation-title")}
              description={t("activation-body")}
              action={{ label: busy === "toggle" ? t("activating") : t("activation-cta"), onClick: () => toggle(true) }}
            />
          </Grid>
        )}

        {currentOrg && loaded && view.entitled && view.enabled && (!view.product || !view.account) && (
          <Grid size={12}>
            <EmptyState
              icon={<NiNetwork />}
              title={t("import-no-setup-title")}
              description={t("import-no-setup-description")}
              action={{ label: t("import-no-setup-action"), href: "/organic-growth/setup" }}
            />
          </Grid>
        )}

        {currentOrg && userId && loaded && view.enabled && view.product && view.account && (
          <Grid size={12}>
            <OrganicActivationChecklist orgId={currentOrg.id} userId={userId} />
          </Grid>
        )}

        {currentOrg && loaded && view.enabled && view.product && view.account && view.contentCount === 0 && (
          <Grid size={12}>
            <EmptyState
              icon={<NiCamera />}
              title={t("empty-content-title")}
              description={t("empty-content-body")}
              action={{ label: t("empty-content-cta"), href: "/organic-growth/import" }}
            />
          </Grid>
        )}

        {view.enabled && view.contentCount > 0 && (
          <>
            <Grid size={{ xs: 12, lg: 5 }}>
              <DataQualityCard quality={quality} />
            </Grid>
            <Grid size={{ xs: 12, lg: 7 }}>
              <Card component="section" className="h-full">
                <CardContent className="flex h-full flex-col gap-3">
                  <Box className="flex flex-row flex-wrap items-center gap-2">
                    <Typography variant="h5" component="h2" className="card-title grow">
                      {view.review ? t("review-latest") : t("empty-review-title")}
                    </Typography>
                    {view.review?.confidence && (
                      <Chip
                        size="small"
                        variant="outlined"
                        color={
                          view.review.confidence === "alta"
                            ? "success"
                            : view.review.confidence === "media"
                              ? "primary"
                              : "warning"
                        }
                        label={`${t("confidence")}: ${t(`confidence-${view.review.confidence}`)}`}
                      />
                    )}
                  </Box>
                  {view.review ? (
                    <>
                      {view.review.insufficient_data && (
                        <Alert severity="info" className="neutral bg-background-paper/60!">
                          <Typography variant="subtitle2">{t("insufficient-title")}</Typography>
                          <Typography variant="body2">
                            {view.review.missing_data.join(" · ") || t("insufficient-body")}
                          </Typography>
                        </Alert>
                      )}
                      <Typography variant="body1" className="leading-6">
                        {summaryText}
                      </Typography>
                      <Button
                        className="mt-auto self-start"
                        variant="outlined"
                        color="grey"
                        href={`/organic-growth/reviews/${view.review.id}`}
                        LinkComponent={Link}
                      >
                        {t("review-open")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Typography variant="body1" className="text-text-secondary leading-6">
                        {t("empty-review-body")}
                      </Typography>
                      <Button className="mt-auto self-start" variant="contained" onClick={generate}>
                        {t("empty-review-cta")}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {coverage.length > 0 && (
              <Grid size={12}>
                <FunnelCoverage buckets={coverage} total={funnel?.totalContents ?? view.contentCount} />
              </Grid>
            )}

            {view.recommendations.length > 0 && (
              <Grid size={12} spacing={3} container component="section">
                <Grid size={12}>
                  <Typography variant="h4" component="h2">
                    {t("recommendations-title")}
                  </Typography>
                </Grid>
                {view.recommendations.map((recommendation) => (
                  <Grid key={recommendation.id} size={12}>
                    <RecommendationCard
                      recommendation={recommendation}
                      busy={busy === recommendation.id}
                      onFeedback={(rating) => feedback(recommendation.id, rating)}
                      onCreateExperiment={() => experiment(recommendation.id)}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </Grid>
    </Grid>
  );
}
