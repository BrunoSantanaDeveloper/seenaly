"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Menu,
  MenuItem,
  Select,
  Typography,
  useMediaQuery,
} from "@mui/material";

import LoadErrorState from "@/components/product/load-error-state";
import NiCamera from "@/icons/nexture/ni-camera";
import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiDatabase from "@/icons/nexture/ni-database";
import NiFlask from "@/icons/nexture/ni-flask";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiTag from "@/icons/nexture/ni-tag";
import NiTrendUp from "@/icons/nexture/ni-trend-up";
import { cn } from "@/lib/utils";

export type ProductWorkspaceStage =
  | "context"
  | "readiness"
  | "data"
  | "diagnosis"
  | "experiments"
  | "creatives"
  | "funnel"
  | "organic";

export type ProductWorkspaceProduct = {
  id: string;
  orgId: string;
  name: string;
  status: string;
};

export type ProductWorkspaceProgress = {
  hasReadiness: boolean;
  hasDiagnosis: boolean;
  hasExperiment: boolean;
  hasData: boolean;
};

type ProductWorkspaceContextValue = {
  product: ProductWorkspaceProduct;
  products: ProductWorkspaceProduct[];
  progress: ProductWorkspaceProgress;
  stage: ProductWorkspaceStage;
  href: (stage: ProductWorkspaceStage, productId?: string) => string;
  switchProduct: (productId: string) => void;
};

const ProductWorkspaceContext = createContext<ProductWorkspaceContextValue | null>(null);

export const productWorkspaceHref = (productId: string, stage: ProductWorkspaceStage) => {
  const base = `/products/${productId}`;
  if (stage === "context") return base;
  return `${base}/${stage}`;
};

export const useProductWorkspace = () => {
  const context = useContext(ProductWorkspaceContext);
  if (!context) throw new Error("useProductWorkspace must be used inside ProductWorkspace");
  return context;
};

export const useOptionalProductWorkspace = () => useContext(ProductWorkspaceContext);

export default function ProductWorkspace({
  product,
  products,
  progress,
  loadError = false,
  children,
}: PropsWithChildren<{
  product: ProductWorkspaceProduct;
  products: ProductWorkspaceProduct[];
  progress: ProductWorkspaceProgress;
  loadError?: boolean;
}>) {
  const t = useTranslations("workspace");
  const pathname = usePathname();
  const router = useRouter();
  const mobile = useMediaQuery("(max-width:900px)");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const segment = pathname.split("/")[3] as ProductWorkspaceStage | undefined;
  const stage: ProductWorkspaceStage = segment ?? "context";
  const href = useCallback(
    (target: ProductWorkspaceStage, targetProductId = product.id) => productWorkspaceHref(targetProductId, target),
    [product.id],
  );

  useEffect(() => {
    window.localStorage.setItem(`seenaly:last-product:${product.orgId}`, product.id);
  }, [product.id, product.orgId]);

  const switchProduct = useCallback(
    (productId: string) => {
      window.localStorage.setItem(`seenaly:last-product:${product.orgId}`, productId);
      router.push(href(stage, productId));
    },
    [href, product.orgId, router, stage],
  );

  const stages = useMemo(
    () => [
      { id: "context" as const, icon: <NiTag size="small" />, done: true },
      { id: "readiness" as const, icon: <NiShieldCheck size="small" />, done: progress.hasReadiness },
      { id: "data" as const, icon: <NiDatabase size="small" />, done: progress.hasData, optional: true },
      { id: "diagnosis" as const, icon: <NiPulse size="small" />, done: progress.hasDiagnosis },
      { id: "experiments" as const, icon: <NiFlask size="small" />, done: progress.hasExperiment },
    ],
    [progress],
  );
  const current = stages.find((item) => item.id === stage) ?? stages[0];
  const next = !progress.hasReadiness
    ? ("readiness" as const)
    : !progress.hasDiagnosis
      ? ("diagnosis" as const)
      : ("experiments" as const);

  const contextValue = useMemo<ProductWorkspaceContextValue>(
    () => ({ product, products, progress, stage, href, switchProduct }),
    [href, product, products, progress, stage, switchProduct],
  );

  const desktopStageLinks = stages.map((item, index) => (
    <Button
      key={item.id}
      component={Link}
      href={href(item.id)}
      variant={item.id === stage ? "pastel" : "text"}
      color={item.id === stage ? "primary" : "grey"}
      size="small"
      startIcon={item.icon}
      aria-current={item.id === stage ? "step" : undefined}
      className="justify-start"
      onClick={() => setAnchor(null)}
    >
      {t(`stage-${item.id}`)}
      {item.optional ? ` · ${t("optional")}` : ""}
      <span className="sr-only">{item.done ? t("complete") : t("pending")}</span>
      <span aria-hidden className="ml-1 text-xs">
        {index + 1}
      </span>
    </Button>
  ));

  const mobileStageLinks = stages.map((item, index) => (
    <MenuItem
      key={item.id}
      component={Link}
      href={href(item.id)}
      selected={item.id === stage}
      aria-current={item.id === stage ? "step" : undefined}
      onClick={() => setAnchor(null)}
      className="flex gap-2"
    >
      {item.icon}
      <span className="grow">
        {index + 1}. {t(`stage-${item.id}`)}
        {item.optional ? ` · ${t("optional")}` : ""}
      </span>
      <span className="sr-only">{item.done ? t("complete") : t("pending")}</span>
    </MenuItem>
  ));

  return (
    <ProductWorkspaceContext.Provider value={contextValue}>
      <Box className="mb-5 flex flex-col gap-3">
        {loadError && (
          <LoadErrorState
            title={t("load-error-title")}
            description={t("load-error-body")}
            retryLabel={t("retry")}
            onRetry={() => router.refresh()}
          />
        )}
        <Card component="section">
          <CardContent className="flex flex-col gap-4">
            <Box className="flex flex-row flex-wrap items-center gap-3">
              <span className="bg-primary/10 text-primary-dark dark:text-primary-light flex h-11 w-11 items-center justify-center rounded-2xl">
                <NiTag size="medium" />
              </span>
              <Box className="min-w-0 grow">
                <Typography variant="body2" className="text-text-secondary">
                  {t("eyebrow")}
                </Typography>
                <Typography variant="h4" component="h1" className="mb-0 truncate">
                  {product.name}
                </Typography>
              </Box>
              <Chip label={t(`status-${product.status}`)} size="small" variant="outlined" color="grey" />
              {products.length > 1 && (
                <FormControl className="outlined min-w-52" variant="standard" size="small">
                  <Select
                    value={product.id}
                    aria-label={t("switch-product")}
                    IconComponent={NiChevronDownSmall}
                    onChange={(event) => switchProduct(event.target.value)}
                  >
                    {products.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>

            {mobile ? (
              <>
                <Button
                  variant="outlined"
                  color="grey"
                  fullWidth
                  startIcon={current.icon}
                  endIcon={<NiChevronDownSmall size="small" />}
                  aria-haspopup="menu"
                  aria-expanded={Boolean(anchor)}
                  onClick={(event) => setAnchor(event.currentTarget)}
                >
                  {t("mobile-stages", { stage: t(`stage-${current.id}`) })}
                </Button>
                <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
                  {mobileStageLinks}
                </Menu>
              </>
            ) : (
              <Box component="nav" aria-label={t("stages-label")} className="flex flex-row flex-wrap gap-1">
                {desktopStageLinks}
              </Box>
            )}

            <Box className="border-grey-50 flex flex-row flex-wrap items-center gap-1 border-t pt-3">
              <Typography variant="body2" className="text-text-secondary mr-1">
                {t("supporting-label")}
              </Typography>
              <Button
                component={Link}
                href={href("creatives")}
                variant="text"
                color="grey"
                size="small"
                startIcon={<NiCamera size="small" />}
              >
                {t("support-creatives")}
              </Button>
              <Button
                component={Link}
                href={href("funnel")}
                variant="text"
                color="grey"
                size="small"
                startIcon={<NiChartFunnel size="small" />}
              >
                {t("support-funnel")}
              </Button>
              <Button
                component={Link}
                href={href("organic")}
                variant="text"
                color="grey"
                size="small"
                startIcon={<NiTrendUp size="small" />}
              >
                {t("support-organic")}
              </Button>
              {stage !== next && (
                <Button
                  component={Link}
                  href={href(next)}
                  variant="contained"
                  size="small"
                  className={cn("ml-auto", mobile && "w-full")}
                >
                  {t("next-action", { stage: t(`stage-${next}`) })}
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>
      {children}
    </ProductWorkspaceContext.Provider>
  );
}
