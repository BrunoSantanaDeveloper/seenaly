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

import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiPlus from "@/icons/nexture/ni-plus";
import NiTag from "@/icons/nexture/ni-tag";
import { createClient } from "@flyee/auth/client";

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
  const router = useRouter();
  const { configured, loading, orgs, currentOrg, setCurrentOrgId } = useOrganization();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentOrg) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("id, name, status, main_promise, updated_at")
      .eq("org_id", currentOrg.id)
      .order("updated_at", { ascending: false });
    setRows(data ?? []);
    setLoaded(true);
  }, [currentOrg]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
              <Button
                variant="contained"
                startIcon={<NiPlus size="small" />}
                disabled={!currentOrg}
                onClick={() => router.push("/products/new")}
              >
                {t("new-product")}
              </Button>
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

        {currentOrg && loaded && rows.length === 0 && (
          <Grid size={12}>
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <NiTag size={36} className="text-primary" />
                <Typography variant="h5" component="h2">
                  {t("empty-title")}
                </Typography>
                <Typography variant="body1" className="text-text-secondary max-w-md">
                  {t("empty-body")}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<NiPlus size="small" />}
                  onClick={() => router.push("/products/new")}
                >
                  {t("empty-cta")}
                </Button>
              </CardContent>
            </Card>
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
