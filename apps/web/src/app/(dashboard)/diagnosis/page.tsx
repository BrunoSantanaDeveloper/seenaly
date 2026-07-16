"use client";

import { registerExperimentFromDiagnosis } from "../experiments/actions";
import { useOrganization } from "../settings/organization/components/use-organization";
import { generateDiagnosis } from "./actions";
import DiagnosisCard, { type DiagnosisMeta } from "./components/diagnosis-card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Breadcrumbs, Button, Grid, MenuItem, Skeleton, TextField, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import NiFlask from "@/icons/nexture/ni-flask";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiSparkle from "@/icons/nexture/ni-sparkle";
import NiTag from "@/icons/nexture/ni-tag";
import type { DiagnosisOutput } from "@/lib/diagnosis/schema";
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

type ProductRow = { id: string; name: string };

export default function DiagnosisPage() {
  const t = useTranslations("diagnosis");
  const td = useTranslations("dashboard");
  const router = useRouter();
  const { configured, loading, loadError, orgs, currentOrg } = useOrganization();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [rows, setRows] = useState<DiagnosisRow[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const product = products.find((p) => p.id === selectedProductId) ?? null;
  const ready = productsLoaded && loaded;

  // The org's products drive the selector; the most recently updated is the
  // default so a single-product user never has to choose.
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
    setSelectedProductId((prev) => (prev && list.some((p) => p.id === prev) ? prev : (list[0]?.id ?? null)));
    setProductsLoaded(true);
  }, [currentOrg]);

  const loadDiagnoses = useCallback(async () => {
    if (!selectedProductId) {
      setRows([]);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    const supabase = createClient();
    const { data } = await supabase
      .from("diagnoses")
      .select("id, output, created_at, had_campaign_data, knowledge_refs")
      .eq("product_id", selectedProductId)
      .order("created_at", { ascending: false })
      .limit(10);
    setRows((data as DiagnosisRow[]) ?? []);
    setLoaded(true);
  }, [selectedProductId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadDiagnoses();
  }, [loadDiagnoses]);

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
      await loadDiagnoses();
    } finally {
      setBusy(false);
    }
  };

  const latest = rows[0];
  const history = rows.slice(1);

  const generateButton = (
    <Button variant="contained" startIcon={<NiSparkle size="small" />} onClick={generate} disabled={busy || !product}>
      {busy ? t("generating") : t("generate")}
    </Button>
  );

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
          {products.length > 1 && ready && (
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

        {configured && !loading && !loadError && orgs.length === 0 && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("no-org")}
            </Alert>
          </Grid>
        )}

        {/* Hold the space while memberships or diagnoses resolve — never blank. */}
        {configured && (loading || (currentOrg && !ready)) && (
          <Grid size={12}>
            <Skeleton variant="rounded" height={280} />
          </Grid>
        )}

        {/* No product context yet: the diagnosis has nothing to reason with. */}
        {currentOrg && ready && !product && (
          <Grid size={12}>
            <EmptyState
              icon={<NiTag />}
              title={t("no-product-title")}
              description={t("no-product-body")}
              action={{ label: t("no-product-cta"), href: "/products/new" }}
            />
          </Grid>
        )}

        {/* Context exists, no diagnosis yet: the ONE action is to generate it. */}
        {currentOrg && ready && product && rows.length === 0 && (
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
                  if (result.ok) router.push(`/experiments/${result.id}`);
                  else setError(result.error);
                }}
              >
                {registering ? t("registering-experiment") : t("register-experiment")}
              </Button>
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
