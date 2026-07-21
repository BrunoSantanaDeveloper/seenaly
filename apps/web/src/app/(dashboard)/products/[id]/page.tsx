"use client";

import { deleteProduct } from "../actions";
import ProductNextStepCard from "../components/next-step-card";
import ProductForm from "../components/product-form";
import ProductsHeader from "../components/products-header";
import { computeCompleteness } from "../lib/completeness";
import { mapProductRow } from "../lib/map";
import type { ProductWithChildren } from "../types";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Grid } from "@mui/material";

import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import { createClient } from "@flyee/auth/client";

export default function EditProductPage() {
  const t = useTranslations("products");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [product, setProduct] = useState<ProductWithChildren | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: row }, { data: objections }, { data: proofs }, { data: plans }] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).maybeSingle(),
      supabase.from("product_objections").select("content").eq("product_id", id).order("created_at"),
      supabase.from("product_proofs").select("kind, content").eq("product_id", id).order("created_at"),
      supabase
        .from("product_plans")
        .select("name, price, period, quantity, share_pct, is_primary, sort")
        .eq("product_id", id)
        .order("sort"),
    ]);
    if (!row) {
      setNotFound(true);
      return;
    }
    setProduct(mapProductRow(row, { objections: objections ?? [], proofs: proofs ?? [], plans: plans ?? [] }));
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

  const completeness = product ? computeCompleteness(product) : null;

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
          <>
            {/* "What now?" leads; editing the context is secondary. */}
            <Grid size={12}>
              <ProductNextStepCard productId={product.id} ready={completeness!.ready} missing={completeness!.missing} />
            </Grid>
            <Grid size={12}>
              <Box>
                <ProductForm orgId={product.orgId} product={product} />
              </Box>
            </Grid>
          </>
        )}
      </Grid>
    </Grid>
  );
}
