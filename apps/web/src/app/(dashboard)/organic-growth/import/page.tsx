"use client";

import { useOrganization } from "../../settings/organization/components/use-organization";
import OrganicGrowthHeader from "../components/organic-growth-header";
import CsvImportForm from "./components/csv-import-form";
import ImportHistory from "./components/import-history";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Grid, Skeleton } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import NiNetwork from "@/icons/nexture/ni-network";
import { createClient } from "@flyee/auth/client";

interface ProductOption {
  id: string;
  name: string;
}

interface AccountOption {
  id: string;
  platform: "instagram" | "tiktok" | "youtube" | "linkedin";
  displayName: string;
  handle: string | null;
}

export default function OrganicImportPage() {
  const t = useTranslations("organicGrowth");
  const { configured, loading, currentOrg } = useOrganization();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const supabase = createClient();
    const { data: scope } = await supabase
      .from("social_account_products")
      .select("social_account_id, product_id")
      .eq("org_id", currentOrg.id)
      .eq("is_primary", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!scope) {
      setProducts([]);
      setAccounts([]);
      setLoaded(true);
      return;
    }
    const [productResult, accountResult] = await Promise.all([
      supabase
        .from("products")
        .select("id, name")
        .eq("org_id", currentOrg.id)
        .eq("id", scope.product_id)
        .neq("status", "archived")
        .maybeSingle(),
      supabase
        .from("social_accounts")
        .select("id, platform, name, handle")
        .eq("org_id", currentOrg.id)
        .eq("id", scope.social_account_id)
        .eq("status", "active")
        .maybeSingle(),
    ]);
    setProducts(productResult.data ? [productResult.data as ProductOption] : []);
    setAccounts(
      accountResult.data
        ? [
            {
              id: accountResult.data.id,
              platform: accountResult.data.platform as AccountOption["platform"],
              displayName: accountResult.data.name || accountResult.data.handle || accountResult.data.id,
              handle: accountResult.data.handle,
            },
          ]
        : [],
    );
    setLoaded(true);
  }, [currentOrg]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <OrganicGrowthHeader title={t("import-title")} crumb={t("import-title")} />

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
        {currentOrg && loaded && (products.length === 0 || accounts.length === 0) && (
          <Grid size={12}>
            <EmptyState
              icon={<NiNetwork />}
              title={t("import-no-setup-title")}
              description={t("import-no-setup-description")}
              action={{ label: t("import-no-setup-action"), href: "/organic-growth/setup" }}
            />
          </Grid>
        )}
        {currentOrg && loaded && products.length > 0 && accounts.length > 0 && (
          <>
            <Grid size={12}>
              <CsvImportForm orgId={currentOrg.id} products={products} accounts={accounts} />
            </Grid>
            <Grid size={12}>
              <ImportHistory
                orgId={currentOrg.id}
                canDelete={currentOrg.role === "owner" || currentOrg.role === "admin"}
              />
            </Grid>
          </>
        )}
      </Grid>
    </Grid>
  );
}
