"use client";

import { useTranslations } from "next-intl";

import { Box, CircularProgress, Typography } from "@mui/material";

import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";
import NiCreditCard from "@/icons/nexture/ni-credit-card";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiScreen from "@/icons/nexture/ni-screen";
import NiSearch from "@/icons/nexture/ni-search";
import type { ReadinessEvaluation, ReadinessGroupKey, ReadinessGroupProgress } from "@/lib/readiness/checklist";

const GROUP_ICON: Record<ReadinessGroupKey, React.ReactNode> = {
  mensuracao: <NiPulse size="small" />,
  pagina: <NiScreen size="small" />,
  checkout: <NiCreditCard size="small" />,
  descoberta: <NiSearch size="small" />,
  funil: <NiChartFunnel size="small" />,
};

/**
 * One dimension's progress ring — the honest, inforgeable version.
 *
 * Two arcs on the same circle: the outer PRIMARY arc is everything "done"
 * (`achieved`), and the SUCCESS arc laid over its start is the slice the page
 * scan actually PROVED (`verified`). Because a provable item only enters
 * `achieved` once the scanner sees it, the gold arc can never be inflated by
 * ticking a box — it is competence feedback that cannot lie.
 *
 * Declared items (CAPI, PIX — invisible to any scan) still fill the primary arc
 * when confirmed, so a dimension the scanner can't reach is never shamed with a
 * permanently empty ring.
 */
export function DimensionRing({ progress, label }: { progress: ReadinessGroupProgress; label: string }) {
  const t = useTranslations("readiness");
  const { applicable, achieved, verified } = progress;
  const pct = (value: number) => (applicable > 0 ? Math.round((value / applicable) * 100) : 0);
  const fullyProven = applicable > 0 && verified === applicable;

  return (
    <Box
      role="group"
      aria-label={t("progress-ring-aria", { group: label, achieved, applicable, verified })}
      className="flex w-16 flex-col items-center gap-1 text-center"
    >
      <Box className="relative h-12 w-12">
        {/* Track behind both arcs — the ring the arcs fill in. */}
        <Box className="border-grey-100 absolute inset-0 rounded-full border-[3px]" aria-hidden />
        <CircularProgress
          aria-hidden
          variant="determinate"
          value={pct(achieved)}
          size={48}
          thickness={4.5}
          color="primary"
          className="absolute inset-0"
        />
        {verified > 0 && (
          <CircularProgress
            aria-hidden
            variant="determinate"
            value={pct(verified)}
            size={48}
            thickness={4.5}
            color="success"
            className="absolute inset-0"
          />
        )}
        <Box
          aria-hidden
          className="absolute inset-0 flex items-center justify-center"
          sx={{ color: fullyProven ? "success.main" : "primary.main" }}
        >
          {GROUP_ICON[progress.key]}
        </Box>
      </Box>
      <Typography variant="caption" component="span" className="leading-tight font-medium">
        {label}
      </Typography>
      <Typography variant="caption" component="span" className="text-text-secondary leading-none">
        {applicable > 0 ? t("progress-ring-of", { achieved, applicable }) : t("progress-ring-na")}
      </Typography>
      {verified > 0 && (
        <Typography variant="caption" component="span" className="leading-none" sx={{ color: "success.main" }}>
          {t("progress-ring-verified", { count: verified })}
        </Typography>
      )}
    </Box>
  );
}

/**
 * The five-dimension progress rail plus the headline number: how much of the
 * structure the page scan has PROVED. This is the celebration surface — a
 * standing, honest scoreboard whose only currency is proof.
 */
export default function DimensionRings({ evaluation }: { evaluation: ReadinessEvaluation }) {
  const t = useTranslations("readiness");
  const totalVerified = evaluation.verified.length;

  return (
    <Box className="flex flex-col gap-3">
      <Box>
        <Typography variant="subtitle2" className="mb-0">
          {totalVerified > 0 ? t("progress-verified-headline", { count: totalVerified }) : t("progress-none-title")}
        </Typography>
        <Typography variant="body2" className="text-text-secondary">
          {totalVerified > 0 ? t("progress-verified-sub") : t("progress-none-sub")}
        </Typography>
      </Box>
      <Box className="flex flex-row flex-wrap items-start justify-center gap-4 sm:justify-between">
        {evaluation.byGroup.map((progress) => (
          <DimensionRing key={progress.key} progress={progress} label={t(`wizard-short-${progress.key}`)} />
        ))}
      </Box>
    </Box>
  );
}
