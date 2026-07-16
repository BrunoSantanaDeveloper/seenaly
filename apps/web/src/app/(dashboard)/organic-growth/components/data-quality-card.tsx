"use client";

import { useTranslations } from "next-intl";

import { Box, Card, CardContent, Chip, LinearProgress, Typography } from "@mui/material";

import NiSignalUp from "@/icons/nexture/ni-signal-up";

export interface OrganicDataQuality {
  score: number;
  contentCount: number;
  comparableCount: number;
  classifiedCount: number;
  withMetricsCount: number;
  missing: string[];
}

export default function DataQualityCard({ quality }: { quality: OrganicDataQuality }) {
  const t = useTranslations("organicGrowth");
  const value = Math.max(0, Math.min(100, quality.score));

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-4">
        <Box className="flex flex-row items-start gap-3">
          <span className="bg-primary/10 text-primary flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
            <NiSignalUp size="medium" />
          </span>
          <Box className="grow">
            <Typography variant="h5" component="h2" className="card-title mb-0">
              {t("data-quality-title")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("data-quality-description")}
            </Typography>
          </Box>
          <Typography variant="h5" className="text-primary">
            {value}%
          </Typography>
        </Box>

        <LinearProgress variant="determinate" value={value} />

        <Box className="flex flex-row flex-wrap gap-1.5">
          <Chip label={t("data-quality-content", { count: quality.contentCount })} size="small" variant="outlined" />
          <Chip
            label={t("data-quality-comparable", { count: quality.comparableCount })}
            size="small"
            variant="outlined"
          />
          <Chip
            label={t("data-quality-classified", { count: quality.classifiedCount })}
            size="small"
            variant="outlined"
          />
          <Chip
            label={t("data-quality-metrics", { count: quality.withMetricsCount })}
            size="small"
            variant="outlined"
          />
        </Box>

        {quality.missing.length > 0 && (
          <Typography variant="body2" className="text-text-secondary">
            {t("data-quality-next")}: {quality.missing.join(" · ")}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
