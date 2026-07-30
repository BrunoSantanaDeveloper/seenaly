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
  canFinishEarly = true,
  completeLabel = "Finish",
  backLabel = "Back",
  continueLabel = "Continue",
  nextStepLabel = "Next",
  stepLabel = (current, total) => `Step ${current} of ${total}`,
  className,
  bare = false,
  initialStep = 0,
  onStepChange,
  navigableRail = false,
  jumpLabel,
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
  /**
   * Whether finishing early makes sense YET. Lets the caller hide the shortcut
   * while it would produce nothing — e.g. "generate with what I confirmed" on
   * screen one, where the user has confirmed nothing and the label is simply
   * untrue. Default true keeps the original behaviour for every other caller.
   */
  canFinishEarly?: boolean;
  completeLabel?: string;
  /** Pass translated strings for these — the defaults are English fallbacks. */
  backLabel?: string;
  continueLabel?: string;
  nextStepLabel?: string;
  stepLabel?: (current: number, total: number) => string;
  className?: string;
  /**
   * Drop the Card shell. Inside a surface that is already a card (a Dialog's
   * content, a panel), the default shell renders as a card-inside-a-card —
   * doubled padding and a floating edge that reads as a broken layout.
   */
  bare?: boolean;
  /** Mount on this step (clamped) — resume-where-you-left-off for the caller. */
  initialStep?: number;
  /** Fired on every advance/back/jump, so the caller can persist the cursor. */
  onStepChange?: (index: number) => void;
  /**
   * Make the rail steps clickable (jump to ANY step). Opt-in ONLY: a rail jump
   * skips `onBeforeAdvance` (the save hook), so a consumer with per-step
   * validation must not enable this blindly — the readiness wizard opts in
   * because it autosaves continuously and every step is order-independent.
   */
  navigableRail?: boolean;
  /** Accessible name for a rail jump, e.g. (title) => `Ir para ${title}`. */
  jumpLabel?: (title: string) => string;
}) {
  const [index, setIndex] = useState(() => Math.min(Math.max(0, initialStep), Math.max(0, steps.length - 1)));
  const [advancing, setAdvancing] = useState(false);
  // Defensive: a steps array that SHRINKS after mount (the readiness funnel
  // model removes its activation step) must never render undefined.
  const safeIndex = Math.min(index, steps.length - 1);
  const step = steps[safeIndex];
  const isLast = safeIndex === steps.length - 1;
  const canAdvance = step.canAdvance ?? true;
  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(0, next), steps.length - 1);
    setIndex(clamped);
    onStepChange?.(clamped);
  };
  const advance = async () => {
    setAdvancing(true);
    try {
      const result = await onBeforeAdvance?.();
      if (result === false) return;
      goTo(safeIndex + 1);
    } finally {
      setAdvancing(false);
    }
  };

  const body = (
    <>
      {/* Progress rail — the whole path is visible; the reader sees the end.
            It WRAPS rather than dividing the row evenly: with nine steps in a
            dialog, equal flex columns squeezed every label into "Mensura...". */}
      <Box
        component="ol"
        aria-label={stepLabel(safeIndex + 1, steps.length)}
        className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:flex sm:flex-row sm:flex-wrap"
      >
        {steps.map((item, i) => {
          const marker = (
            <>
              <span
                aria-hidden
                className={cn(
                  "border-grey-100 flex h-5 w-5 flex-none items-center justify-center rounded-full border text-xs",
                  i <= safeIndex && "border-primary bg-primary text-on-primary",
                )}
              >
                {i < safeIndex ? <NiCheck size="tiny" /> : i + 1}
              </span>
              <Typography component="span" variant="body2" className="truncate">
                {item.shortLabel ?? item.title}
              </Typography>
              {i === safeIndex + 1 && <span className="sr-only">{nextStepLabel}</span>}
            </>
          );
          return (
            <Box
              component="li"
              key={item.shortLabel ?? item.title}
              aria-current={i === safeIndex ? "step" : undefined}
              className={cn(
                "border-grey-100 flex min-w-0 items-center border-t-2 pt-2 sm:flex-1",
                i < safeIndex && "border-primary text-text-primary",
                i === safeIndex && "border-primary text-primary-dark dark:text-primary-light",
                i > safeIndex && "text-text-secondary",
              )}
            >
              {navigableRail ? (
                // A real button, not a styled li: keyboard-focusable, named.
                <button
                  type="button"
                  aria-label={jumpLabel?.(item.shortLabel ?? item.title)}
                  className="flex min-w-0 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-inherit"
                  onClick={() => goTo(i)}
                >
                  {marker}
                </button>
              ) : (
                <Box className="flex min-w-0 items-center gap-2">{marker}</Box>
              )}
            </Box>
          );
        })}
      </Box>

      <Box className="flex flex-col gap-1">
        <Typography variant="body2" className="text-text-secondary">
          {stepLabel(safeIndex + 1, steps.length)}
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
        <Button variant="text" color="grey" disabled={safeIndex === 0} onClick={() => goTo(safeIndex - 1)}>
          {backLabel}
        </Button>
        <Box className="flex flex-row items-center gap-2">
          {/* Remaining steps are opt-in: let the user finish now instead of
                being forced through them. */}
          {!isLast && onFinishEarly && canFinishEarly && (
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
              disabled={!canAdvance}
              // `onBeforeAdvance` usually saves before moving on, and a button
              // that only greys out for a second reads as "nothing happened" —
              // the wait has to be visible, not merely inert.
              loading={advancing}
              endIcon={<NiArrowRight size="medium" />}
              onClick={() => void advance()}
            >
              {continueLabel}
            </Button>
          )}
        </Box>
      </Box>
    </>
  );

  if (bare) return <Box className={cn("flex flex-col gap-6", className)}>{body}</Box>;

  return (
    <Card className={cn("mx-auto w-full", className)}>
      <CardContent className="flex flex-col gap-6">{body}</CardContent>
    </Card>
  );
}
