"use client";

import { useOrganization } from "../../settings/organization/components/use-organization";
import OrganicGrowthHeader from "../components/organic-growth-header";
import type { OrganicReviewRow } from "../types";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Card, CardContent, Chip, Grid, Skeleton, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiDocumentChart from "@/icons/nexture/ni-document-chart";
import { createClient } from "@flyee/auth/client";

interface ReviewHistoryRow extends OrganicReviewRow {
  completed_at: string | null;
  productName: string;
  accountName: string;
  recommendationCount: number;
}

export default function OrganicReviewsPage() {
  const t = useTranslations("organicGrowth");
  const locale = useLocale();
  const { configured, loading, currentOrg } = useOrganization();
  const [reviews, setReviews] = useState<ReviewHistoryRow[]>([]);
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
        "id, product_id, social_account_id, period_start, period_end, status, summary, insufficient_data, missing_data, confidence, data_quality, created_at, completed_at",
      )
      .eq("org_id", currentOrg.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false });
    if (reviewResult.error) {
      setError(true);
      setLoaded(true);
      return;
    }

    const rows = (reviewResult.data ?? []) as unknown as (OrganicReviewRow & { completed_at: string | null })[];
    if (rows.length === 0) {
      setReviews([]);
      setLoaded(true);
      return;
    }

    const productIds = [...new Set(rows.map((review) => review.product_id))];
    const accountIds = [
      ...new Set(rows.map((review) => review.social_account_id).filter((id): id is string => Boolean(id))),
    ];
    const reviewIds = rows.map((review) => review.id);
    const [productResult, accountResult, recommendationResult] = await Promise.all([
      supabase.from("products").select("id, name").eq("org_id", currentOrg.id).in("id", productIds),
      accountIds.length > 0
        ? supabase.from("social_accounts").select("id, name, handle").eq("org_id", currentOrg.id).in("id", accountIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("organic_recommendations")
        .select("id, review_id")
        .eq("org_id", currentOrg.id)
        .in("review_id", reviewIds),
    ]);
    if (productResult.error || accountResult.error || recommendationResult.error) {
      setError(true);
      setLoaded(true);
      return;
    }

    const products = new Map((productResult.data ?? []).map((product) => [product.id, product.name]));
    const accounts = new Map(
      (accountResult.data ?? []).map((account) => [account.id, account.handle || account.name || account.id]),
    );
    const recommendationCounts = new Map<string, number>();
    for (const recommendation of recommendationResult.data ?? []) {
      recommendationCounts.set(recommendation.review_id, (recommendationCounts.get(recommendation.review_id) ?? 0) + 1);
    }

    setReviews(
      rows.map((review) => ({
        ...review,
        productName: products.get(review.product_id) ?? review.product_id,
        accountName: review.social_account_id
          ? (accounts.get(review.social_account_id) ?? review.social_account_id)
          : "",
        recommendationCount: recommendationCounts.get(review.id) ?? 0,
      })),
    );
    setLoaded(true);
  }, [currentOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (value: string) => new Intl.DateTimeFormat(locale).format(new Date(value));
  const confidenceLabel = (confidence: OrganicReviewRow["confidence"]) =>
    confidence
      ? t(confidence === "alta" ? "confidence-high" : confidence === "media" ? "confidence-medium" : "confidence-low")
      : null;

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <OrganicGrowthHeader title={t("reviews-title")} crumb={t("reviews-title")} />

        <Grid size={12}>
          <Typography variant="body1" className="text-text-secondary max-w-3xl leading-6">
            {t("reviews-subtitle")}
          </Typography>
        </Grid>

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
        {currentOrg &&
          !loaded &&
          Array.from({ length: 3 }, (_, index) => (
            <Grid key={index} size={12}>
              <Skeleton variant="rounded" height={180} />
            </Grid>
          ))}
        {currentOrg && loaded && error && (
          <Grid size={12}>
            <Alert severity="error" className="neutral bg-background-paper/60!">
              <Typography variant="subtitle2">{t("error-title")}</Typography>
              <Typography variant="body2">{t("error-body")}</Typography>
            </Alert>
          </Grid>
        )}
        {currentOrg && loaded && !error && reviews.length === 0 && (
          <Grid size={12}>
            <EmptyState
              icon={<NiDocumentChart />}
              title={t("empty-review-title")}
              description={t("empty-review-body")}
              action={{ label: t("empty-review-cta"), href: "/organic-growth" }}
            />
          </Grid>
        )}

        {currentOrg && loaded && !error && reviews.length > 0 && (
          <Grid size={12} spacing={3} container component="section">
            <Grid size={12}>
              <Typography variant="h4" component="h2">
                {t("review-history")}
              </Typography>
            </Grid>
            {reviews.map((review) => {
              const summary = String((review.summary as Record<string, unknown> | null)?.text ?? "");
              const period = `${formatDate(`${review.period_start}T00:00:00Z`)} – ${formatDate(`${review.period_end}T00:00:00Z`)}`;
              const generatedAt = review.completed_at || review.created_at;
              const confidence = confidenceLabel(review.confidence);
              return (
                <Grid key={review.id} size={12}>
                  <Card component="article">
                    <CardContent className="flex flex-col gap-4">
                      <Box className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <Box className="flex flex-row items-start gap-3">
                          <span className="bg-primary/10 text-primary flex h-11 w-11 flex-none items-center justify-center rounded-2xl">
                            <NiDocumentChart size="medium" />
                          </span>
                          <Box>
                            <Typography variant="h5" component="h2" className="card-title mb-0">
                              {review.productName}
                            </Typography>
                            {review.accountName && (
                              <Typography variant="body2" className="text-text-secondary">
                                {review.accountName}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Box className="flex flex-row flex-wrap gap-1.5">
                          {confidence && (
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
                              label={confidence}
                            />
                          )}
                          {review.insufficient_data && (
                            <Chip size="small" variant="outlined" color="warning" label={t("insufficient-title")} />
                          )}
                          <Chip
                            size="small"
                            variant="outlined"
                            color="grey"
                            label={t("results-count", { count: review.recommendationCount })}
                          />
                        </Box>
                      </Box>

                      <Box className="flex flex-row flex-wrap gap-x-5 gap-y-1">
                        <Typography variant="body2" className="text-text-secondary">
                          {t("review-period", { period })}
                        </Typography>
                        <Typography variant="body2" className="text-text-secondary">
                          {t("review-generated-at", { when: formatDate(generatedAt) })}
                        </Typography>
                      </Box>

                      {summary && (
                        <Typography variant="body1" className="max-w-4xl leading-6">
                          {summary}
                        </Typography>
                      )}

                      <Button
                        className="self-start"
                        variant="outlined"
                        color="grey"
                        href={`/organic-growth/reviews/${review.id}`}
                        LinkComponent={Link}
                        endIcon={<NiArrowRight size="small" />}
                      >
                        {t("review-open")}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}
