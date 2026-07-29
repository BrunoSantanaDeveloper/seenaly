import { notFound } from "next/navigation";

import ProductWorkspace from "@/components/product-workspace/product-workspace";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/server";

/** PostgREST returns `numeric` as a string; null/invalid stays null so the rail hides the row. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured) return children;

  const { id } = await params;
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id, org_id, name, status, main_promise, audience, connection_id, currency, avg_ticket, margin_pct, target_cac, monthly_budget",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !product) notFound();

  const [
    { data: products, error: productsError },
    { count: readiness, error: readinessError },
    { count: creativePlans, error: creativePlansError },
    { count: creatives, error: creativesError },
    { data: diagnoses, error: diagnosisError },
    { data: experiments, error: experimentsError },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, org_id, name, status")
      .eq("org_id", product.org_id)
      .order("updated_at", { ascending: false }),
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
    supabase.from("diagnoses").select("id").eq("product_id", id).in("scope", ["product", "campaign"]),
    supabase.from("experiments").select("diagnosis_id").eq("product_id", id).not("diagnosis_id", "is", null),
  ]);

  let hasData = false;
  let dataError = null;
  if (product.connection_id) {
    const [connectionResult, insightsResult] = await Promise.all([
      supabase
        .from("connections")
        .select("status, last_synced_at")
        .eq("id", product.connection_id)
        .eq("provider", "meta-ads")
        .maybeSingle(),
      supabase
        .from("meta_insights_daily")
        .select("id", { count: "exact", head: true })
        .eq("connection_id", product.connection_id),
    ]);
    hasData =
      connectionResult.data?.status === "connected" &&
      Boolean(connectionResult.data.last_synced_at) &&
      (insightsResult.count ?? 0) > 0;
    dataError = connectionResult.error || insightsResult.error;
  }

  const paidDiagnosisIds = new Set((diagnoses ?? []).map((diagnosis) => diagnosis.id));

  return (
    <ProductWorkspace
      product={{ id: product.id, orgId: product.org_id, name: product.name, status: product.status }}
      products={(products ?? []).map((item) => ({
        id: item.id,
        orgId: item.org_id,
        name: item.name,
        status: item.status,
      }))}
      progress={{
        hasContext: Boolean(product.main_promise && product.audience),
        hasReadiness: (readiness ?? 0) > 0,
        hasCreativeEvidence: (creativePlans ?? 0) > 0 || (creatives ?? 0) > 0,
        hasDiagnosis: paidDiagnosisIds.size > 0,
        hasExperiment: (experiments ?? []).some(
          (experiment) => experiment.diagnosis_id && paidDiagnosisIds.has(experiment.diagnosis_id),
        ),
        hasData,
      }}
      /* numeric columns arrive as strings from PostgREST — coerce once here. */
      economics={{
        currency: product.currency,
        avgTicket: toNumber(product.avg_ticket),
        marginPct: toNumber(product.margin_pct),
        targetCac: toNumber(product.target_cac),
        monthlyBudget: toNumber(product.monthly_budget),
      }}
      loadError={Boolean(
        productsError ||
          readinessError ||
          creativePlansError ||
          creativesError ||
          diagnosisError ||
          experimentsError ||
          dataError,
      )}
    >
      {children}
    </ProductWorkspace>
  );
}
