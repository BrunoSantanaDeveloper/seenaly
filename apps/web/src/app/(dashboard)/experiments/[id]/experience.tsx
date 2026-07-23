"use client";

import { deleteExperiment } from "../actions";
import ExperimentForm from "../components/experiment-form";
import type { ExperimentStatus, ExperimentWithId } from "../types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Breadcrumbs, Button, Grid, Skeleton, Typography } from "@mui/material";

import ConfirmActionDialog from "@/components/product/confirm-action-dialog";
import LoadErrorState from "@/components/product/load-error-state";
import NiArrowLeft from "@/icons/nexture/ni-arrow-left";
import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import { isReadinessOutput } from "@/lib/readiness/schema";
import { createClient } from "@flyee/auth/client";

const stringValue = (value: unknown) => (typeof value === "string" ? value : "");

type ReadinessOrigin = {
  verdictId: string;
  findingIndex: number;
  productId: string;
};

export function ExperimentDetailExperience({
  forcedId,
  workspace = false,
}: {
  forcedId?: string;
  workspace?: boolean;
} = {}) {
  const t = useTranslations("experiments");
  const tc = useTranslations("productCommon");
  const router = useRouter();
  const routeId = useParams<{ id?: string }>().id;
  const id = forcedId ?? routeId ?? "";

  const [experiment, setExperiment] = useState<ExperimentWithId | null>(null);
  const [origin, setOrigin] = useState<ReadinessOrigin | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setNotFound(false);
    const supabase = createClient();
    const [{ data: row, error: rowError }, { data: links, error: linksError }] = await Promise.all([
      supabase.from("experiments").select("*").eq("id", id).maybeSingle(),
      supabase.from("experiment_creatives").select("creative_id").eq("experiment_id", id),
    ]);
    if (rowError || linksError) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    if (!row) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const next: ExperimentWithId = {
      id: row.id,
      orgId: row.org_id,
      productId: row.product_id,
      diagnosisId: (row.diagnosis_id as string | null) ?? null,
      title: stringValue(row.title),
      status: row.status as ExperimentStatus,
      hypothesis: stringValue(row.hypothesis),
      changeMade: stringValue(row.change_made),
      reason: stringValue(row.reason),
      periodStart: stringValue(row.period_start),
      periodEnd: stringValue(row.period_end),
      budget: (row.budget as number | null) ?? null,
      primaryMetric: stringValue(row.primary_metric),
      secondaryMetric: stringValue(row.secondary_metric),
      result: stringValue(row.result),
      conclusion: stringValue(row.conclusion),
      nextStep: stringValue(row.next_step),
      notes: stringValue(row.notes),
      creativeIds: (links ?? []).map((link) => link.creative_id as string),
    };
    setExperiment(next);

    if (next.diagnosisId) {
      const { data: diagnosis, error: diagnosisError } = await supabase
        .from("diagnoses")
        .select("id, product_id, scope, output")
        .eq("id", next.diagnosisId)
        .maybeSingle();
      if (diagnosisError) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      if (diagnosis?.scope === "readiness" && isReadinessOutput(diagnosis.output)) {
        const findingIndex = diagnosis.output.findings.findIndex(
          (finding) => finding.recommended_action === next.changeMade,
        );
        if (findingIndex >= 0) {
          setOrigin({
            verdictId: diagnosis.id,
            findingIndex,
            productId: diagnosis.product_id,
          });
        }
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async () => {
    setDeleting(true);
    setActionError(null);
    const result = await deleteExperiment(id);
    if (!result.ok) {
      setActionError(result.error);
      setDeleting(false);
      return;
    }
    const destination = experiment?.productId ? `/products/${experiment.productId}/experiments` : "/experiments";
    router.push(destination);
    router.refresh();
  };

  const verdictHref = origin
    ? `/products/${origin.productId}/readiness?verdict=${origin.verdictId}#finding-${origin.findingIndex}`
    : null;

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size="grow" spacing={5} container>
        <Grid size={12} spacing={2.5} container className="items-center">
          <Grid size={{ xs: 12, md: "grow" }}>
            {!workspace && (
              <Typography variant="h1" component="h1" className="mb-0">
                {experiment?.title || t("title")}
              </Typography>
            )}
            <Breadcrumbs>
              <Link color="inherit" href="/home">
                {t("crumb-home")}
              </Link>
              <Link
                color="inherit"
                href={experiment?.productId ? `/products/${experiment.productId}/experiments` : "/experiments"}
              >
                {t("title")}
              </Link>
              {verdictHref && (
                <Link color="inherit" href={verdictHref}>
                  {tc("origin-readiness")}
                </Link>
              )}
            </Breadcrumbs>
          </Grid>
          {experiment && (
            <Grid size={{ xs: 12, md: "auto" }} className="flex flex-wrap gap-2">
              {verdictHref && (
                <Button
                  component={Link}
                  href={verdictHref}
                  variant="outlined"
                  color="grey"
                  startIcon={<NiArrowLeft size="small" />}
                >
                  {tc("back-to-verdict")}
                </Button>
              )}
              <Button
                variant="outlined"
                color="error"
                startIcon={<NiBinEmpty size="small" />}
                onClick={() => setDeleteOpen(true)}
              >
                {t("delete")}
              </Button>
            </Grid>
          )}
        </Grid>

        {loading && (
          <Grid size={12}>
            <Skeleton variant="rounded" height={420} />
          </Grid>
        )}

        {!loading && loadError && (
          <Grid size={12}>
            <LoadErrorState
              title={tc("load-error-title")}
              description={tc("load-error-body")}
              retryLabel={tc("retry")}
              onRetry={() => void load()}
            />
          </Grid>
        )}

        {!loading && notFound && !loadError && (
          <Grid size={12}>
            <Alert severity="warning" className="neutral bg-background-paper/60!">
              {t("not-found")}
            </Alert>
          </Grid>
        )}

        {actionError && (
          <Grid size={12}>
            <Alert severity="error" className="neutral bg-background-paper/60!">
              {actionError}
            </Alert>
          </Grid>
        )}

        {!loading && !loadError && experiment && (
          <Grid size={12}>
            <ExperimentForm
              orgId={experiment.orgId}
              productId={experiment.productId}
              experiment={experiment}
              returnHref={workspace ? `/products/${experiment.productId}/experiments` : "/experiments"}
            />
          </Grid>
        )}
      </Grid>

      <ConfirmActionDialog
        open={deleteOpen}
        title={tc("delete-confirm-title")}
        description={tc("delete-confirm-body", { name: experiment?.title ?? "" })}
        confirmLabel={tc("delete-confirm")}
        cancelLabel={tc("cancel")}
        busy={deleting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void remove()}
      />
    </Grid>
  );
}

export default function EditExperimentPage() {
  return <ExperimentDetailExperience />;
}
