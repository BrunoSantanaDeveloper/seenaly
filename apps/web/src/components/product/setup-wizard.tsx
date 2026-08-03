"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  Step,
  StepButton,
  type StepIconProps,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";

import NiCheck from "@/icons/nexture/ni-check";
import NiChevronLeftSmall from "@/icons/nexture/ni-chevron-left-small";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";
import { cn } from "@/lib/utils";

export type WizardStep = {
  title: string;
  /** Compact, accessible label used in the named progress trail. */
  shortLabel?: string;
  /**
   * Icon for this step's rail tile (the template's stepper shows a topic icon
   * rather than a number). Optional: without one the tile falls back to the
   * step's position, so a caller that has no meaningful icon per step still
   * renders correctly instead of showing an empty box.
   */
  icon?: React.ReactNode;
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

  /**
   * The rail has to FOLLOW the user. It scrolls (nine readable labels never fit
   * a card row), but scrolling alone left `scrollLeft` at 0 forever: measured on
   * the readiness wizard, a user standing on step 9 still saw steps 1–6 and no
   * sign of "Revisão". A progress rail that points at the beginning while you
   * are at the end is worse than no rail — so the active tile is brought into
   * view on every change, and the edges say when there is more to see.
   */
  const railRef = useRef<HTMLDivElement | null>(null);
  const [railEdges, setRailEdges] = useState({ start: false, end: false });
  const syncRailEdges = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    setRailEdges({ start: rail.scrollLeft > 2, end: rail.scrollLeft < max - 2 });
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    const active = rail?.querySelector<HTMLElement>("[data-step-active='true']");
    if (!rail || !active) return;
    // Centered, not merely "in view": the neighbours are the context that makes
    // a position legible ("two done, three to go").
    const target = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
    rail.scrollTo({
      left: Math.max(0, target),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    // Settle after the smooth scroll so the fades match the final position.
    const timer = window.setTimeout(syncRailEdges, 400);
    return () => window.clearTimeout(timer);
  }, [safeIndex, steps.length, syncRailEdges]);

  useEffect(() => {
    syncRailEdges();
    window.addEventListener("resize", syncRailEdges);
    return () => window.removeEventListener("resize", syncRailEdges);
  }, [syncRailEdges]);

  const body = (
    <>
      {/*
       * Progress rail — the template's Stepper (reference:
       * app/(dashboard)/ui/navigation/stepper/examples): a bordered tile per
       * step, its label over a "step N of M" caption, MUI's own connectors.
       *
       * It SCROLLS rather than compressing. A wizard here can carry nine
       * steps, and sharing one dialog row between them truncated every label
       * to "Mensura..." — the rail exists to say where you are, so a readable
       * label outranks fitting the whole path on screen at once.
       */}
      <Box className="relative">
        {/* Edge fades: the only signal that the path continues past the card.
            Rendered per side and only when that side actually has more, so a
            path that fits shows none. */}
        {railEdges.start && (
          <span
            aria-hidden
            className="from-background-paper pointer-events-none absolute inset-y-0 left-0 z-1 w-8 bg-gradient-to-r to-transparent"
          />
        )}
        {railEdges.end && (
          <span
            aria-hidden
            className="from-background-paper pointer-events-none absolute inset-y-0 right-0 z-1 w-8 bg-gradient-to-l to-transparent"
          />
        )}
        <Box ref={railRef} onScroll={syncRailEdges} className="-mx-1 overflow-x-auto px-1 pb-1">
          {/* `w-full min-w-max`: fills the row when the path fits — so the
            connectors stretch exactly like the template — and grows past it
            (scrolling) when it does not, instead of squeezing the labels. */}
          {/* `nonLinear` is what KEEPS the rail navigable: a linear Stepper
            disables every StepButton past the active step, which would
            silently kill the jumps this wizard opts into. */}
          <Stepper activeStep={safeIndex} nonLinear={navigableRail} className="w-full min-w-max">
            {steps.map((item, i) => {
              const label = item.shortLabel ?? item.title;
              const caption = (
                <Typography variant="caption" className="leading-3">
                  {stepLabel(i + 1, steps.length)}
                </Typography>
              );
              const icon = ({ active, completed }: StepIconProps) => (
                <Box
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-sm border border-solid",
                    completed ? "border-primary text-primary bg-transparent" : "border-grey-200 text-text-primary",
                    active && "border-primary bg-primary text-text-contrast",
                  )}
                >
                  {completed ? (
                    <NiCheck size="small" />
                  ) : (
                    (item.icon ?? <Typography variant="body2">{i + 1}</Typography>)
                  )}
                </Box>
              );
              const content = (
                <>
                  <span className="whitespace-nowrap">{label}</span>
                  {i === safeIndex + 1 && <span className="sr-only">{nextStepLabel}</span>}
                </>
              );

              return (
                <Step key={label} completed={i < safeIndex} data-step-active={i === safeIndex}>
                  {navigableRail ? (
                    // StepButton is the template's own navigable form — a real
                    // button, keyboard-focusable and named.
                    <StepButton
                      className="text-left"
                      aria-label={jumpLabel?.(label)}
                      onClick={() => goTo(i)}
                      optional={caption}
                    >
                      <StepLabel slots={{ stepIcon: icon }}>{content}</StepLabel>
                    </StepButton>
                  ) : (
                    <StepLabel slots={{ stepIcon: icon }} optional={caption}>
                      {content}
                    </StepLabel>
                  )}
                </Step>
              );
            })}
          </Stepper>
        </Box>
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
        {/* Back/Next follow the template's stepper pair: a grey contained
            "back" with a leading chevron, primary contained "next" with a
            trailing one. */}
        <Button
          variant="contained"
          color="grey"
          disabled={safeIndex === 0}
          onClick={() => goTo(safeIndex - 1)}
          startIcon={<NiChevronLeftSmall size="medium" />}
        >
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
              endIcon={<NiChevronRightSmall size="medium" />}
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
