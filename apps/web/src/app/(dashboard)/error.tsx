"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Box, Grid } from "@mui/material";

import LoadErrorState from "@/components/product/load-error-state";
import * as Sentry from "@sentry/nextjs";

/**
 * Segment error boundary for the authenticated app. Without it, a single render
 * throw in ANY dashboard screen escaped all the way to `global-error` and
 * replaced the whole app shell with a bare "Algo deu errado" — the failure a
 * malformed diagnosis row caused. Here the dashboard chrome is preserved and the
 * error is recoverable in place: `reset()` re-renders the segment, and the rest
 * of the app keeps working. Reports to Sentry (no-op without a DSN).
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tc = useTranslations("productCommon");

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={12}>
        <Box className="max-w-2xl">
          <LoadErrorState
            title={tc("crash-title")}
            description={tc("crash-body")}
            retryLabel={tc("retry")}
            onRetry={reset}
          />
        </Box>
      </Grid>
    </Grid>
  );
}
