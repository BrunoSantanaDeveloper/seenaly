"use client";

import { Box, Typography } from "@mui/material";

import { cn } from "@/lib/utils";

/**
 * Completion-drive visual: a ring the brain wants to close (Gestalt
 * closure). This is the ONE gamification pattern research backs — it maps
 * real setup progress, no points/badges/streaks. Pair with OnboardingChecklist.
 */
export default function ActivationProgress({
  done,
  total,
  size = 56,
  label,
  className,
}: {
  done: number;
  total: number;
  size?: number;
  /** Text under the ring (defaults to "done/total"). */
  label?: string;
  className?: string;
}) {
  const percent = total === 0 ? 0 : done / total;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const complete = total > 0 && done === total;

  return (
    <Box className={cn("flex flex-row items-center gap-3", className)}>
      <Box className="relative flex-none" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--grey-100))"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent)}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <span className="text-text-primary absolute inset-0 flex items-center justify-center text-sm font-bold">
          {Math.round(percent * 100)}%
        </span>
      </Box>
      <Typography variant="body2" className={cn(complete ? "text-primary font-semibold" : "text-text-secondary")}>
        {label ?? `${done}/${total}`}
      </Typography>
    </Box>
  );
}
