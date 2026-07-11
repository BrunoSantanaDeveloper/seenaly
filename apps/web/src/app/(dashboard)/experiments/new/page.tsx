"use client";

import { useOrganization } from "../../settings/organization/components/use-organization";
import ExperimentForm from "../components/experiment-form";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Alert, Breadcrumbs, Grid, Typography } from "@mui/material";

import { createClient } from "@flyee/auth/client";

export default function NewExperimentPage() {
  const t = useTranslations("experiments");
  const productId = useSearchParams().get("product");
  const { configured, currentOrg } = useOrganization();
  const [productName, setProductName] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    const supabase = createClient();
    supabase
      .from("products")
      .select("name")
      .eq("id", productId)
      .maybeSingle()
      .then(({ data }) => setProductName((data?.name as string) ?? null));
  }, [productId]);

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <Grid size={12}>
          <Typography variant="h1" component="h1" className="mb-0">
            {t("new-experiment")}
          </Typography>
          <Breadcrumbs>
            <Link color="inherit" href="/home">
              {t("crumb-home")}
            </Link>
            <Link color="inherit" href="/experiments">
              {t("title")}
            </Link>
            {productName && <Typography variant="body2">{productName}</Typography>}
          </Breadcrumbs>
        </Grid>

        {(!configured || !currentOrg || !productId) && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("pick-product")}
            </Alert>
          </Grid>
        )}

        {configured && currentOrg && productId && (
          <Grid size={12}>
            <ExperimentForm orgId={currentOrg.id} productId={productId} />
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}
