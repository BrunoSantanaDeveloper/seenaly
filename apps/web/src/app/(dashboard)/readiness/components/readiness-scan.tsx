"use client";

import { useTranslations } from "next-intl";

import { Alert, Box, Button, Card, CardContent, Chip, Divider, Typography } from "@mui/material";

import NiSearch from "@/icons/nexture/ni-search";
import type { ScanSignals } from "@/lib/readiness/scan-analyze";

export interface ScanView {
  requestedUrl: string;
  finalUrl: string | null;
  ok: boolean;
  statusCode: number | null;
  error: string | null;
  createdAt: string;
  signals: ScanSignals | null;
}

/**
 * The OBSERVED half of readiness: what is actually on the page, next to what
 * the user declared.
 *
 * It deliberately does NOT tick checklist boxes. Where declaration and
 * observation disagree, that disagreement is the most valuable thing on the
 * screen — silently "correcting" the user would destroy the signal and take
 * away their authorship of their own answers.
 *
 * Enrichment, never a gate: with no URL, an unreachable site or no scan at all,
 * the verdict still works from the declared checklist.
 */
export default function ReadinessScan({
  scan,
  hasUrl,
  onScan,
  busy,
}: {
  scan: ScanView | null;
  hasUrl: boolean;
  onScan: () => void;
  busy?: boolean;
}) {
  const t = useTranslations("readiness");

  const fact = (label: string, value: React.ReactNode, tone?: "ok" | "warn" | "bad") => (
    <Box className="flex flex-row items-start justify-between gap-3 py-1">
      <Typography variant="body2" className="text-text-secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        className={`text-right ${tone === "ok" ? "text-success" : tone === "bad" ? "text-error" : tone === "warn" ? "text-warning" : ""}`}
      >
        {value}
      </Typography>
    </Box>
  );

  /** Green when the observed state is the desired one, amber otherwise —
   *  amber, not red: a missing tag is worth fixing, it is not a catastrophe.
   *  The two genuinely catastrophic findings get their own Alert above. */
  const flag = (good: boolean) => (good ? ("ok" as const) : ("warn" as const));

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-4">
        <Box className="flex flex-row flex-wrap items-center gap-3">
          <span className="bg-primary/10 text-primary flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
            <NiSearch size="medium" />
          </span>
          <Box className="grow">
            <Typography variant="h5" component="h2" className="card-title mb-0">
              {t("scan-title")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("scan-body")}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="grey"
            startIcon={<NiSearch size="small" />}
            onClick={onScan}
            disabled={busy || !hasUrl}
            className="flex-none"
          >
            {busy ? t("scanning") : scan ? t("scan-again") : t("scan-now")}
          </Button>
        </Box>

        {/* Enrichment is optional — say why the button is off, never just disable it. */}
        {!hasUrl && (
          <Alert severity="info" className="neutral bg-background-paper/60!">
            {t("scan-no-url")}
          </Alert>
        )}

        {hasUrl && !scan && (
          <Alert severity="info" className="neutral bg-background-paper/60!">
            {t("scan-never-run")}
          </Alert>
        )}

        {scan && !scan.ok && (
          <Alert severity="warning" className="neutral bg-background-paper/60!">
            <Typography variant="subtitle2">{t("scan-failed-title")}</Typography>
            <Typography variant="body2">
              {t(`scan-error-${scan.error ?? "unreachable"}`)}
              {scan.statusCode ? ` (HTTP ${scan.statusCode})` : ""}
            </Typography>
            <Typography variant="body2" className="mt-1">
              {t("scan-failed-hint")}
            </Typography>
          </Alert>
        )}

        {scan?.ok && scan.signals && (
          <>
            {/* The single finding that silently kills organic acquisition. */}
            {scan.signals.seo.noindex && (
              <Alert severity="error" className="neutral bg-background-paper/60!">
                <Typography variant="subtitle2">{t("scan-noindex-title")}</Typography>
                <Typography variant="body2">{t("scan-noindex-body")}</Typography>
              </Alert>
            )}
            {scan.signals.discovery.robotsDisallowsAll && (
              <Alert severity="error" className="neutral bg-background-paper/60!">
                <Typography variant="subtitle2">{t("scan-robots-blocked-title")}</Typography>
                <Typography variant="body2">{t("scan-robots-blocked-body")}</Typography>
              </Alert>
            )}
            {/* Never state absence as fact on a client-rendered page. */}
            {scan.signals.jsRenderedLikely && (
              <Alert severity="info" className="neutral bg-background-paper/60!">
                <Typography variant="subtitle2">{t("scan-js-title")}</Typography>
                <Typography variant="body2">{t("scan-js-body")}</Typography>
              </Alert>
            )}

            <Divider />
            <Box className="flex flex-col">
              <Typography variant="subtitle2" className="text-text-secondary mb-1 uppercase">
                {t("scan-group-seo")}
              </Typography>
              {fact(
                t("scan-fact-title"),
                scan.signals.seo.title
                  ? `${scan.signals.seo.title} (${scan.signals.seo.titleLength})`
                  : t("scan-absent"),
                flag(Boolean(scan.signals.seo.title)),
              )}
              {fact(
                t("scan-fact-description"),
                scan.signals.seo.metaDescription
                  ? `${scan.signals.seo.metaDescription.slice(0, 90)}${scan.signals.seo.metaDescription.length > 90 ? "…" : ""} (${scan.signals.seo.metaDescriptionLength})`
                  : t("scan-absent"),
                flag(Boolean(scan.signals.seo.metaDescription)),
              )}
              {fact(
                t("scan-fact-canonical"),
                scan.signals.seo.canonical ?? t("scan-absent"),
                flag(Boolean(scan.signals.seo.canonical)),
              )}
              {fact(t("scan-fact-h1"), String(scan.signals.seo.h1Count), flag(scan.signals.seo.h1Count === 1))}
              {fact(
                t("scan-fact-og"),
                [
                  scan.signals.seo.ogTitle && "title",
                  scan.signals.seo.ogDescription && "description",
                  scan.signals.seo.ogImage && "image",
                ]
                  .filter(Boolean)
                  .join(", ") || t("scan-absent"),
                flag(scan.signals.seo.ogTitle && scan.signals.seo.ogImage),
              )}
              {fact(
                t("scan-fact-structured"),
                scan.signals.seo.structuredDataTypes.join(", ") || t("scan-absent"),
                flag(scan.signals.seo.structuredDataTypes.length > 0),
              )}
              {fact(
                t("scan-fact-viewport"),
                scan.signals.seo.hasViewport ? t("scan-yes") : t("scan-no"),
                flag(scan.signals.seo.hasViewport),
              )}
              {fact(t("scan-fact-https"), scan.signals.https ? t("scan-yes") : t("scan-no"), flag(scan.signals.https))}
            </Box>

            <Divider />
            <Box className="flex flex-col">
              <Typography variant="subtitle2" className="text-text-secondary mb-1 uppercase">
                {t("scan-group-discovery")}
              </Typography>
              {fact(
                t("scan-fact-robots"),
                t(`scan-state-${scan.signals.discovery.robotsTxt}`),
                flag(scan.signals.discovery.robotsTxt === "found"),
              )}
              {fact(
                t("scan-fact-sitemap"),
                t(`scan-state-${scan.signals.discovery.sitemapXml}`),
                flag(scan.signals.discovery.sitemapXml === "found"),
              )}
            </Box>

            <Divider />
            <Box className="flex flex-col">
              <Typography variant="subtitle2" className="text-text-secondary mb-1 uppercase">
                {t("scan-group-tracking")}
              </Typography>
              {fact(
                "Meta Pixel",
                scan.signals.tracking.metaPixel ? t("scan-yes") : t("scan-no"),
                flag(scan.signals.tracking.metaPixel),
              )}
              {fact("GA4", scan.signals.tracking.ga4 ? t("scan-yes") : t("scan-no"))}
              {fact("Google Tag Manager", scan.signals.tracking.gtm ? t("scan-yes") : t("scan-no"))}
              {/* CAPI is server-side: no scan can ever see it. Say so. */}
              <Typography variant="body2" className="text-text-secondary mt-1">
                {t("scan-capi-note")}
              </Typography>
            </Box>

            <Box className="flex flex-row flex-wrap items-center gap-2">
              <Chip label={t("scan-observed")} size="small" variant="outlined" color="primary" />
              <Typography variant="body2" className="text-text-secondary">
                {t("scan-generated-at", {
                  when: new Date(scan.createdAt).toLocaleString(),
                  url: scan.finalUrl ?? scan.requestedUrl,
                })}
              </Typography>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
