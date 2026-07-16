"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Breadcrumbs, Grid, Typography } from "@mui/material";

export default function OrganicGrowthHeader({
  title,
  crumb,
  actions,
}: {
  title: string;
  crumb?: string;
  actions?: React.ReactNode;
}) {
  const t = useTranslations("organicGrowth");

  return (
    <Grid size={12} spacing={2.5} container className="items-center">
      <Grid size={{ xs: 12, md: "grow" }}>
        <Typography variant="h1" component="h1" className="mb-0">
          {title}
        </Typography>
        <Breadcrumbs>
          <Link color="inherit" href="/home">
            {t("crumb-home")}
          </Link>
          {crumb && crumb !== t("title") && (
            <Link color="inherit" href="/organic-growth">
              {t("title")}
            </Link>
          )}
          <Typography variant="body2">{crumb ?? title}</Typography>
        </Breadcrumbs>
      </Grid>
      {actions && <Grid size={{ xs: 12, md: "auto" }}>{actions}</Grid>}
    </Grid>
  );
}
