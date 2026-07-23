"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button, Card, CardContent, Grid, Typography } from "@mui/material";

import { useProductWorkspace } from "@/components/product-workspace/product-workspace";
import NiCamera from "@/icons/nexture/ni-camera";
import NiDocumentChart from "@/icons/nexture/ni-document-chart";
import NiTrendUp from "@/icons/nexture/ni-trend-up";

export default function ProductOrganicPage() {
  const t = useTranslations("workspace");
  const { product } = useProductWorkspace();
  const actions = [
    {
      icon: <NiTrendUp size="medium" />,
      title: t("organic-setup-title"),
      body: t("organic-setup-body"),
      href: `/organic-growth/setup?product=${product.id}`,
    },
    {
      icon: <NiCamera size="medium" />,
      title: t("organic-content-title"),
      body: t("organic-content-body"),
      href: `/organic-growth/content?product=${product.id}`,
    },
    {
      icon: <NiDocumentChart size="medium" />,
      title: t("organic-reviews-title"),
      body: t("organic-reviews-body"),
      href: `/organic-growth/reviews?product=${product.id}`,
    },
  ];

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Typography variant="h2" component="h2">
          {t("organic-title")}
        </Typography>
        <Typography variant="body1" className="text-text-secondary max-w-3xl">
          {t("organic-body", { product: product.name })}
        </Typography>
      </Grid>
      {actions.map((action) => (
        <Grid key={action.title} size={{ xs: 12, lg: 4 }}>
          <Card className="h-full">
            <CardContent className="flex h-full flex-col items-start gap-3">
              <span className="bg-primary/10 text-primary-dark dark:text-primary-light flex h-11 w-11 items-center justify-center rounded-2xl">
                {action.icon}
              </span>
              <Typography variant="h5" component="h3">
                {action.title}
              </Typography>
              <Typography variant="body2" className="text-text-secondary grow">
                {action.body}
              </Typography>
              <Button component={Link} href={action.href} variant="outlined" color="grey">
                {t("data-open")}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
