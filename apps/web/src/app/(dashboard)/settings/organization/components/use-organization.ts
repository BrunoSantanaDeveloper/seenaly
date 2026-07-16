"use client";

import { useCallback, useEffect, useState } from "react";

import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

export type OrgRole = "owner" | "admin" | "member";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
}

export interface OrgMember {
  membershipId: string;
  userId: string;
  role: OrgRole;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface OrgInvite {
  id: string;
  email: string;
  role: OrgRole;
  token: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Loads the current user's organizations and, for the selected one, its
 * members and pending invites. All queries run through the browser Supabase
 * client, so RLS is the gatekeeper: members see the roster, only
 * owners/admins see invites (others silently get an empty list).
 */
export function useOrganization() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);

  const refreshOrgs = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    // A network failure must surface as an ERROR, never as an eternal blank
    // screen or a fake "no organization" state.
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data, error } = await supabase
        .from("memberships")
        .select("role, organizations(id, name, slug)")
        .eq("user_id", user.id)
        .order("created_at");
      if (error) throw error;

      const list: OrgSummary[] = (data ?? [])
        .filter((row) => row.organizations)
        .map((row) => {
          const org = row.organizations as unknown as { id: string; name: string; slug: string };
          return { id: org.id, name: org.name, slug: org.slug, role: row.role as OrgRole };
        });

      setOrgs(list);
      setCurrentOrgId((current) => current ?? list[0]?.id ?? null);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOrgDetails = useCallback(async () => {
    if (!isSupabaseConfigured || !currentOrgId) {
      setMembers([]);
      setInvites([]);
      return;
    }
    const supabase = createClient();

    const [membersResult, invitesResult] = await Promise.all([
      supabase
        .from("memberships")
        .select("id, user_id, role, created_at, profiles(display_name, avatar_url)")
        .eq("org_id", currentOrgId)
        .order("created_at"),
      supabase
        .from("invites")
        .select("id, email, role, token, expires_at, created_at")
        .eq("org_id", currentOrgId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);

    setMembers(
      (membersResult.data ?? []).map((row) => {
        const profile = row.profiles as unknown as { display_name: string | null; avatar_url: string | null } | null;
        return {
          membershipId: row.id,
          userId: row.user_id,
          role: row.role as OrgRole,
          displayName: profile?.display_name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          createdAt: row.created_at,
        };
      }),
    );

    setInvites(
      (invitesResult.data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role as OrgRole,
        token: row.token,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      })),
    );
  }, [currentOrgId]);

  useEffect(() => {
    refreshOrgs();
  }, [refreshOrgs]);

  useEffect(() => {
    refreshOrgDetails();
  }, [refreshOrgDetails]);

  const currentOrg = orgs.find((org) => org.id === currentOrgId) ?? null;

  return {
    configured: isSupabaseConfigured,
    loading,
    loadError,
    userId,
    orgs,
    currentOrg,
    setCurrentOrgId,
    members,
    invites,
    refreshOrgs,
    refreshOrgDetails,
  };
}
