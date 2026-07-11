"use client";

import { useCallback, useEffect, useState } from "react";

import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

export type ProfileInfo = {
  userId: string | null;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  loading: boolean;
};

const EMPTY: ProfileInfo = { userId: null, displayName: "", email: "", avatarUrl: null, loading: true };

/**
 * The signed-in user's profile (profiles table + auth email) for chrome
 * like the header user menu. Returns empty fields (loading: false) when
 * Supabase is not configured or nobody is signed in.
 */
export function useProfile() {
  const [profile, setProfile] = useState<ProfileInfo>(EMPTY);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setProfile({ ...EMPTY, loading: false });
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfile({ ...EMPTY, loading: false });
      return;
    }
    const { data } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle();
    setProfile({
      userId: user.id,
      displayName: data?.display_name ?? user.email?.split("@")[0] ?? "",
      email: user.email ?? "",
      avatarUrl: data?.avatar_url ?? null,
      loading: false,
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...profile, refresh };
}
