"use client";

import SettingsMenu from "../components/settings-menu";
import RecentActivityCard from "./components/recent-activity-card";
import TwoFactorCard from "./components/two-factor-card";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert, Box, Breadcrumbs, Button, Drawer, Grid, Tooltip, Typography } from "@mui/material";

import NiListCircle from "@/icons/nexture/ni-list-circle";
import { isSupabaseConfigured } from "@flyee/auth";

export default function SecuritySettings() {
  const t = useTranslations("settings");
  const [openDrawer, setOpenDrawer] = useState(false);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpenDrawer(newOpen);
  };

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"auto"} className="hidden pr-8 lg:flex">
        <SettingsMenu active="security" />
      </Grid>
      <Grid size={"grow"} spacing={5} container>
        <Grid size={12} spacing={2.5} container>
          <Grid size={{ xs: 12, md: "grow" }}>
            <Typography variant="h1" component="h1" className="mb-0">
              {t("security-title")}
            </Typography>
            <Breadcrumbs>
              <Link color="inherit" href="/home">
                {t("crumb-home")}
              </Link>
              <Link color="inherit" href="/settings">
                {t("crumb-settings")}
              </Link>
              <Typography variant="body2">{t("security-title")}</Typography>
            </Breadcrumbs>
          </Grid>
          <Grid size={{ xs: 12, md: "auto" }} className="lg:hidden">
            <Tooltip title={t("toc")}>
              <Button
                className="icon-only surface-standard"
                color="grey"
                variant="surface"
                onClick={toggleDrawer(true)}
              >
                <NiListCircle size={"medium"} />
              </Button>
            </Tooltip>
          </Grid>
        </Grid>

        {!isSupabaseConfigured && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable
              security settings.
            </Alert>
          </Grid>
        )}

        {isSupabaseConfigured && <TwoFactorCard />}
        {isSupabaseConfigured && <RecentActivityCard />}

        <Drawer open={openDrawer} anchor="right" onClose={toggleDrawer(false)}>
          <Box className="min-w-80 p-7">
            <SettingsMenu active="security" />
          </Box>
        </Drawer>
      </Grid>
    </Grid>
  );
}
