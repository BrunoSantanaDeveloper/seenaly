"use client";

import { useOrganization } from "../../settings/organization/components/use-organization";
import OrganicGrowthHeader from "../components/organic-growth-header";
import OrganicSetupForm from "./components/setup-form";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Grid, Skeleton } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import NiTag from "@/icons/nexture/ni-tag";
import { createClient } from "@flyee/auth/client";

interface ProductOption {
  id: string;
  name: string;
  audience: string | null;
  mainPromise: string | null;
}

export default function OrganicGrowthSetupPage() {
  const t = useTranslations("organicGrowth");
  const { configured, loading, currentOrg } = useOrganization();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const { data } = await createClient()
      .from("products")
      .select("id, name, audience, main_promise")
      .eq("org_id", currentOrg.id)
      .neq("status", "archived")
      .order("updated_at", { ascending: false });
    setProducts(
      (data ?? []).map((product) => ({
        id: product.id,
        name: product.name,
        audience: product.audience,
        mainPromise: product.main_promise,
      })),
    );
    setLoaded(true);
  }, [currentOrg]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <OrganicGrowthHeader title={t("setup-title")} crumb={t("setup-title")} />

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
            <Skeleton variant="rounded" height={360} />
          </Grid>
        )}

        {currentOrg && loaded && products.length === 0 && (
          <Grid size={12}>
            <EmptyState
              icon={<NiTag />}
              title={t("no-product-title")}
              description={t("no-product-description")}
              action={{ label: t("no-product-action"), href: "/products/new" }}
            />
          </Grid>
        )}

        {currentOrg && loaded && products.length > 0 && (
          <Grid size={12}>
            <OrganicSetupForm orgId={currentOrg.id} products={products} />
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}
