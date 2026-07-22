"use client";

import { useEffect, useState } from "react";

import { Backdrop, Box, LinearProgress, Typography } from "@mui/material";

import { cn } from "@/lib/utils";

export interface ProcessingStage {
  /** Meaningful icon for this stage (show, don't tell). */
  icon: React.ReactNode;
  /** Already-translated label — the caller owns i18n. */
  label: string;
}

/**
 * Full-screen wait state for work that genuinely takes tens of seconds
 * (retrieval + a structured LLM generation). Without it the only feedback is a
 * button label, and a 20-second silence reads as "broken".
 *
 * HONESTY CONSTRAINT — deliberate: the stages listed here are the REAL steps of
 * the pipeline, but the server action exposes no progress events, so the
 * rotation is time-based. That is why there is **no percentage and no
 * determinate bar**: a number we cannot measure would be a lie, and one that
 * reaches 100% before the answer arrives looks broken twice over. The rotation
 * also CLAMPS on the last stage instead of looping — cycling back to "reading
 * your product" after "writing the verdict" would misrepresent the work.
 *
 * Accessibility: the live region announces each stage to screen readers, and
 * every animation is disabled under `prefers-reduced-motion`.
 */
export default function ProcessingOverlay({
  open,
  title,
  stages,
  patienceLabel,
  patienceAfterMs = 25000,
  intervalMs = 3800,
}: {
  open: boolean;
  title: string;
  stages: ProcessingStage[];
  /** Shown once the wait passes `patienceAfterMs` — reassurance, not a promise. */
  patienceLabel?: string;
  patienceAfterMs?: number;
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [patient, setPatient] = useState(false);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setPatient(false);
      return;
    }
    // Clamp at the final stage: never loop back and imply work restarted.
    const rotate = setInterval(() => setIndex((i) => Math.min(i + 1, stages.length - 1)), intervalMs);
    const patience = setTimeout(() => setPatient(true), patienceAfterMs);
    return () => {
      clearInterval(rotate);
      clearTimeout(patience);
    };
  }, [open, stages.length, intervalMs, patienceAfterMs]);

  const stage = stages[Math.min(index, stages.length - 1)];
  if (!stage) return null;

  return (
    <Backdrop open={open} className="bg-background/80 z-[1400] backdrop-blur-sm" aria-busy={open}>
      <Box
        role="status"
        aria-live="polite"
        className="bg-background-paper mx-4 flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl p-8 text-center shadow-lg"
      >
        <span className="bg-primary/10 text-primary flex h-16 w-16 items-center justify-center rounded-2xl motion-safe:animate-pulse [&_svg]:h-8 [&_svg]:w-8">
          {stage.icon}
        </span>

        <Box className="flex flex-col gap-1">
          <Typography variant="h5" component="h2" className="text-text-primary mb-0">
            {title}
          </Typography>
          <Typography variant="body1" className="text-text-secondary leading-6">
            {stage.label}
          </Typography>
        </Box>

        {/* Indeterminate by design — see the honesty note above. */}
        <LinearProgress className="w-full rounded-full" />

        {/* Which stage we're on, without claiming a measured percentage. */}
        <Box className="flex flex-row items-center gap-1.5" aria-hidden="true">
          {stages.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i < index ? "bg-primary w-4" : i === index ? "bg-primary w-6" : "bg-grey-100 w-4",
              )}
            />
          ))}
        </Box>

        {patient && patienceLabel && (
          <Typography variant="body2" className="text-text-secondary">
            {patienceLabel}
          </Typography>
        )}
      </Box>
    </Backdrop>
  );
}
