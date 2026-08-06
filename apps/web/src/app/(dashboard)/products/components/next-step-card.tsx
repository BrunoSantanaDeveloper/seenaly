"use client";

import type { CompletenessField } from "../lib/completeness";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Box, Button, Card, CardContent, Typography } from "@mui/material";

import { TONE, type Tone } from "@/components/marketing/tone";
import NiCamera from "@/icons/nexture/ni-camera";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiRocket from "@/icons/nexture/ni-rocket";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiTag from "@/icons/nexture/ni-tag";
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
 * Which action is "the one" follows the product journey: essential context,
 * readiness, creative evidence, then diagnosis. This keeps paid hypotheses
 * downstream from the product structure and organic creative signal.
 */
export default function ProductNextStepCard({
  productId,
  ready,
  missing,
  hasReadiness,
  hasCreativeEvidence,
  hasLaunchPlan,
  onFieldClick,
}: {
  productId: string;
  /** Essential context (name + promise + audience) is filled. */
  ready: boolean;
  /** Context fields still empty, most valuable first. */
  missing: CompletenessField[];
  /** A readiness verdict already exists for this product. */
  hasReadiness: boolean;
  /** A creative plan or at least one tagged creative exists for this product. */
  hasCreativeEvidence: boolean;
  /** A Launch Plan already exists for this product. */
  hasLaunchPlan: boolean;
  /** Jump to the form section holding this field (opens + scrolls). */
  onFieldClick?: (field: CompletenessField) => void;
}) {
  const t = useTranslations("products");
  // Only the few that actually change the answer — a long list is noise.
  const suggestions = missing.slice(0, 3);

  // Exactly ONE primary action per state, plus one quiet alternative — no two
  // filled/outlined buttons competing (the paralysis the user reported). New
  // products no longer land here at all; this is the returning-user surface.
  // Same order as lib/journey.ts; kept as its own local ladder (not the
  // shared helper) because this card never learns whether campaign data or a
  // paid diagnosis exist — its terminal state is simply "you can launch".
  const stage = !ready
    ? "context"
    : !hasReadiness
      ? "readiness"
      : !hasCreativeEvidence
        ? "creative"
        : !hasLaunchPlan
          ? "launch"
          : "diagnosis";
  const primary =
    stage === "context"
      ? {
          icon: <NiTag size="small" />,
          label: t("next-step-context-cta"),
          onClick: () => suggestions[0] && onFieldClick?.(suggestions[0]),
        }
      : stage === "readiness"
        ? {
            href: `/products/${productId}/readiness`,
            icon: <NiShieldCheck size="small" />,
            label: t("next-step-cta-readiness"),
          }
        : stage === "creative"
          ? {
              href: `/products/${productId}/creatives`,
              icon: <NiCamera size="small" />,
              label: t("next-step-cta-creative"),
            }
          : stage === "launch"
            ? {
                href: `/products/${productId}/launch`,
                icon: <NiRocket size="small" />,
                label: t("next-step-cta-launch"),
              }
            : {
                href: `/products/${productId}/diagnosis`,
                icon: <NiPulse size="small" />,
                label: t("next-step-cta"),
              };
  const secondary =
    stage === "diagnosis"
      ? {
          href: `/products/${productId}/readiness`,
          icon: <NiShieldCheck size="small" />,
          label: t("next-step-cta-readiness-again"),
        }
      : {
          href: `/products/${productId}/diagnosis`,
          icon: <NiPulse size="small" />,
          label: t("next-step-cta"),
        };

  // The card wears the hue of the action it leads with — the same colour that
  // pillar carries on the home journey map and in the workspace rail. The CTA
  // button stays primary: colour marks the category, primary marks the action.
  const headTone: Tone =
    stage === "context" ? "primary" : stage === "readiness" ? "accent-4" : stage === "launch" ? "accent-2" : "accent-1";

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
              {stage === "context" ? (
                <NiTag size="medium" aria-hidden />
              ) : stage === "readiness" ? (
                <NiShieldCheck size="medium" aria-hidden />
              ) : stage === "creative" ? (
                <NiCamera size="medium" aria-hidden />
              ) : stage === "launch" ? (
                <NiRocket size="medium" aria-hidden />
              ) : (
                <NiPulse size="medium" aria-hidden />
              )}
            </span>
            <Box className="min-w-0">
              <Typography variant="h5" component="h2" className="card-title mb-0">
                {stage === "context"
                  ? t("next-step-title-context")
                  : stage === "readiness"
                    ? t("next-step-title-readiness")
                    : stage === "creative"
                      ? t("next-step-title-creative")
                      : stage === "launch"
                        ? t("next-step-title-launch")
                        : t("next-step-title-ready")}
              </Typography>
              <Typography variant="body2" className="text-text-secondary">
                {stage === "context"
                  ? t("next-step-body-context")
                  : stage === "readiness"
                    ? t("next-step-body-readiness")
                    : stage === "creative"
                      ? t("next-step-body-creative")
                      : stage === "launch"
                        ? t("next-step-body-launch")
                        : t("next-step-body-ready")}
              </Typography>
            </Box>
          </Box>

          <Box className="flex flex-none flex-row flex-wrap items-center gap-2">
            <Button
              className="min-h-11!"
              variant="contained"
              color="primary"
              href={"href" in primary ? primary.href : undefined}
              LinkComponent={"href" in primary ? Link : undefined}
              onClick={"onClick" in primary ? primary.onClick : undefined}
              startIcon={primary.icon}
            >
              {primary.label}
            </Button>
            {/* Quiet alternative — subordinate to the primary but still shaped
                like a button: bare gray text kept reading as a caption, not a
                clickable route (the same affordance failure fixed on the
                readiness disclosure). */}
            <Button
              className="min-h-11!"
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
