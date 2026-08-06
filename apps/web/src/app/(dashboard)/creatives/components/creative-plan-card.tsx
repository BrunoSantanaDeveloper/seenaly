"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiBulbOn from "@/icons/nexture/ni-bulb-on";
import NiCalendar from "@/icons/nexture/ni-calendar";
import NiCamera from "@/icons/nexture/ni-camera";
import NiCheck from "@/icons/nexture/ni-check";
import NiChevronDown from "@/icons/nexture/ni-chevron-down";
import NiClipboard from "@/icons/nexture/ni-clipboard";
import NiFlask from "@/icons/nexture/ni-flask";
import NiListCheck from "@/icons/nexture/ni-list-check";
import { buildCadence } from "@/lib/creative-plan/cadence";
import type { Confidence, CreativePlanHypothesis, CreativePlanOutput } from "@/lib/creative-plan/schema";
import { isCreativeEmotion, isCreativeFormat, isProofType } from "@/lib/creative-taxonomy";
import { cn } from "@/lib/utils";
import { MINIMUM_ORGANIC_COHORT_SIZE } from "@flyee/organic-growth";

/**
 * Who is here: a product owner (often with an EMPTY library) who needs to know
 * which creative evidence to generate before paying for it in media. The job:
 * turn each hypothesis into real work — a library brief, a copiable prompt, a
 * tracked experiment — and watch coverage move. Success: every hypothesis has
 * a creative, its pieces published, and enough volume for a cohort read.
 *
 * The coverage states are MACHINE-VERIFIED (plan links + organic publication
 * counts from the DB), which is what makes showing progress here honest — the
 * user cannot tick anything by assertion (app-ux rule).
 */

const CONFIDENCE_COLOR: Record<Confidence, "warning" | "primary" | "success"> = {
  baixa: "warning",
  media: "primary",
  alta: "success",
};

export interface PlanMeta {
  createdAt: string;
  knowledgeRefs: { title: string; trust_level: number }[];
}

/** Real state of one hypothesis, read from the database — never asserted. */
export interface HypothesisCoverage {
  creativeId?: string;
  /** Organic publications linked to the materialized creative. */
  organicCount: number;
  experimentId?: string;
}

/** 2/3/5 pieces a week — the range this product's own docs corpus treats as
 *  a realistic solo-operator cadence, never a promise of reach or reading. */
const PACE_OPTIONS = [2, 3, 5] as const;
const DEFAULT_PACE = 3;

export default function CreativePlanCard({
  productId,
  plan,
  meta,
  coverage,
  onMaterialize,
  materializingKey,
  onRegisterExperiment,
  registeringKey,
  onRegenerate,
  regenerating,
  regenerateCost = 0,
  creativeHref,
  experimentHref,
}: {
  /** Scopes the pace preference in localStorage — a per-product choice, not a global one. */
  productId: string;
  plan: CreativePlanOutput;
  meta: PlanMeta;
  coverage: Record<string, HypothesisCoverage>;
  /** Hypothesis → library creative, tags pre-filled (idempotent server-side). */
  onMaterialize?: (key: string) => void;
  materializingKey?: string | null;
  /** Hypothesis → tracked organic experiment in the journal. */
  onRegisterExperiment?: (key: string) => void;
  registeringKey?: string | null;
  onRegenerate?: () => void;
  regenerating?: boolean;
  regenerateCost?: number;
  creativeHref?: (creativeId: string) => string;
  experimentHref?: (experimentId: string) => string;
}) {
  const t = useTranslations("creatives");
  const tOrganic = useTranslations("organicGrowth");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // The pace is the USER's declared assumption, never the engine's — it only
  // reshapes volume_note's honest range into a week-by-week view, it never
  // promises reach or a publishing deadline (docs/PRODUCT.md: "faixa
  // condicional, nunca prazo prometido").
  const [pace, setPace] = useState<number>(DEFAULT_PACE);

  useEffect(() => {
    const stored = window.localStorage.getItem(`seenaly:plan-pace:${productId}`);
    const parsed = stored ? Number(stored) : NaN;
    setPace(PACE_OPTIONS.includes(parsed as (typeof PACE_OPTIONS)[number]) ? parsed : DEFAULT_PACE);
  }, [productId]);

  const changePace = (value: number) => {
    setPace(value);
    window.localStorage.setItem(`seenaly:plan-pace:${productId}`, String(value));
  };

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const copyPrompt = async (hypothesis: CreativePlanHypothesis) => {
    try {
      await navigator.clipboard.writeText(hypothesis.prompt_brief);
      setCopiedKey(hypothesis.key);
      window.setTimeout(() => setCopiedKey((current) => (current === hypothesis.key ? null : current)), 2500);
    } catch {
      // Clipboard can be unavailable (permissions); the prompt text is visible
      // right above the button, so manual selection remains the fallback.
    }
  };

  const tagLabel = {
    format: (value: string) => (isCreativeFormat(value) ? t(`format-${value}`) : value),
    proof: (value: string) => (isProofType(value) ? t(`proof-${value}`) : value),
    emotion: (value: string) => (isCreativeEmotion(value) ? t(`emotion-${value}`) : value),
    funnel: (value: string) => {
      try {
        return tOrganic(`funnel-${value}`);
      } catch {
        return value;
      }
    },
  };

  /**
   * The coverage strip: the hypothesis' real journey, four honest steps. Each
   * lights up only from DB facts (link row, publication count, cohort floor).
   */
  const coverageStrip = (hypothesis: CreativePlanHypothesis) => {
    const state = coverage[hypothesis.key] ?? { organicCount: 0 };
    const inLibrary = Boolean(state.creativeId);
    const published = state.organicCount > 0;
    const readable = state.organicCount >= MINIMUM_ORGANIC_COHORT_SIZE;
    const steps: { label: string; done: boolean }[] = [
      { label: t("plan-step-library"), done: inLibrary },
      { label: t("plan-step-published", { count: state.organicCount }), done: published },
      {
        label: t("plan-step-read", {
          count: Math.min(state.organicCount, MINIMUM_ORGANIC_COHORT_SIZE),
          min: MINIMUM_ORGANIC_COHORT_SIZE,
        }),
        done: readable,
      },
    ];
    return (
      <Box className="flex flex-row flex-wrap items-center gap-1.5">
        {steps.map((step, index) => (
          <Box key={index} className="flex flex-row items-center gap-1.5">
            {index > 0 && <NiArrowRight size="tiny" aria-hidden className="text-text-disabled" />}
            <Chip
              label={step.label}
              size="small"
              variant="outlined"
              color={step.done ? "success" : "grey"}
              icon={step.done ? <NiCheck size="tiny" /> : undefined}
              className="flex-none"
            />
          </Box>
        ))}
      </Box>
    );
  };

  const hypothesisCard = (hypothesis: CreativePlanHypothesis) => {
    const state = coverage[hypothesis.key] ?? { organicCount: 0 };
    const open = expanded.has(hypothesis.key);
    return (
      <Box key={hypothesis.key} className="border-grey-100 flex flex-col gap-3 rounded-2xl border p-4">
        <Box className="flex flex-row flex-wrap items-start gap-2">
          <span className="bg-primary/10 text-primary mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-xl">
            <NiBulbOn size="small" aria-hidden />
          </span>
          <Box className="min-w-0 grow">
            <Typography variant="subtitle1" component="h4" className="mb-0">
              {hypothesis.angle}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("plan-hook-label")}: {hypothesis.hook}
            </Typography>
          </Box>
        </Box>

        <Box className="flex flex-row flex-wrap gap-1">
          <Chip label={tagLabel.format(hypothesis.format)} size="small" variant="outlined" color="primary" />
          <Chip label={tagLabel.proof(hypothesis.proof_type)} size="small" variant="outlined" color="grey" />
          <Chip label={tagLabel.emotion(hypothesis.emotion)} size="small" variant="outlined" color="grey" />
          <Chip label={tagLabel.funnel(hypothesis.funnel_stage)} size="small" variant="outlined" color="grey" />
          <Chip
            label={t("plan-content-count", { count: hypothesis.content_count })}
            size="small"
            variant="outlined"
            color="grey"
          />
        </Box>

        {coverageStrip(hypothesis)}

        <Typography variant="body2" className="leading-6">
          {hypothesis.rationale}
        </Typography>

        <Box className="flex flex-row flex-wrap items-center gap-2">
          {state.creativeId ? (
            creativeHref ? (
              <Button
                component={Link}
                href={creativeHref(state.creativeId)}
                size="small"
                variant="outlined"
                color="grey"
                startIcon={<NiCamera size="small" />}
              >
                {t("plan-open-creative")}
              </Button>
            ) : null
          ) : onMaterialize ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<NiCamera size="small" />}
              disabled={materializingKey != null}
              onClick={() => onMaterialize(hypothesis.key)}
            >
              {materializingKey === hypothesis.key ? t("plan-materializing") : t("plan-materialize")}
            </Button>
          ) : null}

          {state.experimentId ? (
            experimentHref ? (
              <Button
                component={Link}
                href={experimentHref(state.experimentId)}
                size="small"
                variant="outlined"
                color="grey"
                startIcon={<NiFlask size="small" />}
              >
                {t("plan-open-experiment")}
              </Button>
            ) : null
          ) : onRegisterExperiment ? (
            <Button
              size="small"
              variant="outlined"
              color="grey"
              startIcon={<NiFlask size="small" />}
              disabled={registeringKey != null}
              onClick={() => onRegisterExperiment(hypothesis.key)}
            >
              {registeringKey === hypothesis.key ? t("plan-registering") : t("plan-register-experiment")}
            </Button>
          ) : null}

          <Button
            variant="text"
            color="grey"
            size="small"
            onClick={() => toggle(hypothesis.key)}
            endIcon={<NiChevronDown size="small" className={cn("transition-transform", open && "rotate-180")} />}
            aria-expanded={open}
          >
            {open ? t("plan-hide-brief") : t("plan-show-brief")}
          </Button>
        </Box>

        <Collapse in={open} unmountOnExit>
          <Box className="border-grey-50 flex flex-col gap-3 border-t pt-3">
            <Box className="bg-grey-25/60 flex flex-col gap-2 rounded-2xl p-4">
              <Typography variant="subtitle2" className="text-text-secondary uppercase">
                {t("plan-prompt-title")}
              </Typography>
              <Typography variant="body2" className="leading-6 whitespace-pre-wrap">
                {hypothesis.prompt_brief}
              </Typography>
              <Box className="flex flex-row items-center gap-2">
                <Button
                  size="small"
                  variant="outlined"
                  color="grey"
                  startIcon={<NiClipboard size="small" />}
                  onClick={() => copyPrompt(hypothesis)}
                >
                  {copiedKey === hypothesis.key ? t("plan-prompt-copied") : t("plan-prompt-copy")}
                </Button>
                <Typography variant="body2" className="text-text-secondary">
                  {t("plan-prompt-hint")}
                </Typography>
              </Box>
            </Box>

            <Box className="flex flex-col gap-0.5">
              <Typography variant="subtitle2" className="text-text-secondary uppercase">
                {t("plan-success-title")}
              </Typography>
              <Typography variant="body2" className="leading-6">
                {hypothesis.success_criterion}
              </Typography>
            </Box>

            {hypothesis.technical_basis.length > 0 && (
              <Box className="flex flex-col gap-0.5">
                <Typography variant="subtitle2" className="text-text-secondary uppercase">
                  {t("plan-basis-title")}
                </Typography>
                {hypothesis.technical_basis.map((basis, basisIndex) => (
                  <Typography key={basisIndex} variant="body2" className="leading-6">
                    {basis.rule} <span className="text-text-secondary">{basis.citation}</span>
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>
    );
  };

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-4">
        <Box className="flex flex-row flex-wrap items-center gap-3">
          <span className="bg-primary/10 text-primary flex h-12 w-12 flex-none items-center justify-center rounded-2xl">
            <NiListCheck size="medium" aria-hidden />
          </span>
          <Box className="grow">
            <Typography variant="h5" component="h3" className="card-title mb-0">
              {t("plan-title")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("plan-meta", { when: new Date(meta.createdAt).toLocaleDateString() })}
            </Typography>
          </Box>
          <Chip
            label={`${t("plan-confidence")}: ${t(`plan-confidence-${plan.confidence}`)}`}
            size="small"
            variant="outlined"
            color={CONFIDENCE_COLOR[plan.confidence]}
            className="flex-none"
          />
        </Box>

        <Typography variant="body1" className="leading-6">
          {plan.diagnosis}
        </Typography>

        {plan.insufficient_data && (
          <Alert severity="info" className="neutral bg-background-paper/60!">
            <Typography variant="subtitle2">{t("plan-insufficient-title")}</Typography>
            <Typography variant="body2">{plan.missing_data || t("plan-insufficient-body")}</Typography>
          </Alert>
        )}

        {plan.hypotheses.length > 0 && <Box className="flex flex-col gap-3">{plan.hypotheses.map(hypothesisCard)}</Box>}

        {/* The concrete answer to "what do I record THIS week?" — volume_note
            already states the honest conditional math in prose; this turns
            the SAME hypotheses (already ordered most-promising-first) into a
            calendar, at a pace the user declares, never the engine. */}
        {plan.hypotheses.length > 0 &&
          (() => {
            const cadence = buildCadence(
              plan.hypotheses.map((h) => ({ key: h.key, angle: h.angle, content_count: h.content_count })),
              pace,
            );
            return (
              <Box className="border-grey-100 flex flex-col gap-3 rounded-2xl border p-4">
                <Box className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <Box className="flex flex-row items-center gap-2">
                    <NiCalendar size="small" className="text-text-secondary" aria-hidden />
                    <Typography variant="subtitle2" className="mb-0">
                      {t("plan-cadence-title")}
                    </Typography>
                  </Box>
                  <Select
                    size="small"
                    value={pace}
                    onChange={(event) => changePace(Number(event.target.value))}
                    aria-label={t("plan-cadence-pace-label")}
                  >
                    {PACE_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {t("plan-cadence-pace-option", { count: option })}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
                <Box className="flex flex-col gap-2">
                  {cadence.weeks.map((week) => (
                    <Box key={week.week} className="flex flex-row items-start gap-2">
                      <Chip
                        label={t("plan-cadence-week", { week: week.week })}
                        size="small"
                        variant="outlined"
                        color="primary"
                        className="mt-0.5 flex-none"
                      />
                      <Box className="flex min-w-0 flex-col gap-0.5">
                        {week.entries.map((entry) => (
                          <Typography key={entry.key} variant="body2" className="leading-6">
                            {t("plan-cadence-entry", { count: entry.count, angle: entry.angle })}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Typography variant="body2" className="text-text-secondary">
                  {t("plan-cadence-hint", { weeks: cadence.totalWeeks })}
                </Typography>
              </Box>
            );
          })()}

        <Box className="bg-grey-25/60 flex flex-col gap-1.5 rounded-2xl p-4">
          <Typography variant="body2" className="leading-6">
            {plan.volume_note}
          </Typography>
          <Typography variant="body2" className="text-text-secondary leading-6">
            {plan.transfer_caveat}
          </Typography>
        </Box>

        {!plan.insufficient_data && plan.missing_data && (
          <Typography variant="body2" className="text-text-secondary">
            {t("plan-missing-data")}: {plan.missing_data}
          </Typography>
        )}

        {meta.knowledgeRefs.length > 0 && (
          <Box className="flex flex-col gap-1">
            <Typography variant="body2" className="text-text-secondary">
              {t("plan-grounded-in")}
            </Typography>
            <Box className="flex flex-row flex-wrap gap-1">
              {meta.knowledgeRefs.slice(0, 6).map((ref, index) => (
                <Chip key={index} label={ref.title} size="small" variant="outlined" color="grey" />
              ))}
            </Box>
          </Box>
        )}

        {onRegenerate && (
          <>
            <Divider />
            <Box className="flex flex-row flex-wrap items-center justify-between gap-2">
              <Typography variant="body2" className="text-text-secondary">
                {t("plan-regenerate-hint")}
              </Typography>
              <Button size="small" variant="outlined" color="grey" disabled={regenerating} onClick={onRegenerate}>
                {regenerating
                  ? t("plan-generating")
                  : regenerateCost > 0
                    ? t("plan-regenerate-cost", { cost: regenerateCost })
                    : t("plan-regenerate")}
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
