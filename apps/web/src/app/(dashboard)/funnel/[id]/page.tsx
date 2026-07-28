"use client";

import { deleteFunnelSnapshot } from "../actions";
import FunnelForm from "../components/funnel-form";
import type { FunnelWithId } from "../types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Breadcrumbs, Button, Grid, Typography } from "@mui/material";

import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import { createClient } from "@flyee/auth/client";

const s = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export default function EditFunnelSnapshotPage() {
  const t = useTranslations("funnel");
  const router = useRouter();
  const id = useParams<{ id: string }>().id;

  const [snapshot, setSnapshot] = useState<FunnelWithId | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: row } = await supabase.from("funnel_snapshots").select("*").eq("id", id).maybeSingle();
    if (!row) {
      setNotFound(true);
      return;
    }
    setSnapshot({
      id: row.id,
      orgId: row.org_id,
      productId: row.product_id,
      label: s(row.label),
      periodStart: s(row.period_start),
      periodEnd: s(row.period_end),
      source: s(row.source),
      visits: n(row.visits),
      signups: n(row.signups),
      checkoutInitiated: n(row.checkout_initiated),
      purchases: n(row.purchases),
      refunds: n(row.refunds),
      pending: n(row.pending),
      upsells: n(row.upsells),
      grossRevenue: n(row.gross_revenue),
      netRevenue: n(row.net_revenue),
      notes: s(row.notes),
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    const result = await deleteFunnelSnapshot(id);
    if (result.ok) {
      router.push("/funnel");
      router.refresh();
    }
  };

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <Grid size={12} spacing={2.5} container className="items-center">
          <Grid size={{ xs: 12, md: "grow" }}>
            <Typography variant="h1" component="h1" className="mb-0">
              {snapshot?.label || t("title")}
            </Typography>
            <Breadcrumbs>
              <Link color="inherit" href="/home">
                {t("crumb-home")}
              </Link>
              <Link color="inherit" href="/funnel">
                {t("title")}
              </Link>
            </Breadcrumbs>
          </Grid>
          {snapshot && (
            <Grid size={{ xs: 12, md: "auto" }}>
              <Button variant="outlined" color="grey" startIcon={<NiBinEmpty size="small" />} onClick={remove}>
                {t("delete")}
              </Button>
            </Grid>
          )}
        </Grid>

        {notFound && (
          <Grid size={12}>
            <Alert severity="warning" className="neutral bg-background-paper/60!">
              {t("not-found")}
            </Alert>
          </Grid>
        )}

        {snapshot && (
          <Grid size={12}>
            <FunnelForm orgId={snapshot.orgId} productId={snapshot.productId} snapshot={snapshot} />
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}
