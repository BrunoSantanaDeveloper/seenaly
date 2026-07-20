"use client";

import type { CreativeStatus } from "../types";
import Link from "next/link";

import { Box, Card, CardContent, Chip, Grid, Typography } from "@mui/material";

export type CreativeCard = {
  id: string;
  name: string;
  status: CreativeStatus;
  angle: string | null;
  hook: string | null;
  format: string | null;
};

const STATUS_COLOR: Record<CreativeStatus, "default" | "primary" | "success" | "warning"> = {
  idea: "default",
  testing: "primary",
  winner: "success",
  paused: "warning",
  archived: "default",
};

/**
 * The library grouped by test lifecycle (idea → testing → winner → paused →
 * archived). Grouping by status — not a flat table — is what surfaces the
 * pattern the operator came for: what's winning, and what it has in common.
 */
export default function CreativesBoard({
  creatives,
  columnLabel,
  angleLabel,
  formatLabel,
}: {
  creatives: CreativeCard[];
  columnLabel: (status: CreativeStatus) => string;
  angleLabel: string;
  /** Resolve a format slug to its localized label (falls back to the raw value). */
  formatLabel?: (value: string) => string;
}) {
  // Only render lanes that hold something; keep a meaningful order.
  const order: CreativeStatus[] = ["winner", "testing", "idea", "paused", "archived"];
  const lanes = order
    .map((status) => ({ status, items: creatives.filter((c) => c.status === status) }))
    .filter((lane) => lane.items.length > 0);

  return (
    <Grid size={12} container spacing={5}>
      {lanes.map((lane) => (
        <Grid key={lane.status} size={12}>
          <Box className="mb-2 flex flex-row items-center gap-2">
            <Typography variant="h6" component="h2">
              {columnLabel(lane.status)}
            </Typography>
            <Chip label={lane.items.length} size="small" variant="outlined" color={STATUS_COLOR[lane.status]} />
          </Box>
          <Grid container spacing={2.5}>
            {lane.items.map((creative) => (
              <Grid key={creative.id} size={{ xs: 12, md: 6, xl: 4 }}>
                <Card
                  component={Link}
                  href={`/creatives/${creative.id}`}
                  className="hover:shadow-darker-sm block h-full no-underline transition-shadow"
                >
                  <CardContent className="flex flex-col gap-1.5">
                    <Box className="flex flex-row items-center gap-2">
                      <Typography variant="subtitle1" className="grow truncate">
                        {creative.name}
                      </Typography>
                      {creative.format && (
                        <Chip
                          label={formatLabel ? formatLabel(creative.format) : creative.format}
                          size="small"
                          variant="outlined"
                          color="grey"
                        />
                      )}
                    </Box>
                    {creative.angle && (
                      <Typography variant="body2" className="text-text-secondary">
                        {angleLabel}: {creative.angle}
                      </Typography>
                    )}
                    {creative.hook && (
                      <Typography variant="body2" className="text-text-secondary line-clamp-2">
                        “{creative.hook}”
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>
      ))}
    </Grid>
  );
}
