"use client";

import { useTranslations } from "next-intl";

import { Alert, Box, Typography } from "@mui/material";

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
export default function ReadinessSignals({ evaluation }: { evaluation: ReadinessEvaluation }) {
  const t = useTranslations("readiness");
  const hasBlockers = evaluation.blockers.length > 0;

  return (
    <Box className="flex flex-col gap-2">
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
