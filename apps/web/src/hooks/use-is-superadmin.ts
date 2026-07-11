"use client";

import { useEffect, useState } from "react";

import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

/**
 * Whether the signed-in user is a platform superadmin. Client-side
 * convenience only (menu visibility etc.); RLS and the /admin layout
 * gate remain the real defenses.
 */
export function useIsSuperadmin() {
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    const check = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle();
      if (!cancelled) setIsSuperadmin(Boolean(data?.is_superadmin));
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return isSuperadmin;
}
