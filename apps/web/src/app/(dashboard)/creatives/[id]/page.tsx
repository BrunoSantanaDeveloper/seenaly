"use client";

import { deleteCreative } from "../actions";
import CreativeForm from "../components/creative-form";
import type { CreativeSource, CreativeStatus, CreativeWithId } from "../types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Breadcrumbs, Button, Grid, Typography } from "@mui/material";

import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import { createClient } from "@flyee/auth/client";

const s = (v: unknown) => (typeof v === "string" ? v : "");

export default function EditCreativePage() {
  const t = useTranslations("creatives");
  const router = useRouter();
  const id = useParams<{ id: string }>().id;

  const [creative, setCreative] = useState<CreativeWithId | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: row } = await supabase.from("creatives").select("*").eq("id", id).maybeSingle();
    if (!row) {
      setNotFound(true);
      return;
    }
    setCreative({
      id: row.id,
      orgId: row.org_id,
      productId: row.product_id,
      name: s(row.name),
      status: row.status as CreativeStatus,
      source: row.source as CreativeSource,
      connectionId: (row.connection_id as string | null) ?? null,
      metaCreativeId: s(row.meta_creative_id),
      format: s(row.format),
      funnelStage: s(row.funnel_stage),
      durationSeconds: (row.duration_seconds as number | null) ?? null,
      thumbnailUrl: s(row.thumbnail_url),
      angle: s(row.angle),
      promise: s(row.promise),
      pain: s(row.pain),
      desire: s(row.desire),
      objection: s(row.objection),
      hook: s(row.hook),
      firstScene: s(row.first_scene),
      cta: s(row.cta),
      proofType: s(row.proof_type),
      visualStyle: s(row.visual_style),
      emotion: s(row.emotion),
      presumedAudience: s(row.presumed_audience),
      resultSummary: s(row.result_summary),
      notes: s(row.notes),
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    const result = await deleteCreative(id);
    if (result.ok) {
      router.push("/creatives");
      router.refresh();
    }
  };

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <Grid size={12} spacing={2.5} container className="items-center">
          <Grid size={{ xs: 12, md: "grow" }}>
            <Typography variant="h1" component="h1" className="mb-0">
              {creative?.name || t("title")}
            </Typography>
            <Breadcrumbs>
              <Link color="inherit" href="/home">
                {t("crumb-home")}
              </Link>
              <Link color="inherit" href="/creatives">
                {t("title")}
              </Link>
            </Breadcrumbs>
          </Grid>
          {creative && (
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

        {creative && (
          <Grid size={12}>
            <CreativeForm orgId={creative.orgId} productId={creative.productId} creative={creative} />
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}
