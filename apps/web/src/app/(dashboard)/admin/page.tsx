"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, Box, Breadcrumbs, Card, CardContent, Grid, Skeleton, Typography } from "@mui/material";

import NiAI from "@/icons/nexture/ni-ai";
import NiAnnouncement from "@/icons/nexture/ni-announcement";
import NiArchive from "@/icons/nexture/ni-archive";
import NiBook from "@/icons/nexture/ni-book";
import NiBuilding from "@/icons/nexture/ni-building";
import NiChartLineBar from "@/icons/nexture/ni-chart-line-bar";
import NiCoin from "@/icons/nexture/ni-coin";
import NiMoney from "@/icons/nexture/ni-money";
import NiPen from "@/icons/nexture/ni-pen";
import NiQuestionHexagon from "@/icons/nexture/ni-question-hexagon";
import NiReceipt from "@/icons/nexture/ni-receipt";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiUsers from "@/icons/nexture/ni-users";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

type AdminMetrics = {
  orgs: number;
  users: number;
  new_orgs_30d: number;
  new_users_30d: number;
  subscriptions: Record<string, number>;
  suspended: number;
  mrr: { currency: string; amount_cents: number }[];
  credits_consumed_30d: number;
};

const formatMoney = (amountCents: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountCents / 100);

function StatCard({
  icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  loading: boolean;
}) {
  return (
    <Card component="section" className="h-full">
      <CardContent className="flex flex-row items-start gap-4">
        <span className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl [&_svg]:h-6 [&_svg]:w-6">
          {icon}
        </span>
        <Box className="flex min-w-0 flex-col">
          <Typography variant="body2" className="text-text-secondary">
            {label}
          </Typography>
          {loading ? (
            <Skeleton variant="text" className="text-2xl" width={96} />
          ) : (
            <Typography variant="h4" component="p" className="truncate">
              {value}
            </Typography>
          )}
          {loading ? (
            <Skeleton variant="text" width={128} />
          ) : (
            hint && (
              <Typography variant="body2" className="text-text-secondary">
                {hint}
              </Typography>
            )
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

const consoles = [
  {
    href: "/admin/organizations",
    icon: <NiBuilding size="medium" />,
    title: "Organizations & Users",
    description: "Every tenant and account on the platform: rosters, plans, suspension and bans.",
  },
  {
    href: "/admin/billing",
    icon: <NiMoney size="medium" />,
    title: "Billing",
    description: "Plans, modules, coupons and every subscription across the platform.",
  },
  {
    href: "/admin/ai",
    icon: <NiAI size="medium" />,
    title: "AI Assistants",
    description: "Instruction-driven assistants offered inside the product.",
  },
  {
    href: "/admin/knowledge",
    icon: <NiBook size="medium" />,
    title: "Knowledge",
    description: "Global knowledge collections powering assistant answers.",
  },
  {
    href: "/admin/audit",
    icon: <NiShieldCheck size="medium" />,
    title: "Audit & Logs",
    description: "Append-only audit trail, sign-in access log and the WhatsApp message log.",
  },
  {
    href: "/admin/insights",
    icon: <NiChartLineBar size="medium" />,
    title: "Data Insights",
    description: "Ask questions about the database in plain language — the AI answers with a read-only query.",
  },
  {
    href: "/admin/backups",
    icon: <NiArchive size="medium" />,
    title: "Backups",
    description: "Automatic nightly database backups and on-demand exports you can download.",
  },
  {
    href: "/admin/announcements",
    icon: <NiAnnouncement size="medium" />,
    title: "Announcements",
    description: "System-wide banners every user sees until dismissed.",
  },
  {
    href: "/admin/help",
    icon: <NiQuestionHexagon size="medium" />,
    title: "Help Center",
    description: "Public help articles served at /help, per locale.",
  },
  {
    href: "/admin/blog",
    icon: <NiPen size="medium" />,
    title: "Blog",
    description: "Posts published to /blog and the comment moderation queue.",
  },
];

/**
 * Superadmin overview: the real platform numbers (via the admin_metrics
 * RPC) and the door to every console. RLS + the /admin layout gate keep
 * non-superadmins out; the client check only improves UX.
 */
export default function AdminOverview() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const load = async () => {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("admin_metrics");
      if (rpcError) {
        setError(true);
      } else {
        setMetrics(data as AdminMetrics);
      }
      setLoading(false);
    };
    load();
  }, []);

  const live = (metrics?.subscriptions?.active ?? 0) + (metrics?.subscriptions?.trialing ?? 0);
  const pastDue = metrics?.subscriptions?.past_due ?? 0;
  const suspended = metrics?.suspended ?? 0;
  const mrrLabel = metrics
    ? metrics.mrr.length > 0
      ? metrics.mrr.map((entry) => formatMoney(entry.amount_cents, entry.currency)).join(" + ")
      : formatMoney(0, "BRL")
    : "";

  return (
    <Grid container spacing={5}>
      <Grid size={12}>
        <Typography variant="h1" component="h1" className="mb-0">
          Platform Administration
        </Typography>
        <Breadcrumbs>
          <Link color="inherit" href="/dashboards/default">
            Home
          </Link>
          <Typography variant="body2">Admin</Typography>
        </Breadcrumbs>
      </Grid>

      {!isSupabaseConfigured && (
        <Grid size={12}>
          <Alert severity="info" className="neutral bg-background-paper/60!">
            Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to activate the
            admin consoles.
          </Alert>
        </Grid>
      )}

      {error && (
        <Grid size={12}>
          <Alert severity="error" className="neutral bg-background-paper/60!">
            Could not load platform metrics. Make sure migration 0016_admin.sql is applied and you are a superadmin.
          </Alert>
        </Grid>
      )}

      {isSupabaseConfigured && !error && (
        <>
          {(pastDue > 0 || suspended > 0) && !loading && (
            <Grid size={12}>
              <Alert severity="warning" className="neutral bg-background-paper/60!">
                Needs attention: {pastDue > 0 && `${pastDue} subscription${pastDue > 1 ? "s" : ""} past due`}
                {pastDue > 0 && suspended > 0 && ", "}
                {suspended > 0 && `${suspended} suspended by admin`}. Review them in the Billing console.
              </Alert>
            </Grid>
          )}

          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <StatCard
              icon={<NiMoney size="medium" />}
              label="Monthly recurring revenue"
              value={mrrLabel}
              hint="Live paid recurring plans, normalized to monthly"
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <StatCard
              icon={<NiReceipt size="medium" />}
              label="Live subscriptions"
              value={String(live)}
              hint={`${metrics?.subscriptions?.trialing ?? 0} trialing, ${pastDue} past due`}
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <StatCard
              icon={<NiCoin size="medium" />}
              label="Credits consumed (30d)"
              value={String(metrics?.credits_consumed_30d ?? 0)}
              hint="Across all organizations"
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <StatCard
              icon={<NiBuilding size="medium" />}
              label="Organizations"
              value={String(metrics?.orgs ?? 0)}
              hint={`${metrics?.new_orgs_30d ?? 0} new in the last 30 days`}
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <StatCard
              icon={<NiUsers size="medium" />}
              label="Users"
              value={String(metrics?.users ?? 0)}
              hint={`${metrics?.new_users_30d ?? 0} new in the last 30 days`}
              loading={loading}
            />
          </Grid>
        </>
      )}

      <Grid size={12}>
        <Typography variant="h5" component="h2" className="mb-0">
          Consoles
        </Typography>
      </Grid>
      {consoles.map((entry) => (
        <Grid key={entry.href} size={{ xs: 12, sm: 6, lg: 4 }}>
          <Card component="section" className="h-full transition-shadow hover:shadow-md">
            <Link href={entry.href} className="block h-full">
              <CardContent className="flex flex-row items-start gap-4">
                <span className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl [&_svg]:h-6 [&_svg]:w-6">
                  {entry.icon}
                </span>
                <Box className="flex flex-col">
                  <Typography variant="h6" component="h3">
                    {entry.title}
                  </Typography>
                  <Typography variant="body2" className="text-text-secondary">
                    {entry.description}
                  </Typography>
                </Box>
              </CardContent>
            </Link>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
