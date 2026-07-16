"use client";

import { useOrganization } from "../../../settings/organization/components/use-organization";
import { createExperimentFromOrganicContent, createOrganicPaidLink, createOrganicVariation } from "../../actions";
import OrganicGrowthHeader from "../../components/organic-growth-header";
import ClassificationForm from "./components/classification-form";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Card, CardContent, Chip, Grid, Skeleton, Typography } from "@mui/material";

import NiCamera from "@/icons/nexture/ni-camera";
import NiFlask from "@/icons/nexture/ni-flask";
import NiPlus from "@/icons/nexture/ni-plus";
import NiShare from "@/icons/nexture/ni-share";
import { createClient } from "@flyee/auth/client";

interface DetailState {
  content: Record<string, unknown> & {
    id: string;
    creative_id: string;
    title: string | null;
    caption: string | null;
    description: string | null;
    platform: string;
    format: string | null;
    permalink_url: string | null;
    published_at: string | null;
  };
  product: { id: string; name: string };
  classification: (Record<string, unknown> & { id: string; source: string; confidence: string | null }) | null;
  metric: Record<string, number | string | null> | null;
}

export default function OrganicContentDetailPage() {
  const t = useTranslations("organicGrowth");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { configured, loading, currentOrg } = useOrganization();
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentOrg || !params.id) return;
    const supabase = createClient();
    const { data: content } = await supabase
      .from("organic_content_items")
      .select("id, creative_id, title, caption, description, platform, format, permalink_url, published_at")
      .eq("org_id", currentOrg.id)
      .eq("id", params.id)
      .maybeSingle();
    if (!content) {
      setLoaded(true);
      return;
    }
    const { data: link } = await supabase
      .from("organic_content_products")
      .select("product_id")
      .eq("org_id", currentOrg.id)
      .eq("content_id", content.id)
      .eq("is_primary", true)
      .maybeSingle();
    const productId = link?.product_id;
    const [productResult, classificationResult, metricResult] = await Promise.all([
      productId
        ? supabase.from("products").select("id, name").eq("id", productId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("organic_content_classifications")
        .select("*")
        .eq("content_id", content.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("organic_content_metric_snapshots")
        .select("*")
        .eq("content_id", content.id)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (productResult.data) {
      const classifications = classificationResult.data ?? [];
      setDetail({
        content,
        product: productResult.data,
        classification:
          classifications.find((classification) => classification.source === "user") ?? classifications[0] ?? null,
        metric: metricResult.data,
      } as DetailState);
    }
    setLoaded(true);
  }, [currentOrg, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, action: () => Promise<{ ok: true; id?: string } | { ok: false; code: string }>) => {
    setError(null);
    setBusy(key);
    const result = await action();
    setBusy(null);
    if (!result.ok) {
      setError(t(`error-${result.code}`));
      return;
    }
    if (key === "experiment" && result.id) router.push(`/experiments/${result.id}`);
    else if (key === "variation" && result.id) router.push(`/creatives/${result.id}`);
    else load();
  };

  const metric = (key: string) => {
    const value = detail?.metric?.[key];
    return typeof value === "number" ? value.toLocaleString() : (value ?? "—");
  };

  const classification = detail?.classification;
  const initial = classification
    ? {
        funnelStage: String(classification.funnel_stage ?? ""),
        strategicIntent: String(classification.strategic_intent ?? ""),
        narrativeType: String(classification.narrative_type ?? ""),
        theme: String(classification.theme ?? ""),
        hook: String(classification.hook ?? ""),
        angle: String(classification.angle ?? ""),
        promise: String(classification.promise ?? ""),
        pain: String(classification.pain ?? ""),
        desire: String(classification.desire ?? ""),
        objection: String(classification.objection ?? ""),
        proof: String(classification.proof ?? ""),
        cta: String(classification.cta ?? ""),
        audience: String(classification.audience ?? ""),
        visualStyle: String(classification.visual_style ?? ""),
        toneOfVoice: String(classification.tone_of_voice ?? ""),
      }
    : undefined;

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <OrganicGrowthHeader
          title={detail?.content.title || t("content-detail-title")}
          crumb={t("content-title")}
          actions={
            detail && (
              <Box className="flex flex-row flex-wrap gap-2">
                <Button
                  variant="outlined"
                  color="grey"
                  startIcon={<NiFlask size="small" />}
                  disabled={Boolean(busy)}
                  onClick={() =>
                    run("experiment", () =>
                      createExperimentFromOrganicContent({
                        orgId: currentOrg!.id,
                        productId: detail.product.id,
                        contentId: detail.content.id,
                      }),
                    )
                  }
                >
                  {t("create-experiment")}
                </Button>
                <Button
                  variant="outlined"
                  color="grey"
                  startIcon={<NiShare size="small" />}
                  disabled={Boolean(busy)}
                  onClick={() =>
                    run("paid", () => createOrganicPaidLink({ orgId: currentOrg!.id, contentId: detail.content.id }))
                  }
                >
                  {t("mark-paid-opportunity")}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<NiPlus size="small" />}
                  disabled={Boolean(busy)}
                  onClick={() =>
                    run("variation", () =>
                      createOrganicVariation({
                        orgId: currentOrg!.id,
                        productId: detail.product.id,
                        contentId: detail.content.id,
                      }),
                    )
                  }
                >
                  {t("create-variation")}
                </Button>
              </Box>
            )
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
          <Grid size={12}>
            <Skeleton variant="rounded" height={420} />
          </Grid>
        )}
        {currentOrg && loaded && !detail && (
          <Grid size={12}>
            <Alert severity="warning" className="neutral bg-background-paper/60!">
              {t("content-not-found")}
            </Alert>
          </Grid>
        )}
        {error && (
          <Grid size={12}>
            <Alert severity="error" className="neutral bg-background-paper/60!">
              {error}
            </Alert>
          </Grid>
        )}

        {detail && (
          <>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Card component="section">
                <CardContent className="flex flex-col gap-4">
                  <span className="bg-primary/10 text-primary flex aspect-video items-center justify-center rounded-2xl">
                    <NiCamera size="large" />
                  </span>
                  <Box className="flex flex-row flex-wrap gap-1">
                    <Chip size="small" variant="outlined" label={t(`platform-${detail.content.platform}`)} />
                    {detail.content.format && (
                      <Chip size="small" variant="outlined" color="grey" label={detail.content.format} />
                    )}
                    {classification && (
                      <Chip
                        size="small"
                        variant="outlined"
                        color={classification.source === "user" ? "success" : "primary"}
                        label={
                          classification.source === "user"
                            ? t("classification-reviewed")
                            : t("classification-ai-suggestion")
                        }
                      />
                    )}
                  </Box>
                  <Typography variant="body1" className="leading-6 whitespace-pre-wrap">
                    {detail.content.caption || detail.content.description || t("content-no-caption")}
                  </Typography>
                  {detail.content.permalink_url && (
                    <Button
                      href={detail.content.permalink_url}
                      target="_blank"
                      rel="noreferrer"
                      variant="text"
                      color="grey"
                    >
                      {t("content-open-original")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, lg: 8 }} spacing={5} container>
              <Grid size={12}>
                <Card component="section">
                  <CardContent>
                    <Typography variant="h5" component="h2" className="card-title mb-4">
                      {t("metrics-title")}
                    </Typography>
                    <Box className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {(
                        [
                          "reach",
                          "views",
                          "likes",
                          "comments",
                          "shares",
                          "saves",
                          "link_clicks",
                          "profile_visits",
                        ] as const
                      ).map((key) => (
                        <Box key={key}>
                          <Typography variant="body2" className="text-text-secondary">
                            {t(`metric-${key.replaceAll("_", "-")}`)}
                          </Typography>
                          <Typography variant="h6">{metric(key)}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={12}>
                <ClassificationForm
                  key={classification?.id ?? "empty"}
                  orgId={currentOrg!.id}
                  productId={detail.product.id}
                  contentId={detail.content.id}
                  classificationId={classification?.id}
                  initial={initial}
                  onSaved={load}
                />
              </Grid>
            </Grid>
          </>
        )}
      </Grid>
    </Grid>
  );
}
