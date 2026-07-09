"use client";

import { useState } from "react";

import { Box, Button, Card, CardContent, Typography } from "@mui/material";

import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiCheck from "@/icons/nexture/ni-check";
import { cn } from "@/lib/utils";

export type WizardStep = {
  title: string;
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
  completeLabel = "Finish",
  className,
}: {
  steps: WizardStep[];
  onComplete: () => void;
  completeLabel?: string;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const canAdvance = step.canAdvance ?? true;

  return (
    <Card className={cn("mx-auto w-full max-w-2xl", className)}>
      <CardContent className="flex flex-col gap-6">
        {/* Progress rail — the whole path is visible; the reader sees the end. */}
        <Box className="flex flex-row items-center gap-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i < index ? "bg-primary" : i === index ? "bg-primary/60" : "bg-grey-100",
              )}
            />
          ))}
        </Box>

        <Box className="flex flex-col gap-1">
          <Typography variant="body2" className="text-text-secondary">
            Step {index + 1} of {steps.length}
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

        <Box className="flex flex-row items-center justify-between">
          <Button
            variant="text"
            color="grey"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            Back
          </Button>
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
              endIcon={<NiArrowRight size="medium" />}
              onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
            >
              Continue
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
