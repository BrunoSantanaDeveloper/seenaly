"use client";

import { useOrganization } from "../settings/organization/components/use-organization";
import FunnelBreakdown from "./components/funnel-breakdown";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  FormControl,
  Grid,
  MenuItem,
  Select,
  Skeleton,
  Typography,
} from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import LoadErrorState from "@/components/product/load-error-state";
import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiPlus from "@/icons/nexture/ni-plus";
import NiTag from "@/icons/nexture/ni-tag";
import { createClient } from "@flyee/auth/client";

/**
 * Job: "where in my funnel am I losing people?" Success: the drop-off between
 * visits → checkout → purchase is visible, and the numbers feed the diagnosis
 * engine so it can separate page / checkout / offer. The latest snapshot is
 * the screen (a breakdown, not a table); older ones are a quiet list beneath.
 */

type ProductRow = { id: string; name: string };
type SnapshotRow = {
  id: string;
  label: string | null;
  period_end: string | null;
  visits: number | null;
  checkout_initiated: number | null;
  purchases: number | null;
  refunds: number | null;
  net_revenue: number | null;
};

export function FunnelExperience({
  forcedProductId,
  workspace = false,
}: {
  forcedProductId?: string;
  workspace?: boolean;
} = {}) {
  const t = useTranslations("funnel");
  const tc = useTranslations("productCommon");
  const router = useRouter();
  const requestedProductId = useSearchParams().get("product");
  const { configured, loading, orgs, currentOrg } = useOrganization();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dataLoadError, setDataLoadError] = useState(false);

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

  const loadSnapshots = useCallback(async () => {
    if (!productId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("funnel_snapshots")
      .select("id, label, period_end, visits, checkout_initiated, purchases, refunds, net_revenue")
      .eq("product_id", productId)
      .order("period_end", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) {
      setDataLoadError(true);
      setLoaded(true);
      return;
    }
    setDataLoadError(false);
    setRows((data as SnapshotRow[]) ?? []);
    setLoaded(true);
  }, [productId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);
  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);
  useEffect(() => {
    if (!workspace && requestedProductId) router.replace(`/products/${requestedProductId}/funnel`);
  }, [requestedProductId, router, workspace]);

  const hasProduct = Boolean(productId);
  const isEmpty = hasProduct && loaded && rows.length === 0;
  const latest = rows[0];
  const history = rows.slice(1);
  const money = (v: number | null) => (v == null ? "—" : v.toLocaleString());

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
                  onClick={() => router.push(`/funnel/new?product=${productId}`)}
                >
                  {t("new-snapshot")}
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
                loadSnapshots();
              }}
            />
          </Grid>
        )}

        {currentOrg && !dataLoadError && !loaded && (
          <Grid size={12}>
            <Skeleton variant="rounded" height={240} />
          </Grid>
        )}

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

        {!dataLoadError && isEmpty && (
          <Grid size={12}>
            <EmptyState
              icon={<NiChartFunnel />}
              title={t("empty-title")}
              description={t("empty-body")}
              action={{ label: t("empty-cta"), href: `/funnel/new?product=${productId}` }}
            />
          </Grid>
        )}

        {latest && (
          <Grid size={12}>
            <Box className="mb-3 flex flex-row items-center gap-2">
              <Typography variant="h5" component="h2" className="grow">
                {latest.label || t("latest")}
              </Typography>
              <Button variant="text" color="grey" LinkComponent={Link} href={`/funnel/${latest.id}`}>
                {t("edit")}
              </Button>
            </Box>
            <FunnelBreakdown
              counts={{
                visits: latest.visits,
                checkout_initiated: latest.checkout_initiated,
                purchases: latest.purchases,
                refunds: latest.refunds,
                net_revenue: latest.net_revenue,
              }}
              labels={{
                visits: t("field-visits"),
                checkout: t("field-checkoutInitiated"),
                purchases: t("field-purchases"),
                ofPrevious: t("of-previous"),
                refundRate: t("refund-rate"),
                noData: t("no-data"),
              }}
            />
          </Grid>
        )}

        {history.length > 0 && (
          <Grid size={12}>
            <Typography variant="h5" component="h2" className="mb-3">
              {t("history-title")}
            </Typography>
            <Box className="flex flex-col gap-2">
              {history.map((row) => (
                <Link key={row.id} href={`/funnel/${row.id}`} className="no-underline">
                  <Box className="border-grey-50 hover:bg-grey-25 flex flex-row items-center gap-3 rounded-2xl border-b px-3 py-2">
                    <Typography variant="subtitle2" className="grow truncate">
                      {row.label || row.period_end || t("latest")}
                    </Typography>
                    <Chip
                      label={`${t("field-purchases")}: ${row.purchases ?? "—"}`}
                      size="small"
                      variant="outlined"
                      color="grey"
                    />
                    <Typography variant="body2" className="text-text-secondary hidden sm:block">
                      {t("field-netRevenue")}: {money(row.net_revenue)}
                    </Typography>
                  </Box>
                </Link>
              ))}
            </Box>
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}

export default function FunnelPage() {
  return <FunnelExperience />;
}
