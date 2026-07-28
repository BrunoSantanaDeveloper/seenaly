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
    signups: string;
    checkout: string;
    purchases: string;
    ofPrevious: string;
    refundRate: string;
    noData: string;
  };
}) {
  const rates = computeFunnelRates(counts);
  const top = Math.max(
    counts.visits ?? 0,
    counts.signups ?? 0,
    counts.checkout_initiated ?? 0,
    counts.purchases ?? 0,
    1,
  );

  // The signup stage only exists in a trial-first funnel, so it appears only
  // when there is a number for it — a direct-response product keeps the exact
  // three stages it had before.
  const present = [
    { label: labels.visits, value: counts.visits },
    ...(counts.signups != null ? [{ label: labels.signups, value: counts.signups }] : []),
    { label: labels.checkout, value: counts.checkout_initiated },
    { label: labels.purchases, value: counts.purchases },
  ];

  // Each rate is computed against the PREVIOUS RENDERED stage, so the
  // "↓ x% do anterior" caption stays literally true whichever stages exist.
  const stages = present.map((stage, index) => {
    const previous = index > 0 ? present[index - 1].value : null;
    const rate =
      index > 0 && stage.value != null && previous != null && previous > 0 ? (stage.value / previous) * 100 : null;
    return { ...stage, rate };
  });

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
