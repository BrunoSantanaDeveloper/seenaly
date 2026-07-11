import { notFound, redirect } from "next/navigation";

import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/server";

/**
 * Server-side gate for every /admin console. RLS remains the real
 * defense (non-superadmins get empty reads and rejected writes);
 * this stops the consoles from even rendering for them.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // A fresh clone without Supabase env stays browsable; each console
  // shows its own configuration hint.
  if (!isSupabaseConfigured) return children;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const { data } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle();
  if (!data?.is_superadmin) notFound();

  return children;
}
