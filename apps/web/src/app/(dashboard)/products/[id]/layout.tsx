import { notFound } from "next/navigation";

import ProductWorkspace from "@/components/product-workspace/product-workspace";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/server";

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
    .select("id, org_id, name, status, connection_id, meta_account_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !product) notFound();

  const [
    { data: products, error: productsError },
    { count: readiness, error: readinessError },
    { count: diagnosis, error: diagnosisError },
    { count: experiments, error: experimentsError },
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
      .neq("scope", "readiness"),
    supabase.from("experiments").select("id", { count: "exact", head: true }).eq("product_id", id),
  ]);

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
        hasReadiness: (readiness ?? 0) > 0,
        hasDiagnosis: (diagnosis ?? 0) > 0,
        hasExperiment: (experiments ?? 0) > 0,
        hasData: Boolean(product.connection_id || product.meta_account_id),
      }}
      loadError={Boolean(productsError || readinessError || diagnosisError || experimentsError)}
    >
      {children}
    </ProductWorkspace>
  );
}
