"use client";

import { useTranslations } from "next-intl";

import { Box, Card, CardContent, Typography } from "@mui/material";

import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";

export interface CoverageBucket {
  key: string;
  count: number;
  percent: number;
}

export default function FunnelCoverage({ buckets, total }: { buckets: CoverageBucket[]; total: number }) {
  const t = useTranslations("organicGrowth");

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-4">
        <Box className="flex flex-row items-start gap-3">
          <span className="bg-primary/10 text-primary flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
            <NiChartFunnel size="medium" />
          </span>
          <Box>
            <Typography variant="h5" component="h2" className="card-title mb-0">
              {t("coverage-title")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("coverage-description", { count: total })}
            </Typography>
          </Box>
        </Box>

        <Box className="flex flex-col gap-3">
          {buckets.map((bucket) => (
            <Box key={bucket.key} className="grid grid-cols-[minmax(7rem,0.8fr)_2fr_auto] items-center gap-3">
              <Typography variant="body2">{t(`coverage-${bucket.key}`)}</Typography>
              <Box className="bg-grey-50 h-2 overflow-hidden rounded-full">
                <Box className="bg-primary h-full rounded-full" style={{ width: `${Math.max(2, bucket.percent)}%` }} />
              </Box>
              <Typography variant="body2" className="text-text-secondary min-w-14 text-right">
                {bucket.count} · {Math.round(bucket.percent)}%
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
