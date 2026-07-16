"use client";

import { useOrganization } from "../../settings/organization/components/use-organization";
import OrganicGrowthHeader from "../components/organic-growth-header";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  MenuItem,
  Select,
  Skeleton,
  Typography,
} from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import NiCamera from "@/icons/nexture/ni-camera";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiPlus from "@/icons/nexture/ni-plus";
import { createClient } from "@flyee/auth/client";

interface ProductRow {
  id: string;
  name: string;
}

interface ContentRow {
  id: string;
  creative_id: string;
  platform: string;
  title: string | null;
  caption: string | null;
  format: string | null;
  permalink_url: string | null;
  published_at: string | null;
  funnelStage: string | null;
  theme: string | null;
  confidence: string | null;
  reviewed: boolean;
  reach: number | null;
  views: number | null;
  saves: number | null;
  shares: number | null;
  linkClicks: number | null;
}

export default function OrganicContentPage() {
  const t = useTranslations("organicGrowth");
  const { configured, loading, currentOrg } = useOrganization();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoaded(false);
    const supabase = createClient();
    const { data: scopeLinks } = await supabase
      .from("social_account_products")
      .select("product_id")
      .eq("org_id", currentOrg.id)
      .eq("is_primary", true);
    const scopedProductIds = [...new Set((scopeLinks ?? []).map((link) => link.product_id))];
    if (scopedProductIds.length === 0) {
      setProducts([]);
      setProductId("");
      setRows([]);
      setLoaded(true);
      return;
    }
    const { data: productRows } = await supabase
      .from("products")
      .select("id, name")
      .eq("org_id", currentOrg.id)
      .in("id", scopedProductIds)
      .neq("status", "archived")
      .order("updated_at", { ascending: false });
    const productList = (productRows as ProductRow[]) ?? [];
    const selectedProductId = productId || productList[0]?.id || "";
    setProducts(productList);
    setProductId(selectedProductId);

    if (!selectedProductId) {
      setRows([]);
      setLoaded(true);
      return;
    }

    const { data: links } = await supabase
      .from("organic_content_products")
      .select("content_id")
      .eq("org_id", currentOrg.id)
      .eq("product_id", selectedProductId);
    const contentIds = (links ?? []).map((link) => link.content_id);
    if (contentIds.length === 0) {
      setRows([]);
      setLoaded(true);
      return;
    }

    const [contentResult, classificationResult, metricResult] = await Promise.all([
      supabase
        .from("organic_content_items")
        .select("id, creative_id, platform, title, caption, format, permalink_url, published_at")
        .in("id", contentIds)
        .order("published_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("organic_content_classifications")
        .select("id, content_id, funnel_stage, theme, confidence, source, created_at")
        .in("content_id", contentIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("organic_content_metric_snapshots")
        .select("content_id, reach, views, saves, shares, link_clicks, captured_at")
        .in("content_id", contentIds)
        .order("captured_at", { ascending: false }),
    ]);

    const latestClassification = new Map<
      string,
      typeof classificationResult.data extends (infer T)[] | null ? T : never
    >();
    for (const classification of classificationResult.data ?? []) {
      const current = latestClassification.get(classification.content_id);
      if (!current || (classification.source === "user" && current.source !== "user")) {
        latestClassification.set(classification.content_id, classification);
      }
    }
    const latestMetric = new Map<string, typeof metricResult.data extends (infer T)[] | null ? T : never>();
    for (const metric of metricResult.data ?? []) {
      if (!latestMetric.has(metric.content_id)) latestMetric.set(metric.content_id, metric);
    }

    setRows(
      (contentResult.data ?? []).map((content) => {
        const classification = latestClassification.get(content.id);
        const metric = latestMetric.get(content.id);
        return {
          ...content,
          funnelStage: classification?.funnel_stage ?? null,
          theme: classification?.theme ?? null,
          confidence: classification?.confidence ?? null,
          reviewed: classification?.source === "user",
          reach: metric?.reach ?? null,
          views: metric?.views ?? null,
          saves: metric?.saves ?? null,
          shares: metric?.shares ?? null,
          linkClicks: metric?.link_clicks ?? null,
        };
      }),
    );
    setLoaded(true);
  }, [currentOrg, productId]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const result = new Map<string, ContentRow[]>();
    for (const row of rows) {
      const key = row.funnelStage ?? "unclassified";
      result.set(key, [...(result.get(key) ?? []), row]);
    }
    return [...result.entries()];
  }, [rows]);

  const number = (value: number | null) => (value == null ? "—" : value.toLocaleString());

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <OrganicGrowthHeader
          title={t("content-title")}
          crumb={t("content-title")}
          actions={
            <Box className="flex flex-row items-center gap-2">
              {products.length > 1 && (
                <FormControl className="outlined min-w-52" variant="standard" size="small">
                  <Select
                    value={productId}
                    variant="standard"
                    IconComponent={NiChevronDownSmall}
                    onChange={(event) => setProductId(event.target.value)}
                  >
                    {products.map((product) => (
                      <MenuItem key={product.id} value={product.id}>
                        {product.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <Button
                variant="contained"
                href="/organic-growth/import"
                LinkComponent={Link}
                startIcon={<NiPlus size="small" />}
              >
                {t("import-action")}
              </Button>
            </Box>
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
            <Skeleton variant="rounded" height={300} />
          </Grid>
        )}

        {currentOrg && loaded && rows.length === 0 && (
          <Grid size={12}>
            <EmptyState
              icon={<NiCamera />}
              title={t("content-empty-title")}
              description={t("content-empty-description")}
              action={{ label: t("import-action"), href: "/organic-growth/import" }}
            />
          </Grid>
        )}

        {rows.length > 0 &&
          groups.map(([stage, contents]) => (
            <Grid key={stage} size={12} spacing={2.5} container component="section">
              <Grid size={12}>
                <Box className="flex flex-row items-center gap-2">
                  <Typography variant="h5" component="h2">
                    {stage === "unclassified" ? t("classification-pending") : t(`funnel-${stage}`)}
                  </Typography>
                  <Chip size="small" variant="outlined" color="grey" label={contents.length} />
                </Box>
              </Grid>
              {contents.map((content) => (
                <Grid key={content.id} size={{ xs: 12, md: 6, xl: 4 }}>
                  <Card className="h-full" component="article">
                    <CardContent className="flex h-full flex-col gap-3">
                      <Box className="flex flex-row flex-wrap items-center gap-1.5">
                        <Chip size="small" variant="outlined" label={t(`platform-${content.platform}`)} />
                        {content.format && <Chip size="small" variant="outlined" color="grey" label={content.format} />}
                        <Chip
                          size="small"
                          variant="outlined"
                          color={content.reviewed ? "success" : "warning"}
                          label={content.reviewed ? t("classification-reviewed") : t("classification-pending")}
                        />
                      </Box>
                      <Typography variant="h6" component="h3" className="card-title line-clamp-2">
                        {content.title || content.caption || t("content-untitled")}
                      </Typography>
                      {content.theme && (
                        <Typography variant="body2" className="text-text-secondary">
                          {t("field-theme")}: {content.theme}
                        </Typography>
                      )}
                      <Box className="mt-auto grid grid-cols-3 gap-2 pt-2">
                        <Box>
                          <Typography variant="body2" className="text-text-secondary">
                            {t("metric-reach")}
                          </Typography>
                          <Typography variant="subtitle2">{number(content.reach ?? content.views)}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" className="text-text-secondary">
                            {t("metric-saves")}
                          </Typography>
                          <Typography variant="subtitle2">{number(content.saves)}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" className="text-text-secondary">
                            {t("metric-clicks")}
                          </Typography>
                          <Typography variant="subtitle2">{number(content.linkClicks)}</Typography>
                        </Box>
                      </Box>
                      <Button
                        variant={content.reviewed ? "text" : "outlined"}
                        color={content.reviewed ? "grey" : "primary"}
                        href={`/organic-growth/content/${content.id}`}
                        LinkComponent={Link}
                      >
                        {content.reviewed ? t("content-open") : t("classification-review-action")}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ))}
      </Grid>
    </Grid>
  );
}
