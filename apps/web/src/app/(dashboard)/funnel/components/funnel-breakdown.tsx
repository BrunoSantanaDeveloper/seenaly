"use client";

import { computeFunnelRates, type FunnelCounts } from "../types";

import { Box, Card, CardContent, Typography } from "@mui/material";

/**
 * Answers "where am I losing people?" — a stage-by-stage funnel with the
 * drop-off between each step made visible. Bars are scaled to the top of the
 * funnel; the number between stages is the conversion rate, so the biggest
 * gap reads at a glance. Not a table of numbers.
 */
export default function FunnelBreakdown({
  counts,
  labels,
}: {
  counts: FunnelCounts;
  labels: {
    visits: string;
    checkout: string;
    purchases: string;
    ofPrevious: string;
    refundRate: string;
    noData: string;
  };
}) {
  const rates = computeFunnelRates(counts);
  const top = Math.max(counts.visits ?? 0, counts.checkout_initiated ?? 0, counts.purchases ?? 0, 1);

  const stages = [
    { label: labels.visits, value: counts.visits, rate: null as number | null },
    { label: labels.checkout, value: counts.checkout_initiated, rate: rates.pageToCheckout },
    { label: labels.purchases, value: counts.purchases, rate: rates.checkoutToPurchase },
  ];

  const fmt = (n: number | null | undefined) => (n == null ? labels.noData : n.toLocaleString());
  const rate = (r: number | null) => (r == null ? "—" : `${r.toFixed(1)}%`);

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-3">
        {stages.map((stage, index) => (
          <Box key={stage.label} className="flex flex-col gap-1">
            {index > 0 && (
              <Typography variant="body2" className="text-text-secondary self-center">
                ↓ {rate(stage.rate)} {labels.ofPrevious}
              </Typography>
            )}
            <Box className="flex flex-row items-center gap-3">
              <Box className="w-40 shrink-0">
                <Typography variant="subtitle2">{stage.label}</Typography>
                <Typography variant="h5" component="p">
                  {fmt(stage.value)}
                </Typography>
              </Box>
              <Box className="bg-grey-50 h-9 flex-1 overflow-hidden rounded-xl">
                <Box
                  className="bg-primary/80 h-full rounded-xl transition-all"
                  style={{ width: `${Math.max(2, ((stage.value ?? 0) / top) * 100)}%` }}
                />
              </Box>
            </Box>
          </Box>
        ))}

        {rates.refundRate != null && (
          <Typography variant="body2" className="text-text-secondary mt-1">
            {labels.refundRate}: {rate(rates.refundRate)}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
