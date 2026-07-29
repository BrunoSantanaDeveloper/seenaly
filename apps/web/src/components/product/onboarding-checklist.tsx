"use client";

import Link from "next/link";

import { Box, Button, Card, CardContent, Chip, Divider, Typography } from "@mui/material";

import ActivationProgress from "@/components/product/activation-progress";
import NiCheck from "@/icons/nexture/ni-check";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";
import NiCross from "@/icons/nexture/ni-cross";
import { cn } from "@/lib/utils";
import { computeProgress, type OnboardingStateRow, type OnboardingStep } from "@flyee/onboarding";

/**
 * Activation checklist (the Mural pattern: replacing pop-ups/banners with a
 * persistent checklist drove a +10% one-week retention lift). Shows real
 * progress (completion drive), nudges the next step, and survives dismissal
 * — it can be reopened, never lost. Steps are DECLARED by the project;
 * `state` comes from @flyee/onboarding.
 */
export default function OnboardingChecklist({
  title = "Get set up",
  description = "A few steps to your first result.",
  dismissLabel = "Dismiss",
  optionalLabel = "Optional",
  steps,
  state,
  onDismiss,
  className,
}: {
  title?: string;
  /** One-line promise under the title. Pass a translated string. */
  description?: string;
  /** Accessible name for the dismiss (X) button. Pass a translated string. */
  dismissLabel?: string;
  /** Heading that separates enrichment from the required activation path. */
  optionalLabel?: string;
  steps: OnboardingStep[];
  state: OnboardingStateRow;
  onDismiss?: () => void;
  className?: string;
}) {
  const progress = computeProgress(steps, state);
  if (state.dismissed || progress.complete) return null;

  const isDone = (step: OnboardingStep) => step.done ?? state.completedSteps.includes(step.key);

  return (
    <Card component="section" className={className}>
      <CardContent className="flex flex-col gap-4">
        <Box className="flex flex-row items-start justify-between gap-3">
          <Box>
            <Typography variant="h5" component="h2" className="card-title">
              {title}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {description}
            </Typography>
          </Box>
          <Box className="flex flex-row items-center gap-2">
            <ActivationProgress done={progress.done} total={progress.total} />
            {onDismiss && (
              <Button
                className="icon-only size-11! min-w-11!"
                size="small"
                color="grey"
                variant="text"
                aria-label={dismissLabel}
                onClick={onDismiss}
              >
                <NiCross size="medium" />
              </Button>
            )}
          </Box>
        </Box>

        <Box className="flex flex-col gap-1">
          {steps
            .filter((step) => step.required !== false)
            .map((step) => {
              const done = isDone(step);
              const body = (
                <Box
                  className={cn(
                    "flex flex-row items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
                    !done && step.href && "hover:bg-grey-25",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 flex-none items-center justify-center rounded-full border",
                      done ? "border-primary bg-primary text-on-primary" : "border-grey-200 text-transparent",
                    )}
                  >
                    <NiCheck size="small" />
                  </span>
                  <Typography
                    variant="body1"
                    className={cn(
                      "flex-1",
                      done ? "text-text-secondary line-through" : "text-text-primary font-medium",
                    )}
                  >
                    {step.title}
                  </Typography>
                  {!done && step.href && <NiChevronRightSmall size="medium" className="text-text-secondary" />}
                </Box>
              );
              return !done && step.href ? (
                <Link key={step.key} href={step.href} className="block">
                  {body}
                </Link>
              ) : (
                <Box key={step.key} className={cn(done && "hidden sm:block")}>
                  {body}
                </Box>
              );
            })}
        </Box>

        {steps.some((step) => step.required === false) && (
          <>
            <Divider />
            <Box className="flex flex-col gap-2">
              <Chip label={optionalLabel} size="small" variant="outlined" color="grey" className="self-start" />
              {steps
                .filter((step) => step.required === false)
                .map((step) => {
                  const done = isDone(step);
                  const body = (
                    <Box
                      className={cn(
                        "flex flex-row items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
                        !done && step.href && "hover:bg-grey-25",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 flex-none items-center justify-center rounded-full border",
                          done ? "border-primary bg-primary text-on-primary" : "border-grey-200 text-transparent",
                        )}
                      >
                        <NiCheck size="small" />
                      </span>
                      <Typography
                        variant="body1"
                        className={cn("flex-1", done ? "text-text-secondary line-through" : "font-medium")}
                      >
                        {step.title}
                      </Typography>
                      {!done && step.href && <NiChevronRightSmall size="medium" className="text-text-secondary" />}
                    </Box>
                  );
                  return !done && step.href ? (
                    <Link key={step.key} href={step.href} className="block">
                      {body}
                    </Link>
                  ) : (
                    <Box key={step.key}>{body}</Box>
                  );
                })}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
