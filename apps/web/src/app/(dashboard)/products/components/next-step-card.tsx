"use client";

import type { CompletenessField } from "../lib/completeness";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Box, Button, Card, CardContent, Typography } from "@mui/material";

import { TONE, type Tone } from "@/components/marketing/tone";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import { cn } from "@/lib/utils";

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
  onFieldClick,
}: {
  productId: string;
  /** Essential context (name + promise + audience) is filled. */
  ready: boolean;
  /** Context fields still empty, most valuable first. */
  missing: CompletenessField[];
  /** A readiness verdict already exists for this product. */
  hasReadiness: boolean;
  /** Jump to the form section holding this field (opens + scrolls). */
  onFieldClick?: (field: CompletenessField) => void;
}) {
  const t = useTranslations("products");
  // Only the few that actually change the answer — a long list is noise.
  const suggestions = missing.slice(0, 3);

  // Exactly ONE primary action per state, plus one quiet alternative — no two
  // filled/outlined buttons competing (the paralysis the user reported). New
  // products no longer land here at all; this is the returning-user surface.
  const primary = hasReadiness
    ? { href: `/products/${productId}/diagnosis`, icon: <NiPulse size="small" />, label: t("next-step-cta") }
    : {
        href: `/products/${productId}/readiness`,
        icon: <NiShieldCheck size="small" />,
        label: t("next-step-cta-readiness"),
      };
  const secondary = hasReadiness
    ? {
        href: `/products/${productId}/readiness`,
        icon: <NiShieldCheck size="small" />,
        label: t("next-step-cta-readiness-again"),
      }
    : { href: `/products/${productId}/diagnosis`, icon: <NiPulse size="small" />, label: t("next-step-cta") };

  // The card wears the hue of the action it leads with — the same colour that
  // pillar carries on the home journey map and in the workspace rail. The CTA
  // button stays primary: colour marks the category, primary marks the action.
  const headTone: Tone = hasReadiness ? "accent-1" : "accent-4";

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-3">
        {/* Two columns on one row: identity (icon + title + subtitle) on the
            left, the actions on the right — the CTAs use the dead space beside
            the text instead of adding a second row, so the card stays compact.
            Below md they stack back into a column. */}
        <Box className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Box className="flex min-w-0 flex-row items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 flex-none items-center justify-center rounded-2xl",
                TONE[headTone].softBg,
                TONE[headTone].text,
              )}
            >
              {hasReadiness ? <NiPulse size="medium" aria-hidden /> : <NiShieldCheck size="medium" aria-hidden />}
            </span>
            <Box className="min-w-0">
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

          <Box className="flex flex-none flex-row flex-wrap items-center gap-2">
            <Button
              variant="contained"
              color="primary"
              href={primary.href}
              LinkComponent={Link}
              startIcon={primary.icon}
            >
              {primary.label}
            </Button>
            {/* Quiet alternative — subordinate to the primary but still shaped
                like a button: bare gray text kept reading as a caption, not a
                clickable route (the same affordance failure fixed on the
                readiness disclosure). */}
            <Button
              variant="outlined"
              color="grey"
              href={secondary.href}
              LinkComponent={Link}
              startIcon={secondary.icon}
            >
              {secondary.label}
            </Button>
          </Box>
        </Box>

        {suggestions.length > 0 && (
          <Box className="flex flex-col gap-1">
            <Typography variant="body2" className="text-text-secondary">
              {t("next-step-improve")}
            </Typography>
            {/* Each suggestion IS a field of the form right below — so each row
                is a door to it, not inert prose. The field name is the visible
                click target; the why stays as supporting text. */}
            <Box className="flex flex-col items-start gap-0.5">
              {suggestions.map((field) => (
                <Typography key={field} component="p" variant="body2" className="text-text-secondary mb-0">
                  <Button
                    variant="text"
                    color="primary"
                    size="small"
                    className="min-w-0 p-0 align-baseline"
                    onClick={() => onFieldClick?.(field)}
                  >
                    {t(`field-${field}`)}
                  </Button>{" "}
                  — {t(`why-${field}`)}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
