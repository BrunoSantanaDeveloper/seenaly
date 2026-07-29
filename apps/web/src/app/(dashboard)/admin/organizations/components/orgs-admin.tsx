"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Chip, Collapse, FormControl, Input, Switch, Tooltip, Typography } from "@mui/material";

import { Field, RowLine, RowText, SelectField } from "@/app/(dashboard)/admin/billing/components/catalog-shared";
import EmptyState from "@/components/product/empty-state";
import NiBuilding from "@/icons/nexture/ni-building";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@flyee/auth/client";

type LiveSub = { id: string; status: string; adminSuspended: boolean; planName: string; planId: string };

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  liveSub: LiveSub | null;
};

type MemberRow = { userId: string; role: string; displayName: string; joinedAt: string };

type PlanOption = { id: string; name: string; isActive: boolean };

const STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  active: "success",
  trialing: "warning",
  past_due: "error",
};

const LIVE_STATUSES = ["trialing", "active", "past_due"];

/**
 * The operator's job here really is scan/manage many tenants: find an org,
 * see its plan health, credit balance and roster, and act — suspend access,
 * move it to another plan, or top its balance up. Those three levers used to
 * live only in the SQL editor and in `npm run db:seed-plans`, which meant the
 * common "customer paid / customer is stuck at zero credits" fixes happened
 * outside the product, unaudited.
 */
export default function OrgsAdmin() {
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, MemberRow[]>>({});
  const [creditForm, setCreditForm] = useState<Record<string, { amount: string; note: string }>>({});
  const [planChoice, setPlanChoice] = useState<Record<string, string>>({});
  const [busyOrg, setBusyOrg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: readError } = await supabase
      .from("organizations")
      .select(
        "id, name, slug, created_at, memberships(count), subscriptions(id, status, admin_suspended, created_at, plan_id, plans(name))",
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
            plan_id: string;
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
                planId: live.plan_id,
              }
            : null,
        };
      }),
    );

    // Balances come from an RPC because org_credit_balance() is membership-
    // gated: a superadmin is not a member of the tenants they operate.
    const { data: balanceData, error: balanceError } = await supabase.rpc("admin_credit_balances");
    if (balanceError) setError(balanceError.message);
    else setBalances((balanceData ?? {}) as Record<string, number>);

    const { data: planData, error: planError } = await supabase
      .from("plans")
      .select("id, name, is_active, sort")
      .order("sort");
    if (planError) setError(planError.message);
    else
      setPlans(
        (planData ?? []).map((plan) => ({
          id: plan.id as string,
          name: plan.name as string,
          isActive: plan.is_active as boolean,
        })),
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

  /** Manual top-up or clawback. Positive adds, negative removes; the RPC refuses a negative balance. */
  const grantCredits = async (org: OrgRow) => {
    const form = creditForm[org.id] ?? { amount: "", note: "" };
    const amount = Number(form.amount);
    if (!Number.isInteger(amount) || amount === 0) {
      setError("Enter a whole number of credits (negative to claw credits back).");
      return;
    }
    setError(null);
    setNotice(null);
    setBusyOrg(org.id);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("admin_grant_credits", {
      target_org: org.id,
      amount,
      note: form.note || null,
    });
    setBusyOrg(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    recordAudit(supabase, "admin.org.credits_adjusted", {
      orgId: org.id,
      entityType: "organization",
      entityId: org.id,
      metadata: { org: org.name, amount, note: form.note || null, balance: data },
    });
    setCreditForm((current) => ({ ...current, [org.id]: { amount: "", note: "" } }));
    setNotice(`${org.name}: ${amount > 0 ? "+" : ""}${amount} credits · new balance ${data}.`);
    refresh();
  };

  /** Move the org onto another plan. Credits are NOT granted here — that stays an explicit decision. */
  const applyPlan = async (org: OrgRow) => {
    const planId = planChoice[org.id];
    if (!planId || planId === org.liveSub?.planId) return;
    setError(null);
    setNotice(null);
    setBusyOrg(org.id);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("admin_set_org_plan", {
      target_org: org.id,
      target_plan: planId,
    });
    setBusyOrg(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const planName = plans.find((plan) => plan.id === planId)?.name ?? "plan";
    recordAudit(supabase, "admin.org.plan_changed", {
      orgId: org.id,
      entityType: "subscription",
      entityId: (data as string) ?? undefined,
      metadata: { org: org.name, from: org.liveSub?.planName ?? null, to: planName },
    });
    setNotice(
      `${org.name} moved to ${planName}. Credits were not granted — top the balance up below if the plan owes any.`,
    );
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
        <Alert severity="error" className="neutral bg-background-paper/60!" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {notice && (
        <Alert severity="success" className="neutral bg-background-paper/60!" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {visible.map((org) => {
        const form = creditForm[org.id] ?? { amount: "", note: "" };
        const selectedPlan = planChoice[org.id] ?? org.liveSub?.planId ?? "";
        const balance = balances[org.id] ?? 0;
        return (
          <Box key={org.id} className="flex flex-col">
            <RowLine>
              <RowText
                primary={org.name}
                secondary={`${org.slug} · ${org.memberCount} member${org.memberCount === 1 ? "" : "s"} · since ${new Date(org.createdAt).toLocaleDateString()}`}
              />
              <Tooltip title="Usable credit balance (expired grants excluded)">
                <Chip
                  label={`${balance} credits`}
                  size="small"
                  variant="outlined"
                  color={balance > 0 ? "default" : "warning"}
                />
              </Tooltip>
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
                  {org.liveSub.adminSuspended && (
                    <Chip label="suspended" size="small" color="error" variant="outlined" />
                  )}
                  <Tooltip title={org.liveSub.adminSuspended ? "Reactivate access" : "Suspend access"}>
                    <Switch
                      checked={!org.liveSub.adminSuspended}
                      onChange={() => toggleSuspended(org)}
                      size="small"
                      slotProps={{ input: { "aria-label": `Access for ${org.name}` } }}
                    />
                  </Tooltip>
                </>
              ) : (
                <Chip label="no subscription" size="small" variant="outlined" />
              )}
              <Button size="small" variant="text" color="grey" onClick={() => toggleExpanded(org.id)}>
                {expanded === org.id ? "Close" : "Manage"}
              </Button>
            </RowLine>
            <Collapse in={expanded === org.id}>
              <Box className="flex flex-col gap-5 py-4 pl-6">
                <Box className="flex flex-col gap-2">
                  <Typography variant="subtitle2">Credits</Typography>
                  <Box className="flex flex-row flex-wrap items-end gap-3">
                    <Field
                      label="Amount"
                      type="number"
                      className="w-32"
                      value={form.amount}
                      onChange={(value) =>
                        setCreditForm((current) => ({ ...current, [org.id]: { ...form, amount: value } }))
                      }
                    />
                    <Field
                      label="Reason (kept in the ledger)"
                      className="w-72"
                      value={form.note}
                      onChange={(value) =>
                        setCreditForm((current) => ({ ...current, [org.id]: { ...form, note: value } }))
                      }
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      disabled={busyOrg === org.id}
                      onClick={() => grantCredits(org)}
                    >
                      Apply adjustment
                    </Button>
                  </Box>
                  <Typography variant="body2" className="text-text-secondary">
                    Balance {balance}. A positive amount tops the org up, a negative one claws credits back; the ledger
                    records it as an adjustment made by you.
                  </Typography>
                </Box>

                <Box className="flex flex-col gap-2">
                  <Typography variant="subtitle2">Plan</Typography>
                  <Box className="flex flex-row flex-wrap items-end gap-3">
                    <Box className="w-64">
                      <SelectField
                        label="Move to plan"
                        value={selectedPlan}
                        options={plans.map((plan) => ({
                          value: plan.id,
                          label: plan.isActive ? plan.name : `${plan.name} (inactive)`,
                        }))}
                        onChange={(value) => setPlanChoice((current) => ({ ...current, [org.id]: value }))}
                      />
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      disabled={busyOrg === org.id || !selectedPlan || selectedPlan === org.liveSub?.planId}
                      onClick={() => applyPlan(org)}
                    >
                      Apply plan
                    </Button>
                  </Box>
                  <Typography variant="body2" className="text-text-secondary">
                    Changes the live subscription (or creates one). It grants no credits and never lifts a suspension —
                    both stay explicit decisions.
                  </Typography>
                </Box>

                <Box className="flex flex-col gap-2">
                  <Typography variant="subtitle2">Members</Typography>
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
              </Box>
            </Collapse>
          </Box>
        );
      })}
      {loaded && visible.length === 0 && rows.length > 0 && (
        <Typography variant="body2" className="text-text-secondary">
          No organizations match the filter.
        </Typography>
      )}
    </Box>
  );
}
