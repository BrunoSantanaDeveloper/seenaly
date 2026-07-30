"use client";

import DimensionRings from "./readiness-progress";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Alert, Box, Button, Typography } from "@mui/material";

import NiScreen from "@/icons/nexture/ni-screen";
import NiTag from "@/icons/nexture/ni-tag";
import type { ReadinessEvaluation } from "@/lib/readiness/checklist";

/**
 * The free, deterministic half of the readiness layer.
 *
 * These signals are computed locally from the checklist — no LLM call, no
 * credits, instant as the user ticks. That matters: the user gets real value
 * (a named list of what would waste their ad budget) BEFORE deciding to spend
 * a credit on the full verdict.
 *
 * It is a count plus a reasoned list, never a proprietary 0–100 score — the
 * user must be able to disagree with a specific line, not with a number they
 * cannot inspect (docs/PRODUCT.md: explainable signals precede any score).
 */
export default function ReadinessSignals({
  evaluation,
  productId = null,
}: {
  evaluation: ReadinessEvaluation;
  /** Enables the fix-it doors: no-page/no-price are corrected on the context
   *  screen, and a named problem with no door is a dead end. */
  productId?: string | null;
}) {
  const t = useTranslations("readiness");
  const hasBlockers = evaluation.blockers.length > 0;

  // The two blockers whose fix lives on the CONTEXT screen, not here. The
  // ?focus= param opens the owning section and scrolls to it.
  const fixLinks =
    productId == null
      ? []
      : [
          evaluation.blockers.includes("no-page")
            ? {
                key: "no-page",
                href: `/products/${productId}?focus=landingPageUrl`,
                label: t("blocker-fix-page-cta"),
                icon: <NiScreen size="small" />,
              }
            : null,
          evaluation.blockers.includes("no-price")
            ? {
                key: "no-price",
                href: `/products/${productId}?focus=price`,
                label: t("blocker-fix-price-cta"),
                icon: <NiTag size="small" />,
              }
            : null,
        ].filter((link): link is NonNullable<typeof link> => link !== null);

  return (
    <Box className="flex flex-col gap-4">
      {/* The honest scoreboard first: how much of the structure the scan proved.
          It leads because it is the one number the user cannot inflate. */}
      <DimensionRings evaluation={evaluation} />
      {hasBlockers ? (
        <Alert severity="warning" className="neutral bg-background-paper/60!">
          <Typography variant="subtitle2">{t("blockers-title", { count: evaluation.blockers.length })}</Typography>
          <Typography variant="body2" className="mb-1">
            {t("blockers-body")}
          </Typography>
          {/* A real bulleted list: `flex flex-col` on a <ul> suppresses the
              markers, and this is the list the user actually scans. */}
          <Box component="ul" className="m-0 list-disc space-y-0.5 pl-5">
            {evaluation.blockers.map((blocker) => (
              <Typography key={blocker} component="li" variant="body2">
                {t(`blocker-${blocker}`)}
              </Typography>
            ))}
          </Box>
          {fixLinks.length > 0 && (
            <Box className="mt-2 flex flex-row flex-wrap gap-1">
              {fixLinks.map((link) => (
                <Button
                  key={link.key}
                  size="small"
                  variant="outlined"
                  color="grey"
                  startIcon={link.icon}
                  href={link.href}
                  LinkComponent={Link}
                >
                  {link.label}
                </Button>
              ))}
            </Box>
          )}
        </Alert>
      ) : (
        <Alert severity="success" className="neutral bg-background-paper/60!">
          <Typography variant="subtitle2">{t("no-blockers-title")}</Typography>
          <Typography variant="body2">{t("no-blockers-body")}</Typography>
        </Alert>
      )}
      <Typography variant="body2" className="text-text-secondary">
        {t("confirmed-count", { confirmed: evaluation.confirmed, total: evaluation.total })}
      </Typography>
    </Box>
  );
}
