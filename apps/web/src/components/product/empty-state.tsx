"use client";

import Link from "next/link";

import { Box, Button, Typography } from "@mui/material";

import { cn } from "@/lib/utils";

type Action = { label: string; href?: string; onClick?: () => void };

/**
 * An empty state is NEVER a blank screen. It answers three things at a
 * glance: what this area is, why it's empty, and the ONE next action that
 * fills it (the nudge). Use it for every zero-data view (product-screen
 * skill rule) — a bare "No data" is a UX failure.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: {
  /** Meaningful icon (the concept, in a soft tinted chip). */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** The primary nudge — what the user should do to get value here. */
  action?: Action;
  secondaryAction?: Action;
  className?: string;
}) {
  const renderAction = (a: Action, variant: "contained" | "text") =>
    a.href ? (
      <Button variant={variant} color={variant === "text" ? "grey" : "primary"} href={a.href} LinkComponent={Link}>
        {a.label}
      </Button>
    ) : (
      <Button variant={variant} color={variant === "text" ? "grey" : "primary"} onClick={a.onClick}>
        {a.label}
      </Button>
    );

  return (
    <Box
      className={cn(
        "border-grey-100 flex flex-col items-center gap-3 rounded-3xl border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <span className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-2xl [&_svg]:h-7 [&_svg]:w-7">
          {icon}
        </span>
      )}
      <Typography variant="h5" component="h2" className="text-text-primary mt-1">
        {title}
      </Typography>
      {description && (
        <Typography variant="body1" className="text-text-secondary max-w-md leading-6">
          {description}
        </Typography>
      )}
      {(action || secondaryAction) && (
        <Box className="mt-3 flex flex-col items-center gap-2 sm:flex-row">
          {action && renderAction(action, "contained")}
          {secondaryAction && renderAction(secondaryAction, "text")}
        </Box>
      )}
    </Box>
  );
}
