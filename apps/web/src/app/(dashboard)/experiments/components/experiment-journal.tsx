"use client";

import type { ExperimentStatus } from "../types";
import Link from "next/link";

import { Box, Card, CardContent, Chip, Grid, Typography } from "@mui/material";

export type ExperimentCard = {
  id: string;
  title: string;
  status: ExperimentStatus;
  hypothesis: string | null;
  result: string | null;
  conclusion: string | null;
};

const STATUS_COLOR: Record<ExperimentStatus, "default" | "primary" | "success" | "warning"> = {
  planned: "default",
  running: "primary",
  concluded: "success",
  abandoned: "warning",
};

/**
 * The experiment log as a journal, grouped by status (running → planned →
 * concluded → abandoned). Each card shows the arc that makes a test reusable
 * knowledge: hypothesis → result → conclusion. Not a management table.
 */
export default function ExperimentJournal({
  experiments,
  columnLabel,
  labels,
  hrefFor = (experimentId) => `/experiments/${experimentId}`,
}: {
  experiments: ExperimentCard[];
  columnLabel: (status: ExperimentStatus) => string;
  labels: { hypothesis: string; result: string; conclusion: string };
  hrefFor?: (experimentId: string) => string;
}) {
  const order: ExperimentStatus[] = ["running", "planned", "concluded", "abandoned"];
  const lanes = order
    .map((status) => ({ status, items: experiments.filter((e) => e.status === status) }))
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
            {lane.items.map((experiment) => (
              <Grid key={experiment.id} size={{ xs: 12, md: 6 }}>
                <Card
                  component={Link}
                  href={hrefFor(experiment.id)}
                  className="hover:shadow-darker-sm block h-full no-underline transition-shadow"
                >
                  <CardContent className="flex flex-col gap-2">
                    <Typography variant="subtitle1" className="truncate">
                      {experiment.title}
                    </Typography>
                    {experiment.hypothesis && <Line label={labels.hypothesis} value={experiment.hypothesis} />}
                    {experiment.result && <Line label={labels.result} value={experiment.result} />}
                    {experiment.conclusion && <Line label={labels.conclusion} value={experiment.conclusion} strong />}
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

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box className="flex flex-col">
      <Typography variant="body2" className="text-text-secondary uppercase">
        {label}
      </Typography>
      <Typography variant="body2" className={strong ? "text-text-primary line-clamp-3 font-medium" : "line-clamp-2"}>
        {value}
      </Typography>
    </Box>
  );
}
