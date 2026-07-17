"use client";

import SettingsMenu from "../components/settings-menu";
import CurrentSubscription from "./components/current-subscription";
import InvoicesCard from "./components/invoices-card";
import PlansGrid from "./components/plans-grid";
import { useBilling } from "./components/use-billing";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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
import type { BillingProviderName } from "@flyee/billing";

export default function BillingSettings() {
  const t = useTranslations("billing");
  const [openDrawer, setOpenDrawer] = useState(false);
  const [providers, setProviders] = useState<BillingProviderName[]>([]);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const {
    configured,
    loading,
    orgs,
    currentOrg,
    canManage,
    setCurrentOrgId,
    subscription,
    plans,
    modules,
    invoices,
    creditBalance,
    credits,
    refreshDetails,
  } = useBilling();

  useEffect(() => {
    // Providers depend on server-only env vars — fetch once.
    fetch("/api/billing/providers")
      .then((response) => response.json())
      .then((data) => setProviders(data.providers ?? []))
      .catch(() => setProviders([]));

    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "success") {
      setCheckoutNotice(t("billing-checkout-success"));
    } else if (checkout === "canceled") {
      setCheckoutNotice(t("billing-checkout-canceled"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; t is stable per locale
  }, []);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpenDrawer(newOpen);
  };

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"auto"} className="hidden pr-8 lg:flex">
        <SettingsMenu active="billing" />
      </Grid>
      <Grid size={"grow"} spacing={5} container>
        <Grid size={12} spacing={2.5} container>
          <Grid size={{ xs: 12, md: "grow" }}>
            <Typography variant="h1" component="h1" className="mb-0">
              {t("billing-title")}
            </Typography>
            <Breadcrumbs>
              <Link color="inherit" href="/home">
                {t("crumb-home")}
              </Link>
              <Link color="inherit" href="/settings">
                {t("crumb-settings")}
              </Link>
              <Typography variant="body2">{t("billing-title")}</Typography>
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
              billing.
            </Alert>
          </Grid>
        )}

        {checkoutNotice && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {checkoutNotice}
            </Alert>
          </Grid>
        )}

        {configured && !loading && !currentOrg && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              You do not belong to any organization yet — create one in{" "}
              <Link href="/settings/organization" className="link-primary link-underline-hover">
                organization settings
              </Link>
              .
            </Alert>
          </Grid>
        )}

        {currentOrg && (
          <>
            <CurrentSubscription
              orgId={currentOrg.id}
              subscription={subscription}
              invoices={invoices}
              creditBalance={creditBalance}
              canManage={canManage}
              onChanged={refreshDetails}
            />
            <PlansGrid
              orgId={currentOrg.id}
              subscription={subscription}
              plans={plans}
              modules={modules}
              providers={providers}
              canManage={canManage}
            />
            <InvoicesCard invoices={invoices} credits={credits} />
          </>
        )}

        <Drawer open={openDrawer} anchor="right" onClose={toggleDrawer(false)}>
          <Box className="min-w-80 p-7">
            <SettingsMenu active="billing" />
          </Box>
        </Drawer>
      </Grid>
    </Grid>
  );
}
