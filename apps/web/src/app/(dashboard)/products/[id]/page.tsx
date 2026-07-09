"use client";

import { deleteProduct } from "../actions";
import ProductForm from "../components/product-form";
import ProductsHeader from "../components/products-header";
import type { ProductWithChildren } from "../types";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Grid } from "@mui/material";

import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import { createClient } from "@flyee/auth/client";

const n = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

export default function EditProductPage() {
  const t = useTranslations("products");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [product, setProduct] = useState<ProductWithChildren | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: row }, { data: objections }, { data: proofs }] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).maybeSingle(),
      supabase.from("product_objections").select("content").eq("product_id", id).order("created_at"),
      supabase.from("product_proofs").select("kind, content").eq("product_id", id).order("created_at"),
    ]);
    if (!row) {
      setNotFound(true);
      return;
    }
    setProduct({
      id: row.id,
      orgId: row.org_id,
      name: row.name ?? "",
      status: row.status,
      description: row.description ?? "",
      currency: row.currency ?? "",
      price: n(row.price),
      unitCost: n(row.unit_cost),
      marginPct: n(row.margin_pct),
      avgTicket: n(row.avg_ticket),
      ltv: n(row.ltv),
      targetCac: n(row.target_cac),
      monthlyBudget: n(row.monthly_budget),
      conversionType: row.conversion_type ?? "",
      funnelStage: row.funnel_stage ?? "",
      audience: row.audience ?? "",
      mainPromise: row.main_promise ?? "",
      landingPageUrl: row.landing_page_url ?? "",
      landingConversionRate: n(row.landing_conversion_rate),
      optimizationEvent: row.optimization_event ?? "",
      notes: row.notes ?? "",
      connectionId: row.connection_id ?? null,
      metaAccountId: row.meta_account_id ?? "",
      objections: (objections ?? []).map((item) => item.content as string),
      proofs: (proofs ?? []).map((item) => ({ kind: (item.kind as string) ?? "", content: item.content as string })),
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    const result = await deleteProduct(id);
    if (result.ok) {
      router.push("/products");
      router.refresh();
    }
  };

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <ProductsHeader
          title={product?.name || t("title")}
          crumb={t("title")}
          action={
            product && (
              <Button variant="outlined" color="grey" startIcon={<NiBinEmpty size="small" />} onClick={remove}>
                {t("delete")}
              </Button>
            )
          }
        />

        {notFound && (
          <Grid size={12}>
            <Alert severity="warning" className="neutral bg-background-paper/60!">
              {t("not-found")}
            </Alert>
          </Grid>
        )}

        {product && (
          <Grid size={12}>
            <Box>
              <ProductForm orgId={product.orgId} product={product} />
            </Box>
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}
