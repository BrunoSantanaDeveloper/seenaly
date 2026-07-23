"use client";

import { useOrganization } from "../settings/organization/components/use-organization";
import ProductsHeader from "./components/products-header";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import ActivationChecklist from "@/components/activation/activation-checklist";
import EmptyState from "@/components/product/empty-state";
import LoadErrorState from "@/components/product/load-error-state";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiPlus from "@/icons/nexture/ni-plus";
import NiTag from "@/icons/nexture/ni-tag";
import { createClient } from "@flyee/auth/client";

/**
 * Job: "which offer am I working on?" — for most users that is one product,
 * so this is a pick-and-enter view (not a management table). A brand-new user
 * sees the activation path instead of an empty grid.
 */

type ProductRow = {
  id: string;
  name: string;
  status: string;
  main_promise: string | null;
  updated_at: string;
};

const STATUS_COLOR: Record<string, "default" | "success" | "warning"> = {
  draft: "warning",
  active: "success",
  archived: "default",
};

export default function ProductsPage() {
  const t = useTranslations("products");
  const tc = useTranslations("productCommon");
  const router = useRouter();
  const { configured, loading, userId, orgs, currentOrg, setCurrentOrgId } = useOrganization();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dataLoadError, setDataLoadError] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentOrg) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, status, main_promise, updated_at")
      .eq("org_id", currentOrg.id)
      .order("updated_at", { ascending: false });
    if (error) {
      setDataLoadError(true);
      setLoaded(true);
      return;
    }
    setDataLoadError(false);
    setRows(data ?? []);
    setLoaded(true);
  }, [currentOrg]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isEmpty = Boolean(currentOrg) && loaded && rows.length === 0;

  return (
    <Grid container spacing={5} className="items-start">
      <Grid size={"grow"} spacing={5} container>
        <ProductsHeader
          title={t("title")}
          crumb={t("title")}
          action={
            <Box className="flex flex-row items-center gap-2">
              {orgs.length > 1 && currentOrg && (
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
              )}
              {/* No "new" button on the empty view — the EmptyState owns that nudge. */}
              {!isEmpty && (
                <Button
                  variant="contained"
                  startIcon={<NiPlus size="small" />}
                  disabled={!currentOrg}
                  onClick={() => router.push("/products/new")}
                >
                  {t("new-product")}
                </Button>
              )}
            </Box>
          }
        />

        {!configured && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("not-configured")}
            </Alert>
          </Grid>
        )}

        {configured && !loading && orgs.length === 0 && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("no-org")}
            </Alert>
          </Grid>
        )}

        {currentOrg && dataLoadError && (
          <Grid size={12}>
            <LoadErrorState
              title={tc("load-error-title")}
              description={tc("load-error-body")}
              retryLabel={tc("retry")}
              onRetry={() => {
                setDataLoadError(false);
                refresh();
              }}
            />
          </Grid>
        )}

        {/* The path to value: visible from the very first visit.
            Renders its own grid slot, or nothing once dismissed/complete. */}
        {currentOrg && userId && <ActivationChecklist orgId={currentOrg.id} userId={userId} />}

        {!dataLoadError && isEmpty && (
          <Grid size={12}>
            <EmptyState
              icon={<NiTag />}
              title={t("empty-title")}
              description={t("empty-body")}
              action={{ label: t("empty-cta"), href: "/products/new" }}
            />
          </Grid>
        )}

        {rows.map((row) => (
          <Grid key={row.id} size={{ xs: 12, md: 6, xl: 4 }}>
            <Card
              component={Link}
              href={`/products/${row.id}`}
              className="hover:shadow-darker-sm block h-full no-underline transition-shadow"
            >
              <CardContent className="flex flex-col gap-2">
                <Box className="flex flex-row items-center gap-2">
                  <Typography variant="subtitle1" className="grow truncate">
                    {row.name}
                  </Typography>
                  <Chip
                    label={t(`status-${row.status}`)}
                    size="small"
                    variant="outlined"
                    color={STATUS_COLOR[row.status] ?? "default"}
                  />
                </Box>
                <Typography variant="body2" className="text-text-secondary line-clamp-2 min-h-10">
                  {row.main_promise || t("no-promise")}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Grid>
  );
}
