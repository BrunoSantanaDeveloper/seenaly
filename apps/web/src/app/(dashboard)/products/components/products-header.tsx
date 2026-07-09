"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Breadcrumbs, Grid, Typography } from "@mui/material";

/** Shared page chrome for the Products area: title + breadcrumbs. */
export default function ProductsHeader({
  title,
  crumb,
  action,
}: {
  title: string;
  crumb: string;
  action?: React.ReactNode;
}) {
  const t = useTranslations("home");

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
          <Link color="inherit" href="/products">
            {crumb}
          </Link>
        </Breadcrumbs>
      </Grid>
      {action && <Grid size={{ xs: 12, md: "auto" }}>{action}</Grid>}
    </Grid>
  );
}
