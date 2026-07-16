"use client";

import { useOrganization } from "../settings/organization/components/use-organization";
import OrganicGrowthHeader from "./components/organic-growth-header";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Grid, Skeleton, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import NiChartLineBar from "@/icons/nexture/ni-chart-line-bar";
import { createClient } from "@flyee/auth/client";

/** Keeps every Organic Growth route behind the same billing entitlement. */
export default function OrganicGrowthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("organicGrowth");
  const { configured, loading, currentOrg } = useOrganization();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setAllowed(null);
    setFailed(false);
    const { data, error } = await createClient().rpc("org_entitlements", { target_org: currentOrg.id });
    if (error) {
      setFailed(true);
      return;
    }
    const entitlement = data as { active?: boolean; limits?: Record<string, unknown> } | null;
    setAllowed(Boolean(entitlement?.active && entitlement.limits?.organic_growth === true));
  }, [currentOrg]);

  useEffect(() => {
    load();
  }, [load]);

  if (!configured || (!loading && !currentOrg)) return children;

  if (loading || (currentOrg && allowed === null && !failed)) {
    return (
      <Grid container spacing={5}>
        <Grid size={12}>
          <Skeleton variant="rounded" height={180} />
        </Grid>
        <Grid size={12}>
          <Skeleton variant="rounded" height={320} />
        </Grid>
      </Grid>
    );
  }

  if (failed) {
    return (
      <Grid container spacing={5}>
        <OrganicGrowthHeader title={t("title")} />
        <Grid size={12}>
          <Alert severity="error" className="neutral bg-background-paper/60!">
            <Typography variant="subtitle2">{t("error-title")}</Typography>
            <Typography variant="body2">{t("error-body")}</Typography>
          </Alert>
        </Grid>
      </Grid>
    );
  }

  if (!allowed) {
    return (
      <Grid container spacing={5}>
        <OrganicGrowthHeader title={t("title")} />
        <Grid size={12}>
          <EmptyState
            icon={<NiChartLineBar />}
            title={t("entitlement-title")}
            description={t("entitlement-body")}
            action={{ label: t("entitlement-cta"), href: "/settings/billing" }}
          />
        </Grid>
      </Grid>
    );
  }

  return children;
}
