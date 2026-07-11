"use client";

import { useOrganization } from "../settings/organization/components/use-organization";
import ExperimentJournal, { type ExperimentCard } from "./components/experiment-journal";
import type { ExperimentStatus } from "./types";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiFlask from "@/icons/nexture/ni-flask";
import NiPlus from "@/icons/nexture/ni-plus";
import NiTag from "@/icons/nexture/ni-tag";
import { createClient } from "@flyee/auth/client";

/**
 * Job: "what have I tried, what did I learn, and what's next?" Success: a
 * journal where each test's learning is recorded and reusable — the memory
 * that turns the copilot into an expert on THIS account. Not a table.
 */

type ProductRow = { id: string; name: string };

export default function ExperimentsPage() {
  const t = useTranslations("experiments");
  const router = useRouter();
  const { configured, loading, orgs, currentOrg } = useOrganization();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [rows, setRows] = useState<ExperimentCard[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!currentOrg) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .eq("org_id", currentOrg.id)
      .order("updated_at", { ascending: false });
    const list = (data as ProductRow[]) ?? [];
    setProducts(list);
    setProductId((current) => current ?? list[0]?.id ?? null);
    if (list.length === 0) setLoaded(true);
  }, [currentOrg]);

  const loadExperiments = useCallback(async () => {
    if (!productId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("experiments")
      .select("id, title, status, hypothesis, result, conclusion")
      .eq("product_id", productId)
      .order("updated_at", { ascending: false });
    setRows(
      (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status as ExperimentStatus,
        hypothesis: row.hypothesis,
        result: row.result,
        conclusion: row.conclusion,
      })),
    );
    setLoaded(true);
  }, [productId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);
  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  const hasProduct = Boolean(productId);
  const isEmpty = hasProduct && loaded && rows.length === 0;

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <Grid size={12} spacing={2.5} container className="items-center">
          <Grid size={{ xs: 12, md: "grow" }}>
            <Typography variant="h1" component="h1" className="mb-0">
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
              {products.length > 1 && productId && (
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
                  onClick={() => router.push(`/experiments/new?product=${productId}`)}
                >
                  {t("new-experiment")}
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

        {currentOrg && !loaded && (
          <Grid size={12}>
            <Skeleton variant="rounded" height={200} />
          </Grid>
        )}

        {currentOrg && loaded && products.length === 0 && (
          <Grid size={12}>
            <EmptyState
              icon={<NiTag />}
              title={t("no-product-title")}
              description={t("no-product-body")}
              action={{ label: t("no-product-cta"), href: "/products/new" }}
            />
          </Grid>
        )}

        {isEmpty && (
          <Grid size={12}>
            <EmptyState
              icon={<NiFlask />}
              title={t("empty-title")}
              description={t("empty-body")}
              action={{ label: t("empty-cta"), href: `/experiments/new?product=${productId}` }}
              secondaryAction={{ label: t("empty-secondary"), href: "/diagnosis" }}
            />
          </Grid>
        )}

        {hasProduct && loaded && rows.length > 0 && (
          <ExperimentJournal
            experiments={rows}
            columnLabel={(status) => t(`status-${status}`)}
            labels={{ hypothesis: t("field-hypothesis"), result: t("field-result"), conclusion: t("field-conclusion") }}
          />
        )}
      </Grid>
    </Grid>
  );
}
