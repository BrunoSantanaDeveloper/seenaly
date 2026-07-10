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
import EmptyState from "@/components/product/empty-state";
import NiPlug from "@/icons/nexture/ni-plug";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiTag from "@/icons/nexture/ni-tag";
import { createClient } from "@flyee/auth/client";

/**
 * Seenaly's home — the post-login landing (DEFAULTS.appRoot).
 *
 * Who: an org member, most often a solo operator. Job: "what do I do now?"
 * Success: they leave with ONE clear next action (and, once the diagnostic
 * engine ships, with a diagnosis).
 *
 * Deliberately NOT a metrics dashboard: it answers a question with real state
 * (context health, data status, the destination) instead of decorating fake
 * numbers. Zero-data views are EmptyStates, never blanks. The activation
 * checklist owns the completion-drive ring, so nothing else competes with it.
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

export default function HomePage() {
  const t = useTranslations("home");
  const tp = useTranslations("products");
  const tc = useTranslations("connections");
  const { configured, loading, userId, orgs, currentOrg } = useOrganization();

  const [product, setProduct] = useState<ProductWithChildren | null>(null);
  const [connection, setConnection] = useState<ConnectionRow | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const supabase = createClient();
    const [{ data: row }, { data: conn }] = await Promise.all([
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
    setProduct(
      row
        ? mapProductRow(row, {
            objections: (row.product_objections as { content: string }[]) ?? [],
            proofs: (row.product_proofs as { kind: string | null; content: string }[]) ?? [],
          })
        : null,
    );
    setConnection((conn as ConnectionRow) ?? null);
    setLoaded(true);
  }, [currentOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const completeness = product ? computeCompleteness(product) : null;

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

        {configured && !loading && orgs.length === 0 && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("no-org")}
            </Alert>
          </Grid>
        )}

        {/* The path to value. Renders its own slot, or nothing once complete. */}
        {currentOrg && userId && <ActivationChecklist orgId={currentOrg.id} userId={userId} />}

        {currentOrg && !loaded && (
          <>
            <Grid size={{ xs: 12, md: 6 }}>
              <Skeleton variant="rounded" height={180} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Skeleton variant="rounded" height={180} />
            </Grid>
          </>
        )}

        {/* ---- Product context: the heart. Zero data => an invitation. ---- */}
        {currentOrg && loaded && (
          <Grid size={{ xs: 12, md: 6 }}>
            {!product ? (
              <EmptyState
                icon={<NiTag />}
                title={t("context-empty-title")}
                description={t("context-empty-body")}
                action={{ label: t("context-empty-cta"), href: "/products/new" }}
                className="h-full"
              />
            ) : (
              <Card component="section" className="h-full">
                <CardContent className="flex h-full flex-col gap-3">
                  <Typography variant="h5" component="h2" className="card-title">
                    {t("context-title")}
                  </Typography>

                  <Box className="flex flex-row items-center gap-2">
                    <Typography variant="subtitle1" className="grow truncate">
                      {product.name}
                    </Typography>
                    <Chip
                      label={tp(`status-${product.status}`)}
                      size="small"
                      variant="outlined"
                      color={PRODUCT_STATUS_COLOR[product.status] ?? "default"}
                    />
                  </Box>

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
            )}
          </Grid>
        )}

        {/* ---- Meta data: an enrichment, never a gate. ---- */}
        {currentOrg && loaded && (
          <Grid size={{ xs: 12, md: 6 }}>
            {!connection ? (
              <EmptyState
                icon={<NiPlug />}
                title={t("meta-empty-title")}
                description={t("meta-empty-body")}
                action={{ label: t("meta-connect"), href: "/settings/connections" }}
                className="h-full"
              />
            ) : (
              <Card component="section" className="h-full">
                <CardContent className="flex h-full flex-col gap-3">
                  <Typography variant="h5" component="h2" className="card-title">
                    {t("meta-title")}
                  </Typography>

                  <Box className="flex flex-row items-center gap-2">
                    <Typography variant="subtitle1" className="grow truncate">
                      {connection.name}
                    </Typography>
                    <Chip
                      label={tc(`status-${connection.status}`)}
                      size="small"
                      variant="outlined"
                      color={CONNECTION_STATUS_COLOR[connection.status] ?? "default"}
                    />
                  </Box>

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
        )}

        {/* ---- The destination. Honest: the engine ships in phase 3. ---- */}
        {currentOrg && loaded && (
          <Grid size={12}>
            <Card component="section">
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <span className="bg-primary/10 text-primary flex h-12 w-12 flex-none items-center justify-center rounded-2xl">
                  <NiPulse size="medium" />
                </span>
                <Box className="flex flex-col items-start gap-1">
                  <Typography variant="h5" component="h2" className="card-title">
                    {t("diagnosis-title")}
                  </Typography>
                  <Typography variant="body1" className="text-text-secondary max-w-3xl leading-6">
                    {t("diagnosis-body")}
                  </Typography>
                  <Button
                    variant="contained"
                    className="mt-3"
                    LinkComponent={Link}
                    href="/diagnosis"
                    disabled={!product}
                  >
                    {t("diagnosis-cta")}
                  </Button>
                  {!product && (
                    <Typography variant="body2" className="text-text-secondary mt-1">
                      {t("diagnosis-needs-product")}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}
