"use client";

import { useOrganization } from "../../../settings/organization/components/use-organization";
import {
  createExperimentFromOrganicRecommendation,
  recordOrganicRecommendationFeedback,
  recordOrganicReviewExport,
} from "../../actions";
import DataQualityCard, { type OrganicDataQuality as DataQualityCardValue } from "../../components/data-quality-card";
import FunnelCoverage, { type CoverageBucket } from "../../components/funnel-coverage";
import OrganicGrowthHeader from "../../components/organic-growth-header";
import RecommendationCard from "../../components/recommendation-card";
import type { OrganicRecommendationRow, OrganicReviewRow, RecommendationFeedback } from "../../types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  Typography,
} from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import NiArrowLeft from "@/icons/nexture/ni-arrow-left";
import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiDocumentCross from "@/icons/nexture/ni-document-cross";
import NiPrinter from "@/icons/nexture/ni-printer";
import NiSignalUp from "@/icons/nexture/ni-signal-up";
import { createClient } from "@flyee/auth/client";
import type {
  ContentAnalysis,
  FunnelCoverage as DomainFunnelCoverage,
  OrganicDataQuality as DomainDataQuality,
  OrganicRecommendationSource,
  OrganicTechnicalBasis,
  TransparentScore,
} from "@flyee/organic-growth";

interface RecommendationOutput {
  technical_basis?: OrganicTechnicalBasis[];
  sources?: OrganicRecommendationSource[];
  missing_data?: string;
}

interface RecommendationDetail extends OrganicRecommendationRow {
  output?: RecommendationOutput | null;
}

interface ReviewDetail extends OrganicReviewRow {
  platform: string;
  scores: {
    funnelCoverage?: DomainFunnelCoverage;
    contentAnalyses?: ContentAnalysis[];
  } | null;
  completed_at: string | null;
  taxonomy_version: string;
  score_version: string | null;
}

interface DetailState {
  review: ReviewDetail;
  productName: string;
  accountName: string;
  recommendations: RecommendationDetail[];
  contentNames: Map<string, string>;
}

function missingData(value: OrganicReviewRow["missing_data"]): string[] {
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

export default function OrganicReviewDetailPage() {
  const t = useTranslations("organicGrowth");
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { configured, loading, userId, currentOrg } = useOrganization();
  const [state, setState] = useState<DetailState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: t("review-title") });

  const load = useCallback(async () => {
    if (!currentOrg || !userId || !params.id) return;
    setLoaded(false);
    setError(false);
    setActionError(false);
    const supabase = createClient();
    const reviewResult = await supabase
      .from("organic_reviews")
      .select(
        "id, product_id, social_account_id, platform, period_start, period_end, status, summary, insufficient_data, missing_data, confidence, data_quality, scores, created_at, completed_at, taxonomy_version, score_version",
      )
      .eq("org_id", currentOrg.id)
      .eq("id", params.id)
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

    const review = reviewResult.data as unknown as ReviewDetail;
    const [productResult, accountResult, recommendationResult] = await Promise.all([
      supabase
        .from("products")
        .select("id, name")
        .eq("org_id", currentOrg.id)
        .eq("id", review.product_id)
        .maybeSingle(),
      review.social_account_id
        ? supabase
            .from("social_accounts")
            .select("id, name, handle")
            .eq("org_id", currentOrg.id)
            .eq("id", review.social_account_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("organic_recommendations")
        .select("*")
        .eq("org_id", currentOrg.id)
        .eq("review_id", review.id)
        .order("rank"),
    ]);
    if (productResult.error || accountResult.error || recommendationResult.error) {
      setError(true);
      setLoaded(true);
      return;
    }

    const recommendationIds = (recommendationResult.data ?? []).map((item) => item.id);
    const [evidenceResult, feedbackResult, experimentResult] =
      recommendationIds.length > 0
        ? await Promise.all([
            supabase
              .from("organic_recommendation_evidence")
              .select("id, recommendation_id, kind, description, content_id, value, observed_at")
              .eq("org_id", currentOrg.id)
              .in("recommendation_id", recommendationIds)
              .order("sort"),
            supabase
              .from("organic_recommendation_feedback")
              .select("recommendation_id, rating")
              .eq("org_id", currentOrg.id)
              .eq("user_id", userId)
              .in("recommendation_id", recommendationIds),
            supabase
              .from("organic_recommendation_experiments")
              .select("recommendation_id, experiment_id")
              .eq("org_id", currentOrg.id)
              .in("recommendation_id", recommendationIds),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ];
    if (evidenceResult.error || feedbackResult.error || experimentResult.error) {
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
          experiment_id:
            experimentResult.data?.find((item) => item.recommendation_id === row.id)?.experiment_id ?? null,
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
          feedback: (feedbackResult.data ?? []).find((item) => item.recommendation_id === row.id)?.rating ?? null,
          output: row.output as RecommendationOutput,
        }) as RecommendationDetail,
    );

    const analysisIds = (review.scores?.contentAnalyses ?? []).map((analysis) => analysis.contentId);
    const contentIds = [
      ...new Set([
        ...analysisIds,
        ...(evidenceResult.data ?? [])
          .map((item) => item.content_id)
          .filter((id): id is string => typeof id === "string"),
      ]),
    ];
    const contentResult =
      contentIds.length > 0
        ? await supabase
            .from("organic_content_items")
            .select("id, external_content_id, title, caption")
            .eq("org_id", currentOrg.id)
            .in("id", contentIds)
        : { data: [], error: null };
    if (contentResult.error) {
      setError(true);
      setLoaded(true);
      return;
    }
    const contentNames = new Map(
      (contentResult.data ?? []).map((content) => [
        content.id,
        content.title || content.external_content_id || content.caption?.slice(0, 80) || content.id,
      ]),
    );

    setState({
      review,
      productName: productResult.data?.name ?? review.product_id,
      accountName:
        accountResult.data?.handle || accountResult.data?.name || review.social_account_id || review.platform,
      recommendations,
      contentNames,
    });
    setLoaded(true);
  }, [currentOrg, params.id, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const sendFeedback = async (recommendationId: string, rating: RecommendationFeedback) => {
    if (!currentOrg) return;
    setBusy(recommendationId);
    setActionError(false);
    const result = await recordOrganicRecommendationFeedback({ orgId: currentOrg.id, recommendationId, rating });
    setBusy(null);
    if (!result.ok) {
      setActionError(true);
      return;
    }
    setState((current) =>
      current
        ? {
            ...current,
            recommendations: current.recommendations.map((recommendation) =>
              recommendation.id === recommendationId ? { ...recommendation, feedback: rating } : recommendation,
            ),
          }
        : current,
    );
  };

  const createExperiment = async (recommendationId: string) => {
    if (!currentOrg) return;
    setBusy(recommendationId);
    setActionError(false);
    const result = await createExperimentFromOrganicRecommendation({ orgId: currentOrg.id, recommendationId });
    setBusy(null);
    if (!result.ok) {
      setActionError(true);
      return;
    }
    router.push(`/experiments/${result.id}`);
  };

  const printReview = async () => {
    if (!currentOrg || !state) return;
    setBusy("export");
    setActionError(false);
    const result = await recordOrganicReviewExport({ orgId: currentOrg.id, reviewId: state.review.id });
    setBusy(null);
    if (!result.ok) {
      setActionError(true);
      return;
    }
    handlePrint();
  };

  const confidenceLabel = (confidence: OrganicReviewRow["confidence"] | TransparentScore["confidence"]) =>
    confidence
      ? t(confidence === "alta" ? "confidence-high" : confidence === "media" ? "confidence-medium" : "confidence-low")
      : "";
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale).format(new Date(value));
  const scorePanel = (score: TransparentScore, title: string) => {
    const availableSignals = score.signals.filter((signal) => signal.available);
    return (
      <Card component="section" variant="outlined" className="h-full">
        <CardContent className="flex flex-col gap-4">
          <Box className="flex flex-row items-start gap-3">
            <span className="bg-primary/10 text-primary flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
              <NiSignalUp size="medium" />
            </span>
            <Box className="grow">
              <Typography variant="h6" component="h4" className="mb-0">
                {title}
              </Typography>
              <Typography variant="body2" className="text-text-secondary">
                {t("sample-size", { count: score.cohort.size })}
              </Typography>
            </Box>
            {score.score === null ? (
              <Chip size="small" variant="outlined" color="warning" label={t("score-missing-signals")} />
            ) : (
              <Chip size="small" variant="outlined" color="primary" label={t("score-value", { value: score.score })} />
            )}
          </Box>

          <Box className="flex flex-row flex-wrap gap-1.5">
            <Chip size="small" variant="outlined" color="grey" label={confidenceLabel(score.confidence)} />
            {score.cohort.filters.map((filter) => (
              <Chip key={`${filter.dimension}-${filter.value}`} size="small" variant="outlined" label={filter.value} />
            ))}
          </Box>

          <Typography variant="body2" className="text-text-secondary leading-6">
            {score.methodology}
          </Typography>

          {availableSignals.length > 0 && (
            <Box className="flex flex-col gap-2">
              <Typography variant="subtitle2">{t("score-signals")}</Typography>
              {availableSignals.map((signal) => (
                <Box key={signal.key} className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                  <Typography variant="body2">{signal.label}</Typography>
                  <Box className="flex flex-row flex-wrap gap-1">
                    {signal.percentile !== null && (
                      <Chip
                        size="small"
                        variant="outlined"
                        color="grey"
                        label={t("percentile", { value: signal.percentile })}
                      />
                    )}
                    {signal.normalizedValue !== null && (
                      <Chip size="small" variant="outlined" color="grey" label={signal.normalizedValue} />
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {score.missing.length > 0 && (
            <Alert severity="info" className="neutral bg-background-paper/60!">
              <Typography variant="subtitle2">{t("score-missing-signals")}</Typography>
              <Typography variant="body2">{score.missing.join(" · ")}</Typography>
            </Alert>
          )}
          <Typography variant="caption" className="text-text-secondary">
            {t("score-not-absolute")}
          </Typography>
        </CardContent>
      </Card>
    );
  };

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
  const analyses = review?.scores?.contentAnalyses ?? [];
  const summary = String((review?.summary as Record<string, unknown> | null)?.text ?? "");
  const reviewMissingData = missingData(review?.missing_data ?? null);
  const period = review
    ? `${formatDate(`${review.period_start}T00:00:00Z`)} – ${formatDate(`${review.period_end}T00:00:00Z`)}`
    : "";
  const generatedAt = review ? (review.completed_at ?? review.created_at ?? `${review.period_end}T23:59:59.999Z`) : "";

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <OrganicGrowthHeader
          title={t("review-title")}
          crumb={t("review-title")}
          actions={
            state ? (
              <Box className="flex flex-row flex-wrap gap-2 print:hidden">
                <Button
                  variant="outlined"
                  color="grey"
                  href="/organic-growth/reviews"
                  LinkComponent={Link}
                  startIcon={<NiArrowLeft size="small" />}
                >
                  {t("action-back")}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<NiPrinter size="small" />}
                  disabled={busy === "export"}
                  onClick={printReview}
                >
                  {t("review-print")}
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
          <Grid ref={printRef} size={12} container spacing={5}>
            <Grid size={12}>
              <Skeleton variant="rounded" height={220} />
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <Skeleton variant="rounded" height={280} />
            </Grid>
            <Grid size={{ xs: 12, lg: 7 }}>
              <Skeleton variant="rounded" height={280} />
            </Grid>
          </Grid>
        )}
        {currentOrg && loaded && error && (
          <Grid size={12}>
            <Alert severity="error" className="neutral bg-background-paper/60!">
              <Typography variant="subtitle2">{t("error-title")}</Typography>
              <Typography variant="body2">{t("error-body")}</Typography>
            </Alert>
          </Grid>
        )}
        {currentOrg && loaded && !error && actionError && (
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
              icon={<NiDocumentCross />}
              title={t("review-not-found")}
              description={t("empty-review-body")}
              action={{ label: t("action-back"), href: "/organic-growth/reviews" }}
            />
          </Grid>
        )}

        {state && review && !error && review.status !== "completed" && (
          <Grid size={12}>
            <Alert severity={review.status === "queued" || review.status === "processing" ? "info" : "error"}>
              {review.status === "queued" || review.status === "processing" ? t("loading-review") : t("error-body")}
            </Alert>
          </Grid>
        )}

        {state && review && !error && review.status === "completed" && (
          <>
            <Grid size={12}>
              <Card component="section">
                <CardContent className="flex flex-col gap-4">
                  <Box className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <Box>
                      <Typography variant="overline" className="text-primary">
                        {state.productName}
                      </Typography>
                      <Typography variant="h4" component="h2" className="mb-1">
                        {t("review-section-executive-summary")}
                      </Typography>
                      <Typography variant="body2" className="text-text-secondary">
                        {state.accountName}
                      </Typography>
                    </Box>
                    <Box className="flex flex-row flex-wrap gap-1.5">
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
                          label={t("review-confidence", { level: confidenceLabel(review.confidence) })}
                        />
                      )}
                      <Chip
                        size="small"
                        variant="outlined"
                        color="grey"
                        label={t("review-generated-at", {
                          when: formatDate(generatedAt),
                        })}
                      />
                    </Box>
                  </Box>

                  <Typography variant="body1" className="max-w-5xl leading-7">
                    {summary}
                  </Typography>

                  {review.insufficient_data && (
                    <Alert severity="info" className="neutral bg-background-paper/60!">
                      <Typography variant="subtitle2">{t("insufficient-title")}</Typography>
                      <Typography variant="body2">
                        {reviewMissingData.length > 0 ? reviewMissingData.join(" · ") : t("insufficient-body")}
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

            {analyses.length > 0 && (
              <Grid size={12} spacing={3} container component="section">
                <Grid size={12}>
                  <Typography variant="h4" component="h2">
                    {t("scores-title")}
                  </Typography>
                  <Typography variant="body1" className="text-text-secondary mt-1">
                    {t("scores-subtitle")}
                  </Typography>
                </Grid>
                <Grid size={12}>
                  {analyses.map((analysis, index) => (
                    <Accordion key={analysis.contentId} className="basic bordered mb-2" defaultExpanded={index === 0}>
                      <AccordionSummary expandIcon={<NiChevronDownSmall className="text-text-primary" />}>
                        <Box className="flex w-full flex-col justify-between gap-2 pr-3 sm:flex-row sm:items-center">
                          <Typography variant="subtitle1">
                            {state.contentNames.get(analysis.contentId) ?? analysis.contentId}
                          </Typography>
                          <Box className="flex flex-row flex-wrap gap-1.5">
                            {analysis.contentIntent.score !== null && (
                              <Chip
                                size="small"
                                variant="outlined"
                                color="primary"
                                label={t("score-value", { value: analysis.contentIntent.score })}
                              />
                            )}
                            {analysis.paidRepurpose.score !== null && (
                              <Chip size="small" variant="outlined" color="grey" label={t("score-paid-repurpose")} />
                            )}
                          </Box>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, lg: 6 }}>
                            {scorePanel(analysis.contentIntent, t("score-content-intent"))}
                          </Grid>
                          <Grid size={{ xs: 12, lg: 6 }}>
                            {scorePanel(analysis.paidRepurpose, t("score-paid-repurpose"))}
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Grid>
              </Grid>
            )}

            <Grid size={12} spacing={3} container component="section">
              <Grid size={12}>
                <Typography variant="h4" component="h2">
                  {t("recommendations-title")}
                </Typography>
              </Grid>
              {state.recommendations.length > 0 ? (
                state.recommendations.map((recommendation) => {
                  const technicalBasis = recommendation.output?.technical_basis ?? [];
                  const sources = recommendation.output?.sources ?? [];
                  const contextValues = Object.values(recommendation.context).filter(
                    (value): value is string => typeof value === "string" && value.trim().length > 0,
                  );
                  const recommendationMissingData = recommendation.output?.missing_data?.trim();
                  return (
                    <Grid key={recommendation.id} size={12}>
                      <Box className="flex flex-col gap-2">
                        <RecommendationCard
                          recommendation={recommendation}
                          busy={busy === recommendation.id}
                          onFeedback={(rating) => sendFeedback(recommendation.id, rating)}
                          onCreateExperiment={() => createExperiment(recommendation.id)}
                        />

                        {(technicalBasis.length > 0 ||
                          sources.length > 0 ||
                          contextValues.length > 0 ||
                          recommendationMissingData) && (
                          <Card component="aside" variant="outlined">
                            <CardContent className="flex flex-col gap-4">
                              {contextValues.length > 0 && (
                                <Box className="flex flex-col gap-2">
                                  <Typography variant="subtitle2">{t("recommendation-context")}</Typography>
                                  <Box className="flex flex-row flex-wrap gap-1.5">
                                    {contextValues.map((value, index) => (
                                      <Chip
                                        key={`${value}-${index}`}
                                        size="small"
                                        variant="outlined"
                                        color="grey"
                                        label={value}
                                      />
                                    ))}
                                  </Box>
                                </Box>
                              )}
                              {(technicalBasis.length > 0 || sources.length > 0) && (
                                <Box className="flex flex-col gap-2">
                                  <Typography variant="subtitle2">{t("recommendation-source")}</Typography>
                                  {technicalBasis.map((basis) => (
                                    <Typography
                                      key={`${basis.rule}-${basis.citation}`}
                                      variant="body2"
                                      className="leading-6"
                                    >
                                      {basis.rule} {basis.citation}
                                    </Typography>
                                  ))}
                                  <Box className="flex flex-row flex-wrap gap-1.5">
                                    {sources.map((source) => (
                                      <Chip
                                        key={`${source.type}-${source.reference}`}
                                        size="small"
                                        variant="outlined"
                                        color="grey"
                                        label={source.reference}
                                      />
                                    ))}
                                  </Box>
                                </Box>
                              )}
                              {recommendationMissingData && (
                                <Alert severity="info" className="neutral bg-background-paper/60!">
                                  <Typography variant="subtitle2">{t("recommendation-missing-data")}</Typography>
                                  <Typography variant="body2">{recommendationMissingData}</Typography>
                                </Alert>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </Box>
                    </Grid>
                  );
                })
              ) : (
                <Grid size={12}>
                  <EmptyState
                    icon={<NiDocumentCross />}
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
