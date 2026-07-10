"use client";

import { useOrganization } from "../../settings/organization/components/use-organization";
import CreativeForm from "../components/creative-form";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Alert, Breadcrumbs, Grid, Typography } from "@mui/material";

import { createClient } from "@flyee/auth/client";

/** New creative for a product (product id passed via ?product=, verified by RLS on save). */
export default function NewCreativePage() {
  const t = useTranslations("creatives");
  const params = useSearchParams();
  const productId = params.get("product");
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
            {t("new-creative")}
          </Typography>
          <Breadcrumbs>
            <Link color="inherit" href="/home">
              {t("crumb-home")}
            </Link>
            <Link color="inherit" href="/creatives">
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
            <CreativeForm orgId={currentOrg.id} productId={productId} />
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}
