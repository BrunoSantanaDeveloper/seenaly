"use client";

import { Alert, Box, Button, Typography } from "@mui/material";

import NiRefresh from "@/icons/nexture/ni-refresh";

/**
 * Recoverable product-data failure. Errors must never masquerade as an empty
 * collection; callers may keep stale content underneath and render this inline.
 */
export default function LoadErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  busy = false,
}: {
  title: string;
  description: string;
  retryLabel: string;
  onRetry: () => void;
  busy?: boolean;
}) {
  return (
    <Alert severity="error" className="neutral bg-background-paper/60!">
      <Box className="flex flex-col items-start gap-2">
        <Box>
          <Typography variant="subtitle2">{title}</Typography>
          <Typography variant="body2">{description}</Typography>
        </Box>
        <Button
          variant="outlined"
          color="grey"
          size="small"
          startIcon={<NiRefresh size="small" />}
          loading={busy}
          onClick={onRetry}
        >
          {retryLabel}
        </Button>
      </Box>
    </Alert>
  );
}
