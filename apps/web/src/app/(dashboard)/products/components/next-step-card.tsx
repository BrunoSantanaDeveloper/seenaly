"use client";

import type { CompletenessField } from "../lib/completeness";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Box, Button, Card, CardContent, Typography } from "@mui/material";

import NiPulse from "@/icons/nexture/ni-pulse";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";

/**
 * Job: the user just finished creating a product and asks "what now?".
 *
 * The answer is NOT "fill more fields" — it is the aha moment. A completeness
 * percentage alone was the wrong hero: it points at form-filling, and a
 * beginner can never reach 100% (they don't have every number), so it reads as
 * permanent failure. Here the ONE next action leads, and remaining context is
 * offered as "what would sharpen it" — each item with the reason it matters,
 * never as a score to chase.
 *
 * Which action is "the one" follows the journey in docs/PRODUCT.md phase 7:
 * readiness comes BEFORE the campaign diagnosis. Auditing the structure costs
 * no media budget, so a user who has not done it is sent there first; once a
 * verdict exists, the diagnosis takes over as the primary action.
 */
export default function ProductNextStepCard({
  productId,
  ready,
  missing,
  hasReadiness,
}: {
  productId: string;
  /** Essential context (name + promise + audience) is filled. */
  ready: boolean;
  /** Context fields still empty, most valuable first. */
  missing: CompletenessField[];
  /** A readiness verdict already exists for this product. */
  hasReadiness: boolean;
}) {
  const t = useTranslations("products");
  // Only the few that actually change the answer — a long list is noise.
  const suggestions = missing.slice(0, 3);

  // Exactly ONE primary action per state, plus one quiet alternative — no two
  // filled/outlined buttons competing (the paralysis the user reported). New
  // products no longer land here at all; this is the returning-user surface.
  const primary = hasReadiness
    ? { href: `/diagnosis?product=${productId}`, icon: <NiPulse size="small" />, label: t("next-step-cta") }
    : {
        href: `/readiness?product=${productId}`,
        icon: <NiShieldCheck size="small" />,
        label: t("next-step-cta-readiness"),
      };
  const secondary = hasReadiness
    ? { href: `/readiness?product=${productId}`, label: t("next-step-cta-readiness-again") }
    : { href: `/diagnosis?product=${productId}`, label: t("next-step-cta") };

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-3">
        <Box className="flex flex-row items-center gap-3">
          <span className="bg-primary/10 text-primary flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
            <NiPulse size="medium" />
          </span>
          <Box className="grow">
            <Typography variant="h5" component="h2" className="card-title mb-0">
              {!hasReadiness
                ? t("next-step-title-readiness")
                : ready
                  ? t("next-step-title-ready")
                  : t("next-step-title-incomplete")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {!hasReadiness
                ? t("next-step-body-readiness")
                : ready
                  ? t("next-step-body-ready")
                  : t("next-step-body-incomplete")}
            </Typography>
          </Box>
        </Box>

        <Box className="flex flex-row flex-wrap items-center gap-1">
          <Button variant="contained" color="primary" href={primary.href} LinkComponent={Link} startIcon={primary.icon}>
            {primary.label}
          </Button>
          {/* Quiet alternative — everything stays one click away, nothing is
              gated, but only one action reads as "the" next step. */}
          <Button variant="text" color="grey" href={secondary.href} LinkComponent={Link}>
            {secondary.label}
          </Button>
        </Box>

        {suggestions.length > 0 && (
          <Box className="flex flex-col gap-1">
            <Typography variant="body2" className="text-text-secondary">
              {t("next-step-improve")}
            </Typography>
            <Box component="ul" className="m-0 list-disc space-y-0.5 pl-5">
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
