"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  ListItemIcon,
  Menu,
  MenuItem,
  MenuList,
  Select,
  Typography,
  useMediaQuery,
} from "@mui/material";

import LoadErrorState from "@/components/product/load-error-state";
import NiCamera from "@/icons/nexture/ni-camera";
import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";
import NiCheck from "@/icons/nexture/ni-check";
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

/**
 * The product context model is the heart of the product (docs/PRODUCT.md), so
 * the rail keeps it on screen while the user reads a diagnosis. Every field is
 * optional by design — the maturity spectrum means a zero-data beginner must
 * never be punished for an empty economics block.
 */
export type ProductWorkspaceEconomics = {
  currency?: string | null;
  avgTicket?: number | null;
  marginPct?: number | null;
  targetCac?: number | null;
  monthlyBudget?: number | null;
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

/** Below this width the rail would squeeze the content column, so it collapses to a menu. */
const RAIL_BREAKPOINT = "(max-width:1199.95px)";

type StageItem = {
  id: ProductWorkspaceStage;
  icon: React.ReactNode;
  /** Journey position — only the sequential path is numbered. */
  step?: number;
  done?: boolean;
  optional?: boolean;
};

export default function ProductWorkspace({
  product,
  products,
  progress,
  economics,
  loadError = false,
  children,
}: PropsWithChildren<{
  product: ProductWorkspaceProduct;
  products: ProductWorkspaceProduct[];
  progress: ProductWorkspaceProgress;
  economics?: ProductWorkspaceEconomics;
  loadError?: boolean;
}>) {
  const t = useTranslations("workspace");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const compact = useMediaQuery(RAIL_BREAKPOINT);
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

  /**
   * Three meaning-based groups instead of the old "primary row + leftovers"
   * split, which was dictated by horizontal space rather than by the product:
   * the journey (ordered, with completion), the optional data sources, and the
   * always-available libraries.
   */
  const groups = useMemo<{ id: string; items: StageItem[] }[]>(
    () => [
      {
        id: "journey",
        items: [
          { id: "context", icon: <NiTag size="small" />, step: 1, done: true },
          { id: "readiness", icon: <NiShieldCheck size="small" />, step: 2, done: progress.hasReadiness },
          { id: "diagnosis", icon: <NiPulse size="small" />, step: 3, done: progress.hasDiagnosis },
          { id: "experiments", icon: <NiFlask size="small" />, step: 4, done: progress.hasExperiment },
        ],
      },
      {
        id: "sources",
        items: [
          { id: "data", icon: <NiDatabase size="small" />, done: progress.hasData, optional: true },
          { id: "organic", icon: <NiTrendUp size="small" />, optional: true },
        ],
      },
      {
        id: "library",
        items: [
          { id: "creatives", icon: <NiCamera size="small" /> },
          { id: "funnel", icon: <NiChartFunnel size="small" /> },
        ],
      },
    ],
    [progress],
  );

  const allItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const current = allItems.find((item) => item.id === stage) ?? allItems[0];
  const next = !progress.hasReadiness
    ? ("readiness" as const)
    : !progress.hasDiagnosis
      ? ("diagnosis" as const)
      : ("experiments" as const);

  const contextValue = useMemo<ProductWorkspaceContextValue>(
    () => ({ product, products, progress, stage, href, switchProduct }),
    [href, product, products, progress, stage, switchProduct],
  );

  const stageLabel = (item: StageItem) => `${item.step ? `${item.step}. ` : ""}${t(`stage-${item.id}`)}`;

  const renderItem = (item: StageItem) => (
    <MenuItem
      key={item.id}
      component={Link}
      href={href(item.id)}
      selected={item.id === stage}
      aria-current={item.id === stage ? "page" : undefined}
      onClick={() => setAnchor(null)}
    >
      <ListItemIcon>{item.icon}</ListItemIcon>
      <span className="grow truncate">{stageLabel(item)}</span>
      {item.optional && (
        <Typography variant="body2" component="span" className="text-text-secondary ml-2 shrink-0">
          {t("optional")}
        </Typography>
      )}
      {item.done !== undefined && (
        <>
          {item.done && <NiCheck size="small" aria-hidden className="text-success ml-2 shrink-0" />}
          <span className="sr-only">{item.done ? t("complete") : t("pending")}</span>
        </>
      )}
    </MenuItem>
  );

  const nav = (
    <Box component="nav" aria-label={t("stages-label")}>
      {groups.map((group) => (
        <Box key={group.id} className="mb-1 last:mb-0">
          <Typography
            variant="body2"
            component="p"
            id={`workspace-group-${group.id}`}
            className="text-text-secondary px-4 pt-3 pb-1 text-xs tracking-wide uppercase"
          >
            {t(`group-${group.id}`)}
          </Typography>
          <MenuList className="p-0" aria-labelledby={`workspace-group-${group.id}`}>
            {group.items.map(renderItem)}
          </MenuList>
        </Box>
      ))}
    </Box>
  );

  const identity = (
    <Box className="flex flex-row items-center gap-3">
      <span className="bg-primary/10 text-primary-dark dark:text-primary-light flex h-11 w-11 flex-none items-center justify-center rounded-2xl">
        <NiTag size="medium" aria-hidden />
      </span>
      <Box className="min-w-0 grow">
        <Typography variant="body2" className="text-text-secondary">
          {t("eyebrow")}
        </Typography>
        <Typography variant="h5" component="h1" className="mb-0 truncate">
          {product.name}
        </Typography>
      </Box>
      <Chip label={t(`status-${product.status}`)} size="small" variant="outlined" color="grey" />
    </Box>
  );

  const switcher = products.length > 1 && (
    <FormControl className="outlined w-full" variant="standard" size="small">
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
  );

  const nextAction = stage !== next && (
    <Button component={Link} href={href(next)} variant="contained" size="small" fullWidth>
      {t("next-action", { stage: t(`stage-${next}`) })}
    </Button>
  );

  return (
    <ProductWorkspaceContext.Provider value={contextValue}>
      {loadError && (
        <Box className="mb-5">
          <LoadErrorState
            title={t("load-error-title")}
            description={t("load-error-body")}
            retryLabel={t("retry")}
            onRetry={() => router.refresh()}
          />
        </Box>
      )}

      {compact ? (
        <>
          <Card component="section" className="mb-5">
            <CardContent className="flex flex-col gap-4">
              {identity}
              {switcher}
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
                {allItems.map(renderItem)}
              </Menu>
              {nextAction}
            </CardContent>
          </Card>
          {children}
        </>
      ) : (
        <Grid container spacing={5} className="items-start">
          <Grid size={3} component="aside" aria-label={t("rail-label")}>
            <Card component="section" className="mb-5">
              <CardContent className="flex flex-col gap-4 px-0">
                <Box className="flex flex-col gap-4 px-6">
                  {identity}
                  {switcher}
                  {nextAction}
                </Box>
                {nav}
              </CardContent>
            </Card>
            <ProductEconomicsCard economics={economics} locale={locale} href={href("context")} />
          </Grid>
          <Grid size={9}>{children}</Grid>
        </Grid>
      )}
    </ProductWorkspaceContext.Provider>
  );
}

/**
 * Persistent product economics — what every recommendation must be read
 * against. Renders only the filled fields; with nothing filled it invites the
 * user to the context form instead of showing an empty card (a beginner with
 * zero economics is a supported state, not an error).
 */
function ProductEconomicsCard({
  economics,
  locale,
  href,
}: {
  economics?: ProductWorkspaceEconomics;
  locale: string;
  href: string;
}) {
  const t = useTranslations("workspace");

  const money = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: economics?.currency || "BRL",
      maximumFractionDigits: 2,
    }).format(value);
  const percent = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value) + "%";

  const rows = [
    { key: "ticket", value: economics?.avgTicket, format: money },
    { key: "margin", value: economics?.marginPct, format: percent },
    { key: "cac", value: economics?.targetCac, format: money },
    { key: "budget", value: economics?.monthlyBudget, format: money },
  ].filter((row): row is { key: string; value: number; format: (value: number) => string } =>
    Number.isFinite(row.value ?? NaN),
  );

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-3">
        <Typography variant="subtitle1" component="h2" className="mb-0">
          {t("economics-title")}
        </Typography>

        {rows.length === 0 ? (
          <>
            <Typography variant="body2" className="text-text-secondary">
              {t("economics-empty")}
            </Typography>
            <Button component={Link} href={href} variant="pastel" color="primary" size="small">
              {t("economics-fill")}
            </Button>
          </>
        ) : (
          <Box className="flex flex-col gap-2">
            {rows.map((row) => (
              <Box key={row.key} className={cn("flex flex-row items-baseline justify-between gap-3")}>
                <Typography variant="body2" component="span" className="text-text-secondary">
                  {t(`economics-${row.key}`)}
                </Typography>
                <Typography variant="body2" component="span" className="font-semibold tabular-nums">
                  {row.format(row.value)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
