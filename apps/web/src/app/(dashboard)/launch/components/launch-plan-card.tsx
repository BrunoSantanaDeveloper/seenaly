"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Alert, Box, Button, Card, CardContent, Chip, Divider, Typography } from "@mui/material";

import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiCalendar from "@/icons/nexture/ni-calendar";
import NiCheck from "@/icons/nexture/ni-check";
import NiCrosshair from "@/icons/nexture/ni-crosshair";
import NiExclamationHexagon from "@/icons/nexture/ni-exclamation-hexagon";
import NiFlask from "@/icons/nexture/ni-flask";
import NiLayout from "@/icons/nexture/ni-layout";
import NiListNumber from "@/icons/nexture/ni-list-number";
import NiLock from "@/icons/nexture/ni-lock";
import NiMoney from "@/icons/nexture/ni-money";
import NiRocket from "@/icons/nexture/ni-rocket";
import NiStopwatch from "@/icons/nexture/ni-stopwatch";
import type { Confidence } from "@/lib/diagnosis/schema";
import type { OptimizationEventBasis } from "@/lib/launch-plan/math";
import type { LaunchPlanOutput, TargetingPosture } from "@/lib/launch-plan/schema";
import { cn } from "@/lib/utils";

/**
 * Who is here: someone whose structure passed (or mostly passed) Prontidão
 * and whose next question is concrete — "what do I actually spend, on what,
 * first?" The job this card does is close the penhasco docs/PRODUCT.md names:
 * it hands over a computed daily floor, an honestly-graded optimization
 * event, an ordered sequence of steps with preconditions, and a "do not
 * touch" list — never a campaign it creates for them (this product PRESCRIBES,
 * it never OPERATES the ad account).
 */

const CONFIDENCE_COLOR: Record<Confidence, "warning" | "primary" | "success"> = {
  baixa: "warning",
  media: "primary",
  alta: "success",
};

const EVENT_BASIS_COLOR: Record<OptimizationEventBasis, "success" | "warning" | "error"> = {
  proved: "success",
  declared: "warning",
  missing: "error",
};

const POSTURE_LABEL_KEY: Record<TargetingPosture, string> = {
  amplo: "posture-amplo",
  detalhado: "posture-detalhado",
};

export interface LaunchPlanMeta {
  createdAt: string;
  knowledgeRefs: { title: string; trust_level: number }[];
}

export default function LaunchPlanCard({
  plan,
  meta,
  registeredStepExperiments,
  onRegisterStep,
  registeringStepKey,
  onRegenerate,
  regenerating,
  regenerateCost = 0,
  creativesHref,
  readinessHref,
  productContextHref,
  experimentHref,
}: {
  plan: LaunchPlanOutput;
  meta: LaunchPlanMeta;
  /** step key → experiment id, for steps already registered in the journal. */
  registeredStepExperiments: Record<string, string>;
  onRegisterStep?: (key: string) => void;
  registeringStepKey?: string | null;
  onRegenerate?: () => void;
  regenerating?: boolean;
  regenerateCost?: number;
  creativesHref?: string;
  readinessHref?: string;
  productContextHref?: string;
  experimentHref?: (experimentId: string) => string;
}) {
  const t = useTranslations("launchPlan");
  // Landed from the work queue (#etapa-<key>): mark and scroll to that step.
  // Steps render expanded already, so unlike the creative plan there is nothing
  // to open — only to find.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  useEffect(() => {
    const match = /^#etapa-(.+)$/.exec(window.location.hash);
    if (!match) return;
    const key = decodeURIComponent(match[1]);
    if (!plan.steps.some((step) => step.key === key)) return;
    setFocusKey(key);
    const timer = window.setTimeout(
      () => document.getElementById(`etapa-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
      60,
    );
    return () => window.clearTimeout(timer);
  }, [plan]);

  const section = (icon: React.ReactNode, title: string, body: React.ReactNode, emphasize = false) =>
    emphasize ? (
      <Box className="bg-primary/5 flex flex-row items-start gap-2 rounded-2xl p-3">
        <span className="text-primary mt-0.5 flex-none">{icon}</span>
        <Box className="flex min-w-0 flex-col gap-2">
          <Typography variant="subtitle2" className="text-text-secondary mb-0 uppercase">
            {title}
          </Typography>
          {body}
        </Box>
      </Box>
    ) : (
      <Box className="flex flex-col gap-2">
        <Box className="flex flex-row items-center gap-1.5">
          <span className="text-text-secondary flex-none">{icon}</span>
          <Typography variant="subtitle2" className="text-text-secondary mb-0 uppercase">
            {title}
          </Typography>
        </Box>
        {body}
      </Box>
    );

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-5">
        <Box className="flex flex-row flex-wrap items-center gap-3">
          <span className="bg-primary/10 text-primary flex h-12 w-12 flex-none items-center justify-center rounded-2xl">
            <NiRocket size="medium" aria-hidden />
          </span>
          <Box className="grow">
            <Typography variant="h5" component="h3" className="card-title mb-0">
              {t("card-title")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("meta", { when: new Date(meta.createdAt).toLocaleDateString() })}
            </Typography>
          </Box>
          <Chip
            label={`${t("confidence")}: ${t(`confidence-${plan.confidence}`)}`}
            size="small"
            variant="outlined"
            color={CONFIDENCE_COLOR[plan.confidence]}
            className="flex-none"
          />
        </Box>

        {plan.insufficient_data && (
          <Alert severity="info" className="neutral bg-background-paper/60!">
            <Typography variant="subtitle2">{t("insufficient-title")}</Typography>
            <Typography variant="body2">{plan.missing_data || t("insufficient-body")}</Typography>
          </Alert>
        )}

        <Typography variant="body1" className="leading-6">
          {plan.diagnosis}
        </Typography>

        {/* "Não comece ainda" is a first-class, honest answer — not an error,
            and never dressed up as a fabricated plan just to have something
            to show. */}
        {!plan.viable && (
          <Alert severity="warning" className="neutral bg-background-paper/60!">
            <Typography variant="subtitle2">{t("not-viable-title")}</Typography>
            <Typography variant="body2" className="mb-2">
              {plan.what_would_change}
            </Typography>
            {productContextHref && (
              <Button component={Link} href={productContextHref} size="small" variant="outlined" color="grey">
                {t("edit-context-cta")}
              </Button>
            )}
          </Alert>
        )}

        {/* The event's evidentiary basis is the single most important honesty
            signal this screen carries — a "declared" or "missing" chip here
            is the plan's own risk #1, shown, never buried in prose. */}
        {section(
          <NiCrosshair size="small" />,
          t("event-title"),
          <Box className="flex flex-col gap-2">
            <Box className="flex flex-row flex-wrap items-center gap-2">
              <Typography variant="body1" className="font-medium">
                {plan.optimization_event.event}
              </Typography>
              <Chip
                label={t(`event-basis-${plan.optimization_event.basis}`)}
                size="small"
                variant="outlined"
                color={EVENT_BASIS_COLOR[plan.optimization_event.basis]}
              />
            </Box>
            <Typography variant="body2" className="text-text-secondary leading-6">
              {plan.optimization_event.rationale}
            </Typography>
            {plan.optimization_event.basis !== "proved" && readinessHref && (
              <Button
                component={Link}
                href={readinessHref}
                size="small"
                variant="text"
                color="primary"
                className="w-fit"
                startIcon={<NiArrowRight size="small" />}
              >
                {t("event-verify-cta")}
              </Button>
            )}
          </Box>,
        )}

        {section(
          <NiMoney size="small" />,
          t("budget-title"),
          <Box className="flex flex-col gap-2">
            <Box className="flex flex-row flex-wrap gap-4">
              <Box>
                <Typography variant="body2" className="text-text-secondary">
                  {t("budget-floor-label")}
                </Typography>
                <Typography variant="h6" component="p" className="mb-0">
                  {plan.budget.daily_floor_per_adset > 0 ? plan.budget.daily_floor_per_adset.toLocaleString() : "—"}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" className="text-text-secondary">
                  {t("budget-adsets-label")}
                </Typography>
                <Typography variant="h6" component="p" className="mb-0">
                  {plan.budget.adset_count}
                </Typography>
              </Box>
            </Box>
            {plan.budget.arithmetic.length > 0 && (
              <Box className="bg-grey-25/60 flex flex-col gap-0.5 rounded-2xl p-3">
                {plan.budget.arithmetic.map((line, index) => (
                  <Typography key={index} variant="body2" className="text-text-secondary leading-6">
                    {line}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>,
          true,
        )}

        {plan.viable && (
          <>
            {section(
              <NiLayout size="small" />,
              t("structure-title"),
              <Box className="flex flex-col gap-2">
                <Box className="flex flex-row flex-wrap gap-1">
                  <Chip
                    label={t("structure-campaigns", { count: plan.structure.campaigns })}
                    size="small"
                    variant="outlined"
                    color="grey"
                  />
                  <Chip
                    label={t("structure-adsets", { count: plan.structure.adsets })}
                    size="small"
                    variant="outlined"
                    color="grey"
                  />
                  <Chip
                    label={t(POSTURE_LABEL_KEY[plan.structure.targeting_posture])}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                  <Chip
                    label={t("structure-creatives-per-adset", { count: plan.structure.creatives_per_adset })}
                    size="small"
                    variant="outlined"
                    color="grey"
                  />
                </Box>
                {plan.structure.hypothesis_keys.length > 0 ? (
                  <Box className="flex flex-row flex-wrap gap-1">
                    {plan.structure.hypothesis_keys.map((key) => (
                      <Chip key={key} label={key} size="small" variant="outlined" color="grey" />
                    ))}
                  </Box>
                ) : (
                  creativesHref && (
                    <Button
                      component={Link}
                      href={creativesHref}
                      size="small"
                      variant="text"
                      color="primary"
                      className="w-fit"
                      startIcon={<NiArrowRight size="small" />}
                    >
                      {t("structure-no-hypotheses-cta")}
                    </Button>
                  )
                )}
              </Box>,
            )}

            {section(
              <NiListNumber size="small" />,
              t("steps-title"),
              <Box className="flex flex-col gap-3">
                {plan.steps.map((step, index) => {
                  const experimentId = registeredStepExperiments[step.key];
                  return (
                    <Box
                      key={step.key}
                      id={`etapa-${step.key}`}
                      className={cn(
                        "border-grey-100 flex flex-col gap-1.5 rounded-2xl border p-3",
                        focusKey === step.key && "ring-primary/40 ring-2",
                      )}
                    >
                      <Typography variant="subtitle2" className="mb-0">
                        {index + 1}. {step.title}
                      </Typography>
                      <Typography variant="body2" className="leading-6">
                        {step.action}
                      </Typography>
                      {step.precondition && (
                        <Typography variant="body2" className="text-text-secondary">
                          {t("step-precondition-label")}: {step.precondition}
                        </Typography>
                      )}
                      <Typography variant="body2" className="text-text-secondary">
                        {t("step-signal-label")}: {step.signal_to_advance}
                      </Typography>
                      {step.technical_basis.length > 0 && (
                        <Box className="flex flex-col gap-0.5">
                          {step.technical_basis.map((basis, basisIndex) => (
                            <Typography key={basisIndex} variant="body2" className="text-text-secondary leading-6">
                              {basis.rule} <span className="text-text-disabled">{basis.citation}</span>
                            </Typography>
                          ))}
                        </Box>
                      )}
                      <Box className="mt-1">
                        {experimentId ? (
                          experimentHref ? (
                            <Button
                              component={Link}
                              href={experimentHref(experimentId)}
                              size="small"
                              variant="outlined"
                              color="grey"
                              startIcon={<NiFlask size="small" />}
                            >
                              {t("step-open-experiment")}
                            </Button>
                          ) : null
                        ) : onRegisterStep ? (
                          <Button
                            size="small"
                            variant="outlined"
                            color="grey"
                            startIcon={<NiFlask size="small" />}
                            disabled={registeringStepKey != null}
                            onClick={() => onRegisterStep(step.key)}
                          >
                            {registeringStepKey === step.key ? t("step-registering") : t("step-register-experiment")}
                          </Button>
                        ) : null}
                      </Box>
                    </Box>
                  );
                })}
              </Box>,
            )}

            {section(
              <NiStopwatch size="small" />,
              t("judgement-title"),
              <Box className="flex flex-col gap-2">
                <Typography variant="body2">{t("judgement-window", { days: plan.judgement.window_days })}</Typography>
                {plan.judgement.do_not_touch.length > 0 && (
                  <Box className="bg-error/5 flex flex-col gap-1 rounded-2xl p-3">
                    <Box className="flex flex-row items-center gap-1.5">
                      <NiLock size="small" className="text-error" aria-hidden />
                      <Typography variant="subtitle2" className="text-error mb-0">
                        {t("judgement-do-not-touch-title")}
                      </Typography>
                    </Box>
                    <Box component="ul" className="m-0 flex list-disc flex-col gap-0.5 pl-5">
                      {plan.judgement.do_not_touch.map((item, index) => (
                        <Typography key={index} component="li" variant="body2" className="leading-6">
                          {item}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>,
            )}
          </>
        )}

        {section(
          <NiExclamationHexagon size="small" />,
          t("risk-title"),
          <Typography variant="body2" className="text-text-secondary leading-6">
            {plan.risk}
          </Typography>,
        )}

        {section(
          <NiCheck size="small" />,
          t("success-title"),
          <Typography variant="body2" className="leading-6">
            {plan.success_criterion}
          </Typography>,
        )}

        {section(
          <NiCalendar size="small" />,
          t("next-review-title"),
          <Typography variant="body2" className="text-text-secondary leading-6">
            {plan.next_review}
          </Typography>,
        )}

        {!plan.insufficient_data && plan.missing_data && (
          <Typography variant="body2" className="text-text-secondary">
            {t("missing-data")}: {plan.missing_data}
          </Typography>
        )}

        {meta.knowledgeRefs.length > 0 && (
          <Box className="flex flex-col gap-1">
            <Typography variant="body2" className="text-text-secondary">
              {t("grounded-in")}
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
                {t("regenerate-hint")}
              </Typography>
              <Button size="small" variant="outlined" color="grey" disabled={regenerating} onClick={onRegenerate}>
                {regenerating
                  ? t("generating")
                  : regenerateCost > 0
                    ? t("regenerate-cost", { cost: regenerateCost })
                    : t("regenerate")}
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
