"use client";

import { deleteExperiment } from "../actions";
import ExperimentForm from "../components/experiment-form";
import type { ExperimentStatus, ExperimentWithId } from "../types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Breadcrumbs, Button, Grid, Typography } from "@mui/material";

import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import { createClient } from "@flyee/auth/client";

const s = (v: unknown) => (typeof v === "string" ? v : "");

export default function EditExperimentPage() {
  const t = useTranslations("experiments");
  const router = useRouter();
  const id = useParams<{ id: string }>().id;

  const [experiment, setExperiment] = useState<ExperimentWithId | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: row }, { data: links }] = await Promise.all([
      supabase.from("experiments").select("*").eq("id", id).maybeSingle(),
      supabase.from("experiment_creatives").select("creative_id").eq("experiment_id", id),
    ]);
    if (!row) {
      setNotFound(true);
      return;
    }
    setExperiment({
      id: row.id,
      orgId: row.org_id,
      productId: row.product_id,
      diagnosisId: (row.diagnosis_id as string | null) ?? null,
      title: s(row.title),
      status: row.status as ExperimentStatus,
      hypothesis: s(row.hypothesis),
      changeMade: s(row.change_made),
      reason: s(row.reason),
      periodStart: s(row.period_start),
      periodEnd: s(row.period_end),
      budget: (row.budget as number | null) ?? null,
      primaryMetric: s(row.primary_metric),
      secondaryMetric: s(row.secondary_metric),
      result: s(row.result),
      conclusion: s(row.conclusion),
      nextStep: s(row.next_step),
      notes: s(row.notes),
      creativeIds: (links ?? []).map((l) => l.creative_id as string),
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    const result = await deleteExperiment(id);
    if (result.ok) {
      router.push("/experiments");
      router.refresh();
    }
  };

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <Grid size={12} spacing={2.5} container className="items-center">
          <Grid size={{ xs: 12, md: "grow" }}>
            <Typography variant="h1" component="h1" className="mb-0">
              {experiment?.title || t("title")}
            </Typography>
            <Breadcrumbs>
              <Link color="inherit" href="/home">
                {t("crumb-home")}
              </Link>
              <Link color="inherit" href="/experiments">
                {t("title")}
              </Link>
            </Breadcrumbs>
          </Grid>
          {experiment && (
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

        {experiment && (
          <Grid size={12}>
            <ExperimentForm orgId={experiment.orgId} productId={experiment.productId} experiment={experiment} />
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}
