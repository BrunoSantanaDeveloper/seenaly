"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Alert, Button, Card, CardContent, Grid, Typography } from "@mui/material";

import { useProductWorkspace } from "@/components/product-workspace/product-workspace";
import NiCamera from "@/icons/nexture/ni-camera";
import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";
import NiDatabase from "@/icons/nexture/ni-database";
import NiTrendUp from "@/icons/nexture/ni-trend-up";

export default function ProductDataPage() {
  const t = useTranslations("workspace");
  const { product, progress, href } = useProductWorkspace();

  const sources = [
    {
      icon: <NiDatabase size="medium" />,
      title: t("data-meta-title"),
      body: t("data-meta-body"),
      href: "/settings/connections",
      action: progress.hasData ? t("data-manage") : t("data-connect"),
    },
    {
      icon: <NiChartFunnel size="medium" />,
      title: t("data-funnel-title"),
      body: t("data-funnel-body"),
      href: href("funnel"),
      action: t("data-open"),
    },
    {
      icon: <NiCamera size="medium" />,
      title: t("data-creatives-title"),
      body: t("data-creatives-body"),
      href: href("creatives"),
      action: t("data-open"),
    },
    {
      icon: <NiTrendUp size="medium" />,
      title: t("data-organic-title"),
      body: t("data-organic-body"),
      href: href("organic"),
      action: t("data-open"),
    },
  ];

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Typography variant="h2" component="h2">
          {t("data-title")}
        </Typography>
        <Typography variant="body1" className="text-text-secondary max-w-3xl">
          {t("data-body", { product: product.name })}
        </Typography>
      </Grid>
      <Grid size={12}>
        <Alert severity="info" className="neutral bg-background-paper/60!">
          {t("data-optional-note")}
        </Alert>
      </Grid>
      {sources.map((source) => (
        <Grid key={source.title} size={{ xs: 12, md: 6 }}>
          <Card className="h-full">
            <CardContent className="flex h-full flex-col items-start gap-3">
              <span className="bg-primary/10 text-primary-dark dark:text-primary-light flex h-11 w-11 items-center justify-center rounded-2xl">
                {source.icon}
              </span>
              <Typography variant="h5" component="h3">
                {source.title}
              </Typography>
              <Typography variant="body2" className="text-text-secondary grow">
                {source.body}
              </Typography>
              <Button component={Link} href={source.href} variant="outlined" color="grey">
                {source.action}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
