"use client";

import { deleteProduct } from "../actions";
import ProductNextStepCard from "../components/next-step-card";
import ProductForm from "../components/product-form";
import ProductsHeader from "../components/products-header";
import StartHereCard from "../components/start-here-card";
import { COMPLETENESS_FIELDS, type CompletenessField, computeCompleteness } from "../lib/completeness";
import { mapProductRow } from "../lib/map";
import type { ProductWithChildren } from "../types";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Alert, Box, Button, Grid, Skeleton } from "@mui/material";

import ConfirmActionDialog from "@/components/product/confirm-action-dialog";
import LoadErrorState from "@/components/product/load-error-state";
import { useOptionalProductWorkspace } from "@/components/product-workspace/product-workspace";
import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import { createClient } from "@flyee/auth/client";

export default function EditProductPage() {
  const t = useTranslations("products");
  const tc = useTranslations("productCommon");
  const router = useRouter();
  const workspace = useOptionalProductWorkspace();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [product, setProduct] = useState<ProductWithChildren | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Drives which next action leads: readiness precedes the campaign diagnosis.
  const [hasReadiness, setHasReadiness] = useState(false);
  const [hasCreativeEvidence, setHasCreativeEvidence] = useState(false);
  const [hasLaunchPlan, setHasLaunchPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // A suggestion on the next-step card points at a field of the form below —
  // clicking it opens the right section and scrolls there. The nonce lets the
  // same field be requested again after the user scrolls away.
  const [focusField, setFocusField] = useState<{ field: CompletenessField; nonce: number } | null>(null);

  // The same jump, exposed as a URL: /products/<id>?focus=<field> opens the
  // owning section and scrolls there (the readiness blockers link here — the
  // "no page / no price" dead end gets a door). One-shot on mount; an invalid
  // value is silently ignored, never a crash on a crafted URL.
  const searchParams = useSearchParams();
  // Set by the create form for a first product — the one moment the
  // "comece por aqui" handoff replaces the returning-user card.
  const justStarted = searchParams.get("started") === "1";
  const focusParamConsumedRef = useRef(false);
  useEffect(() => {
    if (focusParamConsumedRef.current || loading || !product) return;
    focusParamConsumedRef.current = true;
    const requested = searchParams.get("focus");
    if (requested && (COMPLETENESS_FIELDS as readonly string[]).includes(requested)) {
      setFocusField({ field: requested as CompletenessField, nonce: 1 });
    }
  }, [loading, product, searchParams]);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [
      { data: row, error: productError },
      { data: objections, error: objectionsError },
      { data: proofs, error: proofsError },
      { data: plans, error: plansError },
      { count: readinessCount, error: readinessError },
      { count: creativePlanCount, error: creativePlanError },
      { count: creativeCount, error: creativesError },
      { count: launchPlanCount, error: launchPlanError },
    ] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).maybeSingle(),
      supabase.from("product_objections").select("content").eq("product_id", id).order("created_at"),
      supabase.from("product_proofs").select("kind, content").eq("product_id", id).order("created_at"),
      supabase
        .from("product_plans")
        .select("name, price, period, quantity, share_pct, is_primary, sort")
        .eq("product_id", id)
        .order("sort"),
      supabase
        .from("diagnoses")
        .select("id", { count: "exact", head: true })
        .eq("product_id", id)
        .eq("scope", "readiness"),
      supabase
        .from("diagnoses")
        .select("id", { count: "exact", head: true })
        .eq("product_id", id)
        .eq("scope", "creative_plan"),
      supabase.from("creatives").select("id", { count: "exact", head: true }).eq("product_id", id),
      supabase
        .from("diagnoses")
        .select("id", { count: "exact", head: true })
        .eq("product_id", id)
        .eq("scope", "launch_plan"),
    ]);
    if (
      productError ||
      objectionsError ||
      proofsError ||
      plansError ||
      readinessError ||
      creativePlanError ||
      creativesError ||
      launchPlanError
    ) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    if (!row) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoadError(false);
    setHasReadiness((readinessCount ?? 0) > 0);
    setHasCreativeEvidence((creativePlanCount ?? 0) > 0 || (creativeCount ?? 0) > 0);
    setHasLaunchPlan((launchPlanCount ?? 0) > 0);
    setProduct(mapProductRow(row, { objections: objections ?? [], proofs: proofs ?? [], plans: plans ?? [] }));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    setDeleting(true);
    const result = await deleteProduct(id);
    if (result.ok) {
      router.push("/products");
      router.refresh();
      return;
    }
    setDeleting(false);
  };

  const completeness = product ? computeCompleteness(product) : null;

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        {!workspace && (
          <ProductsHeader
            title={product?.name || t("title")}
            crumb={t("title")}
            action={
              product && (
                <Button
                  variant="outlined"
                  color="grey"
                  startIcon={<NiBinEmpty size="small" />}
                  onClick={() => setDeleteOpen(true)}
                >
                  {t("delete")}
                </Button>
              )
            }
          />
        )}

        {workspace && product && (
          <Grid size={12} className="flex justify-end">
            <Button
              variant="outlined"
              color="grey"
              startIcon={<NiBinEmpty size="small" />}
              onClick={() => setDeleteOpen(true)}
            >
              {t("delete")}
            </Button>
          </Grid>
        )}

        {loading && (
          <Grid size={12}>
            <Skeleton variant="rounded" height={320} />
          </Grid>
        )}

        {loadError && (
          <Grid size={12}>
            <LoadErrorState
              title={tc("load-error-title")}
              description={tc("load-error-body")}
              retryLabel={tc("retry")}
              onRetry={load}
            />
          </Grid>
        )}

        {notFound && (
          <Grid size={12}>
            <Alert severity="warning" className="neutral bg-background-paper/60!">
              {t("not-found")}
            </Alert>
          </Grid>
        )}

        {product && (
          <>
            {/* Straight off the create form (first product only): the honest
                handoff into readiness replaces the generic next-step card,
                which would otherwise say the same thing with less context. */}
            {justStarted ? (
              <Grid size={12}>
                <StartHereCard readinessHref={`/products/${product.id}/readiness?new=1`} />
              </Grid>
            ) : (
              /* "What now?" leads; editing the context is secondary. */
              <Grid size={12}>
                <ProductNextStepCard
                  productId={product.id}
                  ready={completeness!.ready}
                  missing={completeness!.missing}
                  hasReadiness={hasReadiness}
                  hasCreativeEvidence={hasCreativeEvidence}
                  hasLaunchPlan={hasLaunchPlan}
                  onFieldClick={(field) => setFocusField((prev) => ({ field, nonce: (prev?.nonce ?? 0) + 1 }))}
                />
              </Grid>
            )}
            <Grid size={12}>
              <Box>
                <ProductForm orgId={product.orgId} product={product} focusField={focusField} />
              </Box>
            </Grid>
          </>
        )}
      </Grid>
      <ConfirmActionDialog
        open={deleteOpen}
        title={tc("delete-confirm-title")}
        description={tc("delete-confirm-body", { name: product?.name ?? "" })}
        confirmLabel={tc("delete-confirm")}
        cancelLabel={tc("cancel")}
        busy={deleting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
      />
    </Grid>
  );
}
