"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Chip, Collapse, FormControl, Input, Switch, Tooltip, Typography } from "@mui/material";

import { RowLine, RowText } from "@/app/(dashboard)/admin/billing/components/catalog-shared";
import EmptyState from "@/components/product/empty-state";
import NiBuilding from "@/icons/nexture/ni-building";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@flyee/auth/client";

type LiveSub = { id: string; status: string; adminSuspended: boolean; planName: string };

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  liveSub: LiveSub | null;
};

type MemberRow = { userId: string; role: string; displayName: string; joinedAt: string };

const STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  active: "success",
  trialing: "warning",
  past_due: "error",
};

const LIVE_STATUSES = ["trialing", "active", "past_due"];

/**
 * The operator's job here really is scan/manage many tenants: find an org,
 * see its plan health and roster, and act (suspend / reactivate access).
 */
export default function OrgsAdmin() {
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, MemberRow[]>>({});

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: readError } = await supabase
      .from("organizations")
      .select(
        "id, name, slug, created_at, memberships(count), subscriptions(id, status, admin_suspended, created_at, plans(name))",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (readError) {
      setError(readError.message);
      setLoaded(true);
      return;
    }
    setRows(
      (data ?? []).map((row) => {
        const subs =
          (row.subscriptions as unknown as {
            id: string;
            status: string;
            admin_suspended: boolean;
            created_at: string;
            plans: { name: string } | null;
          }[]) ?? [];
        const live = subs
          .filter((sub) => LIVE_STATUSES.includes(sub.status))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return {
          id: row.id,
          name: row.name,
          slug: row.slug,
          createdAt: row.created_at,
          memberCount: (row.memberships as unknown as { count: number }[])?.[0]?.count ?? 0,
          liveSub: live
            ? {
                id: live.id,
                status: live.status,
                adminSuspended: live.admin_suspended,
                planName: live.plans?.name ?? "Unknown plan",
              }
            : null,
        };
      }),
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleExpanded = async (orgId: string) => {
    if (expanded === orgId) {
      setExpanded(null);
      return;
    }
    setExpanded(orgId);
    if (!members[orgId]) {
      const supabase = createClient();
      const { data } = await supabase
        .from("memberships")
        .select("user_id, role, created_at, profiles(display_name)")
        .eq("org_id", orgId)
        .order("created_at");
      setMembers((current) => ({
        ...current,
        [orgId]: (data ?? []).map((row) => ({
          userId: row.user_id,
          role: row.role,
          displayName:
            (row.profiles as unknown as { display_name: string | null } | null)?.display_name ?? "Unnamed user",
          joinedAt: row.created_at,
        })),
      }));
    }
  };

  // Superadmin kill-switch on the live subscription, same semantics as the
  // Billing console (access suspension independent of the provider state).
  const toggleSuspended = async (org: OrgRow) => {
    if (!org.liveSub) return;
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ admin_suspended: !org.liveSub.adminSuspended })
      .eq("id", org.liveSub.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    recordAudit(supabase, org.liveSub.adminSuspended ? "admin.org.reactivated" : "admin.org.suspended", {
      orgId: org.id,
      entityType: "subscription",
      entityId: org.liveSub.id,
      metadata: { org: org.name },
    });
    refresh();
  };

  const visible = rows.filter(
    (row) =>
      !filter ||
      row.name.toLowerCase().includes(filter.toLowerCase()) ||
      row.slug.toLowerCase().includes(filter.toLowerCase()),
  );

  if (loaded && rows.length === 0 && !error) {
    return (
      <EmptyState
        icon={<NiBuilding size="medium" />}
        title="No organizations yet"
        description="Organizations appear here as soon as users sign up. Each one starts on the free plan automatically."
      />
    );
  }

  return (
    <Box className="flex flex-col gap-3">
      <FormControl className="outlined w-72" variant="standard" size="small">
        <Input placeholder="Filter by name or slug" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </FormControl>

      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60!">
          {error}
        </Alert>
      )}

      {visible.map((org) => (
        <Box key={org.id} className="flex flex-col">
          <RowLine>
            <RowText
              primary={org.name}
              secondary={`${org.slug} · ${org.memberCount} member${org.memberCount === 1 ? "" : "s"} · since ${new Date(org.createdAt).toLocaleDateString()}`}
            />
            {org.liveSub ? (
              <>
                <Chip label={org.liveSub.planName} size="small" variant="outlined" />
                <Chip
                  label={org.liveSub.status.replace("_", " ")}
                  size="small"
                  color={STATUS_COLOR[org.liveSub.status] ?? "default"}
                  variant="outlined"
                  className="capitalize"
                />
                {org.liveSub.adminSuspended && <Chip label="suspended" size="small" color="error" variant="outlined" />}
                <Tooltip title={org.liveSub.adminSuspended ? "Reactivate access" : "Suspend access"}>
                  <Switch checked={!org.liveSub.adminSuspended} onChange={() => toggleSuspended(org)} size="small" />
                </Tooltip>
              </>
            ) : (
              <Chip label="no subscription" size="small" variant="outlined" />
            )}
            <Button size="small" variant="text" color="grey" onClick={() => toggleExpanded(org.id)}>
              {expanded === org.id ? "Hide members" : "Members"}
            </Button>
          </RowLine>
          <Collapse in={expanded === org.id}>
            <Box className="flex flex-col gap-2 py-3 pl-6">
              {(members[org.id] ?? []).map((member) => (
                <Box key={member.userId} className="flex flex-row items-center gap-3">
                  <RowText
                    primary={member.displayName}
                    secondary={`joined ${new Date(member.joinedAt).toLocaleDateString()}`}
                  />
                  <Chip label={member.role} size="small" variant="outlined" className="capitalize" />
                </Box>
              ))}
              {expanded === org.id && !members[org.id] && (
                <Typography variant="body2" className="text-text-secondary">
                  Loading members…
                </Typography>
              )}
            </Box>
          </Collapse>
        </Box>
      ))}
      {loaded && visible.length === 0 && rows.length > 0 && (
        <Typography variant="body2" className="text-text-secondary">
          No organizations match the filter.
        </Typography>
      )}
    </Box>
  );
}
