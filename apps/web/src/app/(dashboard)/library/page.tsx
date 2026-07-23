import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button, Card, CardContent, Grid, Typography } from "@mui/material";

import NiCamera from "@/icons/nexture/ni-camera";
import NiDocumentChart from "@/icons/nexture/ni-document-chart";
import NiTrendUp from "@/icons/nexture/ni-trend-up";

export default async function LibraryPage() {
  const t = await getTranslations("library");
  const items = [
    {
      icon: <NiCamera size="large" />,
      title: t("creatives-title"),
      body: t("creatives-body"),
      href: "/creatives",
      action: t("creatives-action"),
    },
    {
      icon: <NiTrendUp size="large" />,
      title: t("organic-title"),
      body: t("organic-body"),
      href: "/organic-growth/content",
      action: t("organic-action"),
    },
    {
      icon: <NiDocumentChart size="large" />,
      title: t("reviews-title"),
      body: t("reviews-body"),
      href: "/organic-growth/reviews",
      action: t("reviews-action"),
    },
  ];

  return (
    <Grid container spacing={4}>
      <Grid size={12}>
        <Typography variant="h1" component="h1">
          {t("title")}
        </Typography>
        <Typography variant="body1" className="text-text-secondary max-w-3xl">
          {t("body")}
        </Typography>
      </Grid>
      {items.map((item) => (
        <Grid key={item.title} size={{ xs: 12, md: 6, xl: 4 }}>
          <Card className="h-full">
            <CardContent className="flex h-full flex-col items-start gap-4">
              <span className="bg-primary/10 text-primary-dark dark:text-primary-light flex h-14 w-14 items-center justify-center rounded-2xl">
                {item.icon}
              </span>
              <Typography variant="h4" component="h2">
                {item.title}
              </Typography>
              <Typography variant="body1" className="text-text-secondary grow">
                {item.body}
              </Typography>
              <Button component={Link} href={item.href} variant="contained">
                {item.action}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
