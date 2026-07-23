"use client";

import { useOrganization } from "../settings/organization/components/use-organization";
import CreativesBoard, { type CreativeCard } from "./components/creatives-board";
import type { CreativeStatus } from "./types";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

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
import NiCamera from "@/icons/nexture/ni-camera";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiPlus from "@/icons/nexture/ni-plus";
import NiTag from "@/icons/nexture/ni-tag";
import { isCreativeFormat } from "@/lib/creative-taxonomy";
import { createClient } from "@flyee/auth/client";

/**
 * Job: "what should I make/test next, and why did the winners win?" Success:
 * a tagged library where patterns are visible. Grouped by test lifecycle, not
 * a management table. Zero data → an EmptyState that invites the first brief;
 * no product yet → nudge to product context (creatives hang off a product).
 */

type ProductRow = { id: string; name: string };

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

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);
  useEffect(() => {
    loadCreatives();
  }, [loadCreatives]);
  useEffect(() => {
    if (!workspace && requestedProductId) router.replace(`/products/${requestedProductId}/creatives`);
  }, [requestedProductId, router, workspace]);

  const hasProduct = Boolean(productId);
  const isEmpty = hasProduct && loaded && rows.length === 0;

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

        {/* Product exists, no creatives: invite the first tagged brief. */}
        {!dataLoadError && isEmpty && (
          <Grid size={12}>
            <EmptyState
              icon={<NiCamera />}
              title={t("empty-title")}
              description={t("empty-body")}
              action={{ label: t("empty-cta"), href: `/creatives/new?product=${productId}` }}
            />
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
    </Grid>
  );
}

export default function CreativesPage() {
  return <CreativesExperience />;
}
