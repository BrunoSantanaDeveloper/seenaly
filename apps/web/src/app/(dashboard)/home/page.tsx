"use client";

import { computeCompleteness } from "../products/lib/completeness";
import { mapProductRow } from "../products/lib/map";
import type { ProductWithChildren } from "../products/types";
import { useOrganization } from "../settings/organization/components/use-organization";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Card, CardContent, Chip, Grid, LinearProgress, Skeleton, Typography } from "@mui/material";

import ActivationChecklist from "@/components/activation/activation-checklist";
import { TONE, type Tone } from "@/components/marketing/tone";
import EmptyState from "@/components/product/empty-state";
import LoadErrorState from "@/components/product/load-error-state";
import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiCamera from "@/icons/nexture/ni-camera";
import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";
import NiCheck from "@/icons/nexture/ni-check";
import NiDatabase from "@/icons/nexture/ni-database";
import NiFlask from "@/icons/nexture/ni-flask";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiSparkle from "@/icons/nexture/ni-sparkle";
import NiTag from "@/icons/nexture/ni-tag";
import NiTrendUp from "@/icons/nexture/ni-trend-up";
import { cn } from "@/lib/utils";
import { createClient } from "@flyee/auth/client";

/**
 * Seenaly's home — the post-login landing (DEFAULTS.appRoot).
 *
 * Who: an org member, most often a solo operator. Job: "what do I do now?"
 * Success: they leave with ONE clear next action AND a mental map of the path.
 *
 * Deliberately NOT a metrics dashboard: it answers a question with real state
 * (context health, data status, journey progress) instead of decorating fake
 * numbers. Zero-data views are EmptyStates, never blanks.
 *
 * Color carries meaning here (not decoration): every pillar owns one harmonic
 * hue from the shared tone system, so the home reads as a colored map rather
 * than a wall of primary. The activation checklist still owns the single
 * completion-drive ring; the journey tiles only reflect real done-state (a ✓),
 * never a competing score.
 */

type ConnectionRow = { id: string; name: string; status: string; last_synced_at: string | null };

const CONNECTION_STATUS_COLOR: Record<string, "default" | "success" | "error"> = {
  connected: "success",
  error: "error",
  disabled: "default",
};

const PRODUCT_STATUS_COLOR: Record<string, "default" | "success" | "warning"> = {
  draft: "warning",
  active: "success",
  archived: "default",
};

type Progress = { hasReadiness: boolean; hasDiagnosis: boolean; hasExperiment: boolean };

/** The single recommended action, derived from the real journey order. */
type NextKey = "product" | "readiness" | "diagnosis" | "experiments" | "iterate";

const NEXT_CONFIG: Record<NextKey, { tone: Tone; icon: React.ReactNode; href: string }> = {
  product: { tone: "primary", icon: <NiTag aria-hidden />, href: "/products/new" },
  readiness: { tone: "accent-4", icon: <NiShieldCheck aria-hidden />, href: "/readiness" },
  diagnosis: { tone: "accent-1", icon: <NiPulse aria-hidden />, href: "/diagnosis" },
  experiments: { tone: "accent-3", icon: <NiFlask aria-hidden />, href: "/experiments" },
  iterate: { tone: "primary", icon: <NiSparkle aria-hidden />, href: "/diagnosis" },
};

/** Literal class strings so Tailwind's JIT keeps each gradient variant. */
const HERO_GRADIENT: Record<Tone, string> = {
  primary: "from-primary/15 to-accent-3/10",
  secondary: "from-secondary/15 to-accent-1/10",
  "accent-1": "from-accent-1/15 to-accent-3/10",
  "accent-2": "from-accent-2/15 to-accent-4/10",
  "accent-3": "from-accent-3/15 to-primary/10",
  "accent-4": "from-accent-4/15 to-accent-2/10",
};

export default function HomePage() {
  const t = useTranslations("home");
  const tp = useTranslations("products");
  const tc = useTranslations("connections");
  const tw = useTranslations("workspace");
  const td = useTranslations("dashboard");
  const tcm = useTranslations("productCommon");
  const { configured, loading, loadError, userId, orgs, currentOrg } = useOrganization();

  const [product, setProduct] = useState<ProductWithChildren | null>(null);
  const [connection, setConnection] = useState<ConnectionRow | null>(null);
  const [progress, setProgress] = useState<Progress>({
    hasReadiness: false,
    hasDiagnosis: false,
    hasExperiment: false,
  });
  const [loaded, setLoaded] = useState(false);
  const [dataLoadError, setDataLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setDataLoadError(false);
    const supabase = createClient();
    const [{ data: row, error: prodErr }, { data: conn, error: connErr }] = await Promise.all([
      supabase
        .from("products")
        .select("*, product_objections(content), product_proofs(kind, content)")
        .eq("org_id", currentOrg.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("connections")
        .select("id, name, status, last_synced_at")
        .eq("org_id", currentOrg.id)
        .eq("provider", "meta-ads")
        .order("created_at")
        .limit(1)
        .maybeSingle(),
    ]);

    // A failed fetch must read as an error with retry — never as "no product".
    if (prodErr || connErr) {
      setDataLoadError(true);
      setLoaded(true);
      return;
    }

    const mapped = row
      ? mapProductRow(row, {
          objections: (row.product_objections as { content: string }[]) ?? [],
          proofs: (row.product_proofs as { kind: string | null; content: string }[]) ?? [],
        })
      : null;
    setProduct(mapped);
    setConnection((conn as ConnectionRow) ?? null);

    if (mapped) {
      const [readiness, diagnosis, experiments] = await Promise.all([
        supabase
          .from("diagnoses")
          .select("id", { count: "exact", head: true })
          .eq("product_id", mapped.id)
          .eq("scope", "readiness"),
        supabase
          .from("diagnoses")
          .select("id", { count: "exact", head: true })
          .eq("product_id", mapped.id)
          .neq("scope", "readiness"),
        supabase.from("experiments").select("id", { count: "exact", head: true }).eq("product_id", mapped.id),
      ]);
      if (readiness.error || diagnosis.error || experiments.error) {
        setDataLoadError(true);
        setLoaded(true);
        return;
      }
      setProgress({
        hasReadiness: (readiness.count ?? 0) > 0,
        hasDiagnosis: (diagnosis.count ?? 0) > 0,
        hasExperiment: (experiments.count ?? 0) > 0,
      });
    } else {
      setProgress({ hasReadiness: false, hasDiagnosis: false, hasExperiment: false });
    }

    setLoaded(true);
  }, [currentOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const completeness = product ? computeCompleteness(product) : null;
  const hasData = Boolean(connection);

  // Exactly one recommended action, following the journey order in docs/PRODUCT.md.
  const nextKey: NextKey = !product
    ? "product"
    : !progress.hasReadiness
      ? "readiness"
      : !progress.hasDiagnosis
        ? "diagnosis"
        : !progress.hasExperiment
          ? "experiments"
          : "iterate";
  const next = NEXT_CONFIG[nextKey];

  // The colored product map — each pillar keeps one hue across the whole app.
  const journey: { id: string; tone: Tone; icon: React.ReactNode; href: string; done?: boolean; optional?: boolean }[] =
    [
      { id: "context", tone: "primary", icon: <NiTag aria-hidden />, href: "/products", done: Boolean(product) },
      {
        id: "readiness",
        tone: "accent-4",
        icon: <NiShieldCheck aria-hidden />,
        href: "/readiness",
        done: progress.hasReadiness,
      },
      {
        id: "data",
        tone: "accent-2",
        icon: <NiDatabase aria-hidden />,
        href: "/settings/connections",
        done: hasData,
        optional: true,
      },
      {
        id: "diagnosis",
        tone: "accent-1",
        icon: <NiPulse aria-hidden />,
        href: "/diagnosis",
        done: progress.hasDiagnosis,
      },
      {
        id: "experiments",
        tone: "accent-3",
        icon: <NiFlask aria-hidden />,
        href: "/experiments",
        done: progress.hasExperiment,
      },
      { id: "creatives", tone: "accent-1", icon: <NiCamera aria-hidden />, href: "/creatives" },
      { id: "funnel", tone: "accent-4", icon: <NiChartFunnel aria-hidden />, href: "/funnel" },
      { id: "organic", tone: "secondary", icon: <NiTrendUp aria-hidden />, href: "/library", optional: true },
    ];

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <Grid size={12}>
          <Typography variant="h1" component="h1" className="mb-1">
            {t("title")}
          </Typography>
          <Typography variant="body1" className="text-text-secondary max-w-2xl">
            {t("subtitle")}
          </Typography>
        </Grid>

        {!configured && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("not-configured")}
            </Alert>
          </Grid>
        )}

        {configured && loadError && (
          <Grid size={12}>
            <Alert severity="error" className="neutral bg-background-paper/60!">
              {td("org-load-error")}
            </Alert>
          </Grid>
        )}

        {configured && !loading && !loadError && orgs.length === 0 && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("no-org")}
            </Alert>
          </Grid>
        )}

        {/* While memberships resolve, hold the space — never a blank screen. */}
        {configured && loading && (
          <Grid size={12}>
            <Skeleton variant="rounded" height={140} />
          </Grid>
        )}

        {/* The path to value. Renders its own slot, or nothing once complete. */}
        {currentOrg && userId && <ActivationChecklist orgId={currentOrg.id} userId={userId} />}

        {/* A failed data load is an error with retry, not an empty home. */}
        {currentOrg && dataLoadError && (
          <Grid size={12}>
            <LoadErrorState
              title={tcm("load-error-title")}
              description={tcm("load-error-body")}
              retryLabel={tcm("retry")}
              onRetry={load}
            />
          </Grid>
        )}

        {currentOrg && !loaded && !dataLoadError && (
          <>
            <Grid size={12}>
              <Skeleton variant="rounded" height={160} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Skeleton variant="rounded" height={180} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Skeleton variant="rounded" height={180} />
            </Grid>
          </>
        )}

        {/* ---- Spotlight: the ONE next action, dynamic on real progress. ---- */}
        {currentOrg && loaded && !dataLoadError && (
          <Grid size={12}>
            <Card component="section" className="relative isolate overflow-hidden">
              <div
                aria-hidden
                className={cn("pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br", HERO_GRADIENT[next.tone])}
              />
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -top-8 -right-6 -z-10 opacity-[0.07] [&_svg]:h-44 [&_svg]:w-44",
                  TONE[next.tone].text,
                )}
              >
                {next.icon}
              </span>
              <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <span
                  className={cn(
                    "flex h-14 w-14 flex-none items-center justify-center rounded-2xl [&_svg]:h-7 [&_svg]:w-7",
                    TONE[next.tone].softBg,
                    TONE[next.tone].text,
                  )}
                >
                  {next.icon}
                </span>
                <Box className="grow">
                  <Typography variant="body2" className="text-text-secondary mb-0.5 tracking-wide uppercase">
                    {t("next-eyebrow")}
                  </Typography>
                  <Typography variant="h4" component="h2" className="mb-1">
                    {t(`next-${nextKey}-title`)}
                  </Typography>
                  <Typography variant="body1" className="text-text-secondary max-w-2xl leading-6">
                    {t(`next-${nextKey}-body`)}
                  </Typography>
                </Box>
                <Box className="flex flex-none flex-col gap-2 sm:items-end">
                  <Button
                    variant="contained"
                    LinkComponent={Link}
                    href={next.href}
                    endIcon={<NiArrowRight size="small" aria-hidden />}
                  >
                    {t(`next-${nextKey}-cta`)}
                  </Button>
                  {product && (
                    <Button variant="text" color="grey" LinkComponent={Link} href={`/products/${product.id}`}>
                      {t("next-open-product")}
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* ---- Health cards: richer status than a tile can carry.
             Only once a product exists — before that the spotlight owns the
             single "start here" nudge, and two empty invitations would repeat it. ---- */}
        {currentOrg && loaded && !dataLoadError && product && (
          <>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card component="section" className="h-full">
                <CardContent className="flex h-full flex-col gap-3">
                  <Box className="flex flex-row items-center gap-3">
                    <span className="bg-primary/10 text-primary-dark dark:text-primary-light flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
                      <NiTag size="small" aria-hidden />
                    </span>
                    <Typography variant="h5" component="h2" className="card-title mb-0 grow">
                      {t("context-title")}
                    </Typography>
                    <Chip
                      label={tp(`status-${product.status}`)}
                      size="small"
                      variant="outlined"
                      color={PRODUCT_STATUS_COLOR[product.status] ?? "default"}
                    />
                  </Box>

                  <Typography variant="subtitle1" className="truncate">
                    {product.name}
                  </Typography>

                  {completeness && (
                    <Box className="flex flex-col gap-1.5">
                      <Box className="flex flex-row items-center gap-2">
                        <Typography variant="body2" className="text-text-secondary grow">
                          {t("context-completeness")}
                        </Typography>
                        <Typography variant="subtitle2" className="text-primary">
                          {completeness.score}%
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={completeness.score} />
                      {completeness.missing.length > 0 && (
                        <Typography variant="body2" className="text-text-secondary">
                          {t("context-next")}: {tp(`field-${completeness.missing[0]}`)}
                        </Typography>
                      )}
                    </Box>
                  )}

                  <Box className="mt-auto pt-2">
                    <Button variant="outlined" color="grey" LinkComponent={Link} href={`/products/${product.id}`}>
                      {t("context-open")}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              {!connection ? (
                <EmptyState
                  icon={<NiDatabase />}
                  title={t("meta-empty-title")}
                  description={t("meta-empty-body")}
                  action={{ label: t("meta-connect"), href: "/settings/connections" }}
                  className="h-full"
                />
              ) : (
                <Card component="section" className="h-full">
                  <CardContent className="flex h-full flex-col gap-3">
                    <Box className="flex flex-row items-center gap-3">
                      <span className="bg-accent-4/10 text-accent-4-dark dark:text-accent-4-light flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
                        <NiDatabase size="small" aria-hidden />
                      </span>
                      <Typography variant="h5" component="h2" className="card-title mb-0 grow">
                        {t("meta-title")}
                      </Typography>
                      <Chip
                        label={tc(`status-${connection.status}`)}
                        size="small"
                        variant="outlined"
                        color={CONNECTION_STATUS_COLOR[connection.status] ?? "default"}
                      />
                    </Box>

                    <Typography variant="subtitle1" className="truncate">
                      {connection.name}
                    </Typography>

                    <Typography variant="body2" className="text-text-secondary">
                      {connection.last_synced_at
                        ? t("meta-synced-at", { when: new Date(connection.last_synced_at).toLocaleString() })
                        : t("meta-never-synced")}
                    </Typography>

                    <Box className="mt-auto pt-2">
                      <Button variant="outlined" color="grey" LinkComponent={Link} href="/settings/connections">
                        {t("meta-manage")}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Grid>
          </>
        )}

        {/* ---- The colored journey map: orientation + navigation across every
             pillar, with honest done-state. Surfaces the paths the home used
             to hide (experiments, creatives, funnel, organic). ---- */}
        {currentOrg && loaded && !dataLoadError && (
          <>
            <Grid size={12} className="mt-2">
              <Typography variant="h5" component="h2" className="card-title mb-0">
                {t("journey-title")}
              </Typography>
              <Typography variant="body2" className="text-text-secondary max-w-2xl">
                {t("journey-subtitle")}
              </Typography>
            </Grid>

            {journey.map((tile) => (
              <Grid key={tile.id} size={{ xs: 12, sm: 6, xl: 3 }}>
                <Card
                  component={Link}
                  href={tile.href}
                  className="group hover:shadow-darker-sm block h-full no-underline transition-all hover:-translate-y-0.5"
                >
                  <CardContent className="flex h-full flex-col gap-3">
                    <Box className="flex flex-row items-start justify-between gap-2">
                      <span
                        className={cn(
                          "flex h-11 w-11 flex-none items-center justify-center rounded-2xl",
                          TONE[tile.tone].softBg,
                          TONE[tile.tone].text,
                        )}
                      >
                        {tile.icon}
                      </span>
                      {tile.done ? (
                        <span className="bg-success/10 text-success inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5">
                          <NiCheck size="small" aria-hidden />
                          <span className="text-xs font-medium tracking-wide uppercase">{t("journey-done")}</span>
                        </span>
                      ) : tile.optional ? (
                        <Chip label={t("journey-optional")} size="small" variant="outlined" color="grey" />
                      ) : null}
                    </Box>

                    <Box className="grow">
                      <Typography variant="subtitle1" component="h3" className="mb-0.5">
                        {tw(`stage-${tile.id}`)}
                      </Typography>
                      <Typography variant="body2" className="text-text-secondary leading-6">
                        {t(`journey-desc-${tile.id}`)}
                      </Typography>
                    </Box>

                    <span
                      aria-hidden
                      className={cn(
                        "inline-flex translate-x-0 items-center transition-transform group-hover:translate-x-1",
                        TONE[tile.tone].text,
                      )}
                    >
                      <NiArrowRight size="small" />
                    </span>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </>
        )}
      </Grid>
    </Grid>
  );
}
