"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Card, CardContent, Grid, Skeleton, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import NiSearch from "@/icons/nexture/ni-search";
import { createClient } from "@flyee/auth/client";

/**
 * Job: a user who just connected Meta wants to trust the numbers the diagnosis
 * reasons over. Success = they can eyeball campaign/ad counts and the last 7
 * days of spend/purchases and confirm it matches their Ads Manager. It is a
 * verification summary, not a management table — the ONE question it answers is
 * "did the sync bring the right data in?". Honest empty state when a connection
 * exists but nothing has synced yet (never a blank or a fake zero).
 */

type MetaConnection = { id: string; name: string; last_synced_at: string | null };

interface DataCheck {
  campaigns: number;
  ads: number;
  latestInsight: string | null;
  spend7: number;
  impressions7: number;
  clicks7: number;
  purchases7: number;
}

const shiftDays = (days: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export default function DataCheckCard({ orgId }: { orgId: string }) {
  const t = useTranslations("connections");
  const [connection, setConnection] = useState<MetaConnection | null>(null);
  const [check, setCheck] = useState<DataCheck | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoaded(false);
    const supabase = createClient();
    const { data: conn } = await supabase
      .from("connections")
      .select("id, name, last_synced_at")
      .eq("org_id", orgId)
      .eq("provider", "meta-ads")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (!conn) {
      setConnection(null);
      setCheck(null);
      setLoaded(true);
      return;
    }
    setConnection(conn as MetaConnection);

    const since = shiftDays(-7);
    const [{ count: campaigns }, { count: ads }, { data: latest }, { data: insights }] = await Promise.all([
      supabase.from("meta_campaigns").select("id", { count: "exact", head: true }).eq("connection_id", conn.id),
      supabase.from("meta_ads").select("id", { count: "exact", head: true }).eq("connection_id", conn.id),
      supabase
        .from("meta_insights_daily")
        .select("date")
        .eq("connection_id", conn.id)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("meta_insights_daily")
        .select("spend, impressions, clicks, purchases")
        .eq("connection_id", conn.id)
        .gte("date", since),
    ]);

    let spend7 = 0,
      impressions7 = 0,
      clicks7 = 0,
      purchases7 = 0;
    for (const row of insights ?? []) {
      spend7 += num(row.spend);
      impressions7 += num(row.impressions);
      clicks7 += num(row.clicks);
      purchases7 += num(row.purchases);
    }

    setCheck({
      campaigns: campaigns ?? 0,
      ads: ads ?? 0,
      latestInsight: (latest as { date: string } | null)?.date ?? null,
      spend7,
      impressions7,
      clicks7,
      purchases7,
    });
    setLoaded(true);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  // No Meta connection: the ConnectionsCard above already owns the connect CTA.
  if (loaded && !connection) return null;

  const tile = (label: string, value: string) => (
    <Grid size={{ xs: 6, md: 3 }}>
      <Box className="border-grey-50 flex flex-col gap-0.5 rounded-2xl border p-3">
        <Typography variant="body2" className="text-text-secondary">
          {label}
        </Typography>
        <Typography variant="h5" component="p">
          {value}
        </Typography>
      </Box>
    </Grid>
  );

  const nf = new Intl.NumberFormat("pt-BR");
  const hasData = check && (check.campaigns > 0 || check.ads > 0 || check.latestInsight !== null);

  return (
    <Grid size={12}>
      <Card component="section">
        <CardContent className="flex flex-col gap-4">
          <Box className="flex flex-row items-center gap-2">
            <span className="bg-primary/10 text-primary flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
              <NiSearch size="medium" />
            </span>
            <Box className="grow">
              <Typography variant="h5" component="h2" className="card-title mb-0">
                {t("data-check-title")}
              </Typography>
              <Typography variant="body2" className="text-text-secondary">
                {t("data-check-hint")}
              </Typography>
            </Box>
          </Box>

          {!loaded && <Skeleton variant="rounded" height={120} />}

          {loaded && !hasData && (
            <EmptyState
              icon={<NiSearch />}
              title={t("data-check-empty-title")}
              description={t("data-check-empty-body")}
            />
          )}

          {loaded && hasData && check && (
            <>
              <Grid container spacing={2}>
                {tile(t("data-check-campaigns"), nf.format(check.campaigns))}
                {tile(t("data-check-ads"), nf.format(check.ads))}
                {tile(
                  t("data-check-last-insight"),
                  check.latestInsight
                    ? new Date(check.latestInsight).toLocaleDateString("pt-BR")
                    : t("data-check-never"),
                )}
                {tile(
                  t("data-check-last-sync"),
                  connection?.last_synced_at
                    ? new Date(connection.last_synced_at).toLocaleString("pt-BR")
                    : t("data-check-never"),
                )}
              </Grid>

              <Typography variant="subtitle2" className="text-text-secondary">
                {t("data-check-7d")}
              </Typography>
              <Grid container spacing={2}>
                {tile(t("data-check-spend"), nf.format(Math.round(check.spend7)))}
                {tile(t("data-check-impressions"), nf.format(check.impressions7))}
                {tile(t("data-check-clicks"), nf.format(check.clicks7))}
                {tile(t("data-check-purchases"), nf.format(check.purchases7))}
              </Grid>

              <Alert severity="info" className="neutral bg-background-paper/60!">
                {t("data-check-compare")}
              </Alert>
            </>
          )}
        </CardContent>
      </Card>
    </Grid>
  );
}
