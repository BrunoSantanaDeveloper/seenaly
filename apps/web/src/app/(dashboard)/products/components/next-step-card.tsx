"use client";

import type { CompletenessField } from "../lib/completeness";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Box, Button, Card, CardContent, Typography } from "@mui/material";

import NiPulse from "@/icons/nexture/ni-pulse";

/**
 * Job: the user just finished creating a product and asks "what now?".
 *
 * The answer is NOT "fill more fields" — it is the aha moment: run the first
 * diagnosis. A completeness percentage alone was the wrong hero: it points at
 * form-filling, and a beginner can never reach 100% (they don't have every
 * number), so it reads as permanent failure. Here the ONE next action leads,
 * and remaining context is offered as "what would sharpen it" — each item with
 * the reason it matters, never as a score to chase.
 */
export default function ProductNextStepCard({
  productId,
  ready,
  missing,
}: {
  productId: string;
  /** Essential context (name + promise + audience) is filled. */
  ready: boolean;
  /** Context fields still empty, most valuable first. */
  missing: CompletenessField[];
}) {
  const t = useTranslations("products");
  // Only the few that actually change the answer — a long list is noise.
  const suggestions = missing.slice(0, 3);

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-3">
        <Box className="flex flex-row items-center gap-3">
          <span className="bg-primary/10 text-primary flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
            <NiPulse size="medium" />
          </span>
          <Box className="grow">
            <Typography variant="h5" component="h2" className="card-title mb-0">
              {ready ? t("next-step-title-ready") : t("next-step-title-incomplete")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {ready ? t("next-step-body-ready") : t("next-step-body-incomplete")}
            </Typography>
          </Box>
        </Box>

        <Box className="flex flex-row flex-wrap gap-2">
          <Button
            variant="contained"
            color="primary"
            href={`/diagnosis?product=${productId}`}
            LinkComponent={Link}
            startIcon={<NiPulse size="small" />}
          >
            {t("next-step-cta")}
          </Button>
        </Box>

        {suggestions.length > 0 && (
          <Box className="flex flex-col gap-1">
            <Typography variant="body2" className="text-text-secondary">
              {t("next-step-improve")}
            </Typography>
            <Box component="ul" className="m-0 flex flex-col gap-0.5 pl-4">
              {suggestions.map((field) => (
                <Typography key={field} component="li" variant="body2" className="text-text-secondary">
                  <span className="text-text-primary">{t(`field-${field}`)}</span> — {t(`why-${field}`)}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
