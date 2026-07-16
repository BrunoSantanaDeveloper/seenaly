"use client";

import SettingsMenu from "../components/settings-menu";
import OrgCreate from "./components/org-create";
import OrgGeneral from "./components/org-general";
import OrgInvites from "./components/org-invites";
import OrgMembers from "./components/org-members";
import { useOrganization } from "./components/use-organization";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Drawer,
  FormControl,
  Grid,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";

import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiListCircle from "@/icons/nexture/ni-list-circle";

export default function OrganizationSettings() {
  const t = useTranslations("settings");
  const [openDrawer, setOpenDrawer] = useState(false);
  const {
    configured,
    loading,
    userId,
    orgs,
    currentOrg,
    setCurrentOrgId,
    members,
    invites,
    refreshOrgs,
    refreshOrgDetails,
  } = useOrganization();

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpenDrawer(newOpen);
  };

  const handleChanged = () => {
    refreshOrgs();
    refreshOrgDetails();
  };

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"auto"} className="hidden pr-8 lg:flex">
        <SettingsMenu active="organization" />
      </Grid>
      <Grid size={"grow"} spacing={5} container>
        <Grid size={12} spacing={2.5} container>
          <Grid size={{ xs: 12, md: "grow" }}>
            <Typography variant="h1" component="h1" className="mb-0">
              {t("org-title")}
            </Typography>
            <Breadcrumbs>
              <Link color="inherit" href="/home">
                {t("crumb-home")}
              </Link>
              <Link color="inherit" href="/settings">
                {t("crumb-settings")}
              </Link>
              <Typography variant="body2">{t("org-title")}</Typography>
            </Breadcrumbs>
          </Grid>
          {orgs.length > 1 && currentOrg && (
            <Grid size={{ xs: 12, md: "auto" }}>
              <FormControl className="outlined w-56" variant="standard" size="small">
                <Select
                  value={currentOrg.id}
                  size="small"
                  variant="standard"
                  IconComponent={NiChevronDownSmall}
                  onChange={(e) => setCurrentOrgId(e.target.value)}
                >
                  {orgs.map((org) => (
                    <MenuItem key={org.id} value={org.id}>
                      {org.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
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

        {!configured && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable
              organizations.
            </Alert>
          </Grid>
        )}

        {configured && !loading && orgs.length === 0 && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("org-no-org")}
            </Alert>
          </Grid>
        )}

        {currentOrg && (
          <>
            <OrgGeneral org={currentOrg} onUpdated={handleChanged} />
            <OrgMembers org={currentOrg} members={members} currentUserId={userId} onChanged={handleChanged} />
            <OrgInvites org={currentOrg} invites={invites} onChanged={refreshOrgDetails} />
          </>
        )}

        {configured && <OrgCreate onCreated={handleChanged} />}

        <Drawer open={openDrawer} anchor="right" onClose={toggleDrawer(false)}>
          <Box className="min-w-80 p-7">
            <SettingsMenu active="organization" />
          </Box>
        </Drawer>
      </Grid>
    </Grid>
  );
}
