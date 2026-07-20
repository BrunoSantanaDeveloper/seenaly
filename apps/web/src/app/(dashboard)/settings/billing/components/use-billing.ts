"use client";

import { useCallback, useEffect, useState } from "react";

import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

export type OrgLite = { id: string; name: string; role: string };

export interface SubscriptionInfo {
  id: string;
  status: string;
  adminSuspended: boolean;
  planId: string;
  planName: string;
  planKind: string;
  isFree: boolean;
  period: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  provider: string | null;
  modules: { id: string; name: string }[];
}

export interface PlanRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: "recurring" | "credits";
  period: "weekly" | "monthly" | "yearly" | null;
  priceCents: number;
  currency: string;
  creditAmount: number | null;
  /** Monthly credit allowance for recurring plans, from limits.credits_monthly. */
  creditsMonthly: number | null;
  trialDays: number;
  isFree: boolean;
}

export interface ModuleRow {
  id: string;
  name: string;
  description: string | null;
  kind: "recurring" | "one_time";
  priceCents: number;
}

export interface InvoiceRow {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  description: string | null;
  invoiceUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface CreditRow {
  id: string;
  amount: number;
  kind: string;
  description: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function useBilling() {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<OrgLite[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [creditBalance, setCreditBalance] = useState(0);
  const [credits, setCredits] = useState<CreditRow[]>([]);

  const refreshOrgs = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("memberships")
      .select("role, organizations(id, name)")
      .eq("user_id", user.id)
      .order("created_at");
    const list: OrgLite[] = (data ?? [])
      .filter((row) => row.organizations)
      .map((row) => {
        const org = row.organizations as unknown as { id: string; name: string };
        return { id: org.id, name: org.name, role: row.role };
      });
    setOrgs(list);
    setCurrentOrgId((current) => current ?? list[0]?.id ?? null);
    setLoading(false);
  }, []);

  const refreshDetails = useCallback(async () => {
    if (!isSupabaseConfigured || !currentOrgId) return;
    const supabase = createClient();

    const [subResult, plansResult, modulesResult, invoicesResult, balanceResult, creditsResult] = await Promise.all([
      supabase
        .from("subscriptions")
        .select(
          "id, status, admin_suspended, plan_id, period, current_period_end, trial_ends_at, provider, plans(name, kind, is_free), subscription_modules(module_id, status, modules(name))",
        )
        .eq("org_id", currentOrgId)
        .in("status", ["trialing", "active", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("plans").select("*").eq("is_active", true).order("sort"),
      supabase.from("modules").select("*").eq("is_active", true).order("sort"),
      supabase
        .from("invoices")
        .select("*")
        .eq("org_id", currentOrgId)
        .order("created_at", { ascending: false })
        .limit(24),
      supabase.rpc("org_credit_balance", { target_org: currentOrgId }),
      supabase
        .from("credit_transactions")
        .select("*")
        .eq("org_id", currentOrgId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const sub = subResult.data;
    if (sub) {
      const plan = sub.plans as unknown as { name: string; kind: string; is_free: boolean } | null;
      const subModules =
        (sub.subscription_modules as unknown as
          | { module_id: string; status: string; modules: { name: string } | null }[]
          | null) ?? [];
      setSubscription({
        id: sub.id,
        status: sub.status,
        adminSuspended: sub.admin_suspended,
        planId: sub.plan_id,
        planName: plan?.name ?? "Unknown plan",
        planKind: plan?.kind ?? "recurring",
        isFree: plan?.is_free ?? false,
        period: sub.period,
        currentPeriodEnd: sub.current_period_end,
        trialEndsAt: sub.trial_ends_at,
        provider: sub.provider,
        modules: subModules
          .filter((m) => m.status === "active")
          .map((m) => ({ id: m.module_id, name: m.modules?.name ?? "Module" })),
      });
    } else {
      setSubscription(null);
    }

    setPlans(
      (plansResult.data ?? []).map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        kind: p.kind,
        period: p.period,
        priceCents: p.price_cents,
        currency: p.currency,
        creditAmount: p.credit_amount,
        creditsMonthly: (p.limits as { credits_monthly?: number } | null)?.credits_monthly ?? null,
        trialDays: p.trial_days,
        isFree: p.is_free,
      })),
    );
    setModules(
      (modulesResult.data ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        kind: m.kind,
        priceCents: m.price_cents,
      })),
    );
    setInvoices(
      (invoicesResult.data ?? []).map((invoice) => ({
        id: invoice.id,
        amountCents: invoice.amount_cents,
        currency: invoice.currency,
        status: invoice.status,
        description: invoice.description,
        invoiceUrl: invoice.invoice_url,
        paidAt: invoice.paid_at,
        createdAt: invoice.created_at,
      })),
    );
    setCreditBalance(balanceResult.data ?? 0);
    setCredits(
      (creditsResult.data ?? []).map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        kind: tx.kind,
        description: tx.description,
        expiresAt: tx.expires_at,
        createdAt: tx.created_at,
      })),
    );
  }, [currentOrgId]);

  useEffect(() => {
    refreshOrgs();
  }, [refreshOrgs]);

  useEffect(() => {
    refreshDetails();
  }, [refreshDetails]);

  const currentOrg = orgs.find((org) => org.id === currentOrgId) ?? null;
  const canManage = currentOrg ? ["owner", "admin"].includes(currentOrg.role) : false;

  return {
    configured: isSupabaseConfigured,
    loading,
    orgs,
    currentOrg,
    canManage,
    setCurrentOrgId,
    subscription,
    plans,
    modules,
    invoices,
    creditBalance,
    credits,
    refreshDetails,
  };
}

export const formatMoney = (cents: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
