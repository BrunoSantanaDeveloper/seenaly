"use client";

import { useOrganization } from "../../settings/organization/components/use-organization";
import ProductForm from "../components/product-form";
import ProductsHeader from "../components/products-header";
import { useTranslations } from "next-intl";

import { Alert, Grid } from "@mui/material";

export default function NewProductPage() {
  const t = useTranslations("products");
  const { configured, loading, currentOrg } = useOrganization();

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <ProductsHeader title={t("new-product")} crumb={t("title")} />

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

        {currentOrg && (
          <Grid size={12}>
            {/* First-run capture: progressive disclosure, not a wall of fields. */}
            <ProductForm orgId={currentOrg.id} variant="wizard" />
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}
