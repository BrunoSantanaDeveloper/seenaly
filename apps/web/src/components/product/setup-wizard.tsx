"use client";

import { useState } from "react";

import { Box, Button, Card, CardContent, Typography } from "@mui/material";

import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiCheck from "@/icons/nexture/ni-check";
import { cn } from "@/lib/utils";

export type WizardStep = {
  title: string;
  /** Compact, accessible label used in the named progress trail. */
  shortLabel?: string;
  /** Optional one-line reassurance under the title (progressive disclosure). */
  hint?: string;
  content: React.ReactNode;
  /** Block "next" until the step is valid. Default: true. */
  canAdvance?: boolean;
};

/**
 * Multi-step setup shell (progressive disclosure): one decision per screen
 * with a visible progress rail, so a long setup never feels long. Splitting
 * a form across steps can lift conversion (House: +15%) — friction removed
 * in one place, added in another. The caller owns each step's content and
 * validity; the shell owns navigation, the rail and completion.
 */
export default function SetupWizard({
  steps,
  onComplete,
  onBeforeAdvance,
  onFinishEarly,
  finishEarlyLabel,
  completeLabel = "Finish",
  backLabel = "Back",
  continueLabel = "Continue",
  nextStepLabel = "Next",
  stepLabel = (current, total) => `Step ${current} of ${total}`,
  className,
}: {
  steps: WizardStep[];
  onComplete: () => void;
  onBeforeAdvance?: () => void | boolean | Promise<void | boolean>;
  /**
   * When set, a secondary "finish now" action appears on every non-final step
   * (as long as the step can advance), so the remaining steps are opt-in and a
   * user is never forced through optional ones. Same submit as onComplete.
   */
  onFinishEarly?: () => void;
  finishEarlyLabel?: string;
  completeLabel?: string;
  /** Pass translated strings for these — the defaults are English fallbacks. */
  backLabel?: string;
  continueLabel?: string;
  nextStepLabel?: string;
  stepLabel?: (current: number, total: number) => string;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const canAdvance = step.canAdvance ?? true;
  const advance = async () => {
    setAdvancing(true);
    try {
      const result = await onBeforeAdvance?.();
      if (result === false) return;
      setIndex((current) => Math.min(steps.length - 1, current + 1));
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <Card className={cn("mx-auto w-full max-w-2xl", className)}>
      <CardContent className="flex flex-col gap-6">
        {/* Progress rail — the whole path is visible; the reader sees the end. */}
        <Box
          component="ol"
          aria-label={stepLabel(index + 1, steps.length)}
          className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:flex sm:flex-row"
        >
          {steps.map((item, i) => (
            <Box
              component="li"
              key={item.shortLabel ?? item.title}
              aria-current={i === index ? "step" : undefined}
              className={cn(
                "border-grey-100 flex min-w-0 items-center gap-2 border-t-2 pt-2 sm:flex-1",
                i < index && "border-primary text-text-primary",
                i === index && "border-primary text-primary-dark dark:text-primary-light",
                i > index && "text-text-secondary",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "border-grey-100 flex h-5 w-5 flex-none items-center justify-center rounded-full border text-xs",
                  i <= index && "border-primary bg-primary text-on-primary",
                )}
              >
                {i < index ? <NiCheck size="tiny" /> : i + 1}
              </span>
              <Typography component="span" variant="body2" className="truncate">
                {item.shortLabel ?? item.title}
              </Typography>
              {i === index + 1 && <span className="sr-only">{nextStepLabel}</span>}
            </Box>
          ))}
        </Box>

        <Box className="flex flex-col gap-1">
          <Typography variant="body2" className="text-text-secondary">
            {stepLabel(index + 1, steps.length)}
          </Typography>
          <Typography variant="h4" component="h2" className="text-text-primary">
            {step.title}
          </Typography>
          {step.hint && (
            <Typography variant="body1" className="text-text-secondary leading-6">
              {step.hint}
            </Typography>
          )}
        </Box>

        <Box>{step.content}</Box>

        <Box className="flex flex-row items-center justify-between gap-2">
          <Button
            variant="text"
            color="grey"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            {backLabel}
          </Button>
          <Box className="flex flex-row items-center gap-2">
            {/* Remaining steps are opt-in: let the user finish now instead of
                being forced through them. */}
            {!isLast && onFinishEarly && (
              <Button variant="text" color="grey" disabled={!canAdvance} onClick={onFinishEarly}>
                {finishEarlyLabel ?? completeLabel}
              </Button>
            )}
            {isLast ? (
              <Button
                variant="contained"
                color="primary"
                disabled={!canAdvance}
                endIcon={<NiCheck size="medium" />}
                onClick={onComplete}
              >
                {completeLabel}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                disabled={!canAdvance || advancing}
                endIcon={<NiArrowRight size="medium" />}
                onClick={() => void advance()}
              >
                {continueLabel}
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
