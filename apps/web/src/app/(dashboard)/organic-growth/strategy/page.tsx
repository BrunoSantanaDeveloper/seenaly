"use client";

import { useOrganization } from "../../settings/organization/components/use-organization";
import DataQualityCard, { type OrganicDataQuality as DataQualityCardValue } from "../components/data-quality-card";
import FunnelCoverage, { type CoverageBucket } from "../components/funnel-coverage";
import OrganicGrowthHeader from "../components/organic-growth-header";
import RecommendationCard from "../components/recommendation-card";
import type { OrganicRecommendationRow, OrganicReviewRow } from "../types";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Card, CardContent, Chip, Grid, Skeleton, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";
import NiDocumentChart from "@/icons/nexture/ni-document-chart";
import NiPlus from "@/icons/nexture/ni-plus";
import { createClient } from "@flyee/auth/client";
import type {
  FunnelCoverage as DomainFunnelCoverage,
  OrganicDataQuality as DomainDataQuality,
} from "@flyee/organic-growth";

interface StrategyReview extends OrganicReviewRow {
  scores: {
    funnelCoverage?: DomainFunnelCoverage;
  } | null;
}

interface StrategyState {
  review: StrategyReview;
  recommendations: OrganicRecommendationRow[];
}

function asMissingData(value: OrganicReviewRow["missing_data"]): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function countFromCoverage(value: unknown, total: number): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  const ratio = parsed > 1 ? parsed / 100 : parsed;
  return Math.round(Math.max(0, Math.min(1, ratio)) * total);
}

export default function OrganicStrategyPage() {
  const t = useTranslations("organicGrowth");
  const locale = useLocale();
  const { configured, loading, currentOrg } = useOrganization();
  const [state, setState] = useState<StrategyState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoaded(false);
    setError(false);
    const supabase = createClient();
    const reviewResult = await supabase
      .from("organic_reviews")
      .select(
        "id, product_id, social_account_id, period_start, period_end, status, summary, insufficient_data, missing_data, confidence, data_quality, scores, created_at",
      )
      .eq("org_id", currentOrg.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reviewResult.error) {
      setError(true);
      setLoaded(true);
      return;
    }
    if (!reviewResult.data) {
      setState(null);
      setLoaded(true);
      return;
    }

    const review = reviewResult.data as unknown as StrategyReview;
    const recommendationResult = await supabase
      .from("organic_recommendations")
      .select("*")
      .eq("org_id", currentOrg.id)
      .eq("review_id", review.id)
      .order("rank");
    if (recommendationResult.error) {
      setError(true);
      setLoaded(true);
      return;
    }

    const recommendationIds = (recommendationResult.data ?? []).map((item) => item.id);
    const evidenceResult =
      recommendationIds.length > 0
        ? await supabase
            .from("organic_recommendation_evidence")
            .select("id, recommendation_id, kind, description, content_id, value, observed_at")
            .eq("org_id", currentOrg.id)
            .in("recommendation_id", recommendationIds)
            .order("sort")
        : { data: [], error: null };
    if (evidenceResult.error) {
      setError(true);
      setLoaded(true);
      return;
    }

    const recommendations = (recommendationResult.data ?? []).map(
      (row) =>
        ({
          id: row.id,
          kind: row.kind,
          diagnosis: row.diagnosis,
          context: row.context as Record<string, unknown>,
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
          evidence: (evidenceResult.data ?? [])
            .filter((item) => item.recommendation_id === row.id)
            .map((item) => ({
              id: item.id,
              kind: item.kind,
              fact: item.description,
              content_id: item.content_id,
              value: item.value as Record<string, unknown> | number | string | null,
              observed_at: item.observed_at,
            })),
        }) as OrganicRecommendationRow,
    );

    setState({ review, recommendations });
    setLoaded(true);
  }, [currentOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const review = state?.review;
  const qualitySource = (review?.data_quality ?? {}) as Partial<DomainDataQuality>;
  const scopedContents = Number(qualitySource.scopedContents ?? 0);
  const quality: DataQualityCardValue = {
    score: Number(qualitySource.score ?? 0),
    contentCount: scopedContents,
    comparableCount: countFromCoverage(qualitySource.comparableCohortCoverage, scopedContents),
    classifiedCount: countFromCoverage(qualitySource.classificationCoverage, scopedContents),
    withMetricsCount: countFromCoverage(qualitySource.performanceMetricCoverage, scopedContents),
    missing: Array.isArray(qualitySource.issues) ? qualitySource.issues : [],
  };
  const funnel = review?.scores?.funnelCoverage;
  const coverage: CoverageBucket[] = (funnel?.stages ?? [])
    .filter((stage) => stage.count > 0)
    .map((stage) => ({ key: stage.stage, count: stage.count, percent: stage.share * 100 }));
  const summary = String((review?.summary as Record<string, unknown> | null)?.text ?? "");
  const missingData = asMissingData(review?.missing_data ?? null);
  const period = review
    ? `${new Intl.DateTimeFormat(locale).format(new Date(`${review.period_start}T00:00:00Z`))} – ${new Intl.DateTimeFormat(locale).format(new Date(`${review.period_end}T00:00:00Z`))}`
    : "";

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <OrganicGrowthHeader
          title={t("nav-strategy")}
          crumb={t("nav-strategy")}
          actions={
            review ? (
              <Box className="flex flex-row flex-wrap gap-2">
                <Button
                  variant="outlined"
                  color="grey"
                  href="/organic-growth/import"
                  LinkComponent={Link}
                  startIcon={<NiPlus size="small" />}
                >
                  {t("content-import")}
                </Button>
                <Button
                  variant="contained"
                  href={`/organic-growth/reviews/${review.id}`}
                  LinkComponent={Link}
                  startIcon={<NiDocumentChart size="small" />}
                >
                  {t("review-open")}
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
            <Grid size={{ xs: 12, lg: 5 }}>
              <Skeleton variant="rounded" height={280} />
            </Grid>
            <Grid size={{ xs: 12, lg: 7 }}>
              <Skeleton variant="rounded" height={280} />
            </Grid>
          </>
        )}
        {currentOrg && loaded && error && (
          <Grid size={12}>
            <Alert severity="error" className="neutral bg-background-paper/60!">
              <Typography variant="subtitle2">{t("error-title")}</Typography>
              <Typography variant="body2">{t("error-body")}</Typography>
            </Alert>
          </Grid>
        )}
        {currentOrg && loaded && !error && !state && (
          <Grid size={12}>
            <EmptyState
              icon={<NiChartFunnel />}
              title={t("empty-strategy-title")}
              description={t("empty-strategy-body")}
              action={{ label: t("empty-review-cta"), href: "/organic-growth" }}
            />
          </Grid>
        )}

        {review && !error && (
          <>
            <Grid size={12}>
              <Card component="section">
                <CardContent className="flex flex-col gap-4">
                  <Box className="flex flex-row flex-wrap items-start gap-2">
                    <Box className="grow">
                      <Typography variant="overline" className="text-primary">
                        {t("review-latest")}
                      </Typography>
                      <Typography variant="h4" component="h2" className="mb-1">
                        {t("review-section-executive-summary")}
                      </Typography>
                    </Box>
                    <Chip size="small" variant="outlined" color="grey" label={t("review-period", { period })} />
                    {review.confidence && (
                      <Chip
                        size="small"
                        variant="outlined"
                        color={
                          review.confidence === "alta"
                            ? "success"
                            : review.confidence === "media"
                              ? "primary"
                              : "warning"
                        }
                        label={t("review-confidence", {
                          level: t(
                            review.confidence === "alta"
                              ? "confidence-high"
                              : review.confidence === "media"
                                ? "confidence-medium"
                                : "confidence-low",
                          ),
                        })}
                      />
                    )}
                  </Box>
                  <Typography variant="body1" className="max-w-4xl leading-7">
                    {summary}
                  </Typography>
                  {review.insufficient_data && (
                    <Alert severity="info" className="neutral bg-background-paper/60!">
                      <Typography variant="subtitle2">{t("insufficient-title")}</Typography>
                      <Typography variant="body2">
                        {missingData.length > 0 ? missingData.join(" · ") : t("insufficient-body")}
                      </Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, lg: 5 }}>
              <DataQualityCard quality={quality} />
            </Grid>
            <Grid size={{ xs: 12, lg: 7 }}>
              {coverage.length > 0 ? (
                <FunnelCoverage buckets={coverage} total={funnel?.totalContents ?? scopedContents} />
              ) : (
                <EmptyState
                  icon={<NiChartFunnel />}
                  title={t("empty-strategy-title")}
                  description={t("empty-strategy-body")}
                  action={{ label: t("content-import"), href: "/organic-growth/import" }}
                />
              )}
            </Grid>

            <Grid size={12} spacing={3} container component="section">
              <Grid size={12}>
                <Typography variant="h4" component="h2">
                  {t("recommendations-title")}
                </Typography>
              </Grid>
              {state.recommendations.length > 0 ? (
                state.recommendations.map((recommendation) => (
                  <Grid key={recommendation.id} size={12}>
                    <RecommendationCard recommendation={recommendation} />
                  </Grid>
                ))
              ) : (
                <Grid size={12}>
                  <EmptyState
                    icon={<NiDocumentChart />}
                    title={t("insufficient-title")}
                    description={t("insufficient-body")}
                    action={{ label: t("content-import"), href: "/organic-growth/import" }}
                  />
                </Grid>
              )}
            </Grid>
          </>
        )}
      </Grid>
    </Grid>
  );
}
