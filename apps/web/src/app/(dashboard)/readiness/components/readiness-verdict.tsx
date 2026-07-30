"use client";

import type { DiagnosisRating } from "../../diagnosis/components/diagnosis-card";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  LinearProgress,
  Typography,
} from "@mui/material";

import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiBook from "@/icons/nexture/ni-book";
import NiCamera from "@/icons/nexture/ni-camera";
import NiCheck from "@/icons/nexture/ni-check";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";
import NiExclamationHexagon from "@/icons/nexture/ni-exclamation-hexagon";
import NiFlag from "@/icons/nexture/ni-flag";
import NiFlask from "@/icons/nexture/ni-flask";
import NiInfoSquare from "@/icons/nexture/ni-info-square";
import NiLock from "@/icons/nexture/ni-lock";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiSearch from "@/icons/nexture/ni-search";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiShieldCross from "@/icons/nexture/ni-shield-cross";
import NiTag from "@/icons/nexture/ni-tag";
import type { Confidence, EvidenceSource } from "@/lib/diagnosis/schema";
import {
  EMPTY_READINESS_PROFILE,
  type FindingResolution,
  findingResolution,
  isFindingPending,
  type ReadinessEvaluation,
  type ReadinessItemKey,
  type ReadinessProfile,
  resolvableItems,
} from "@/lib/readiness/checklist";
import type { HowToOutput } from "@/lib/readiness/howto";
import type {
  ReadinessFinding,
  ReadinessLevel,
  ReadinessOutput,
  ReadinessVerdict as Verdict,
} from "@/lib/readiness/schema";
import { cn } from "@/lib/utils";

const VERDICT_ICON: Record<Verdict, React.ReactNode> = {
  pronto: <NiShieldCheck size="large" />,
  quase: <NiFlag size="large" />,
  nao_pronto: <NiShieldCross size="large" />,
};

/** The verdict drives the whole card's tone — it is the answer they came for. */
const VERDICT_TONE: Record<Verdict, string> = {
  pronto: "bg-success-light/10 text-success",
  quase: "bg-warning-light/10 text-warning",
  nao_pronto: "bg-error-light/10 text-error",
};

/**
 * The flat fill under the answer card. A paper→transparent gradient is laid
 * OVER it (see the render), which is what makes the tint whisper-light on the
 * reading edge and strongest on the action edge — the template's hero card
 * language (applications/ai-content/learn). Literal strings: Tailwind's JIT
 * cannot see classes assembled at runtime.
 */
const VERDICT_WASH: Record<Verdict, string> = {
  pronto: "bg-success-light/10",
  quase: "bg-warning-light/10",
  nao_pronto: "bg-error-light/10",
};

/** Colour carries the trust level: only machine-proved earns green. */
const RESOLUTION_COLOR: Record<FindingResolution, "success" | "warning" | "error" | "grey"> = {
  open: "grey",
  declared: "grey",
  // Same trust as `declared` (settled, not pending) — the distinct value
  // exists so the card can say WHY our reader cannot vouch for it.
  "declared-unverifiable": "grey",
  "awaiting-proof": "warning",
  verified: "success",
  contradicted: "error",
};

const CONFIDENCE_COLOR: Record<Confidence, "warning" | "primary" | "success"> = {
  baixa: "warning",
  media: "primary",
  alta: "success",
};

const SOURCE_COLOR: Record<EvidenceSource, "success" | "primary" | "info" | "default"> = {
  meta_docs: "success",
  campaign_data: "primary",
  growth_playbook: "info",
  product_context: "default",
};

export interface ReadinessMeta {
  createdAt: string;
  knowledgeRefs: { title: string; trust_level: number }[];
}

/** A how-to that has been requested: loading, or loaded with its sources. */
export type HowToState = "loading" | { howTo: HowToOutput; sources: { title: string; trust_level: number }[] };

/**
 * The verdict, presented as a PLAN — a short list of fix CARDS.
 *
 * Two earlier tries failed the same way: a wall of equally-loud detail, then a
 * plan whose interactivity was invisible (bare accordion rows, an unlabelled
 * checkbox). Users did not notice they could expand a finding or what the
 * checkbox was for.
 *
 * So every affordance is now explicit: each finding is a bordered card, the
 * "done" control is a LABELLED checkbox ("Marcar como resolvido"), and the
 * detail sits behind a LABELLED button ("Ver detalhes e como fazer"), not a
 * naked chevron. Everything that is not the verdict or the plan (checklist
 * editing, the scan, re-verify) lives on the page around this component, so the
 * card stays scannable.
 */
export default function ReadinessVerdict({
  output,
  productName,
  meta,
  feedback,
  onFeedback,
  feedbackBusy,
  onRegisterFinding,
  registeringIndex,
  profile,
  evaluation,
  onVerifyNow,
  verifying = false,
  onResolve,
  howToByIndex,
  onHowTo,
  howToCost = 0,
  registeredByIndex = {},
  experimentHref,
  creativePlanHref,
  productContextHref,
  focusRequest = null,
  onOpenItemHelp,
}: {
  output: ReadinessOutput;
  productName: string;
  meta: ReadinessMeta;
  feedback?: DiagnosisRating | null;
  onFeedback?: (rating: DiagnosisRating) => void;
  feedbackBusy?: boolean;
  /** Turn one finding into a tracked experiment (closes the learning loop). */
  onRegisterFinding?: (findingIndex: number) => void;
  registeringIndex?: number | null;
  /** Current declared checklist — decides which findings read as resolved. */
  profile?: ReadinessProfile;
  /**
   * The evidence half. Without it a tick is only ever a declaration, so the
   * plan can never claim something was verified it did not actually prove.
   */
  evaluation?: ReadinessEvaluation;
  /** Re-read the page so an "awaiting proof" finding can settle in seconds. */
  onVerifyNow?: () => void;
  verifying?: boolean;
  /** Tick/untick the checklist items a finding is about. */
  onResolve?: (items: ReadinessItemKey[], resolved: boolean) => void;
  howToByIndex?: Record<number, HowToState | undefined>;
  onHowTo?: (findingIndex: number) => void;
  howToCost?: number;
  registeredByIndex?: Record<number, string>;
  experimentHref?: (experimentId: string) => string;
  /**
   * Where the Creative Test Plan lives (the creatives surface). A `midia`
   * finding has no checklist items to tick — without this link it is a dead
   * end; with it, the fix has a concrete door (docs/PRODUCT.md phase 8).
   */
  creativePlanHref?: string;
  /**
   * Same idea for `oferta`: audited from the product context BY DESIGN (no
   * checklist group — see DIMENSION_GROUP), so its door is the context
   * editor, ideally focused on the offer/economics section (?focus=).
   */
  productContextHref?: string;
  /**
   * External finding-focus request (the #finding-N deep link from an
   * experiment backlink): expand + scroll that card. Nonce so the same index
   * can be requested again.
   */
  focusRequest?: { index: number; nonce: number } | null;
  /**
   * Open the review modal AT one checklist item's teaching panel (U7) — the
   * only surface where the concierge legitimately appears, and only when
   * earned. The DESTINATION decides whether to sell; this is never a direct
   * sell from the plan.
   */
  onOpenItemHelp?: (key: ReadinessItemKey) => void;
}) {
  const t = useTranslations("readiness");
  // App-locale date formatting, browser TIMEZONE kept (the next-intl global
  // pins timeZone: "UTC", which would shift wall-clock 3h for pt-BR users) —
  // same pattern as organic-growth's import-history.
  const locale = useLocale();
  const dateOnly = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);
  const dateTime = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );
  /**
   * ONE open at a time. With several findings expanded the plan went back to
   * being a wall — and a fix list is read one item at a time anyway, so opening
   * the next naturally closes the last.
   */
  const [expanded, setExpanded] = useState<number | null>(null);
  const toggle = (index: number) => setExpanded((prev) => (prev === index ? null : index));

  // Group by what the reader should DO, not by the order the model emitted.
  // The engine already sorts by leverage; this adds the reading criteria.
  const groups = useMemo(() => {
    const all = output.findings.map((finding, index) => ({ finding, index }));
    const open = all.filter((x) => x.finding.status !== "ok");
    return {
      blockers: open.filter((x) => x.finding.status === "critico"),
      quick: open.filter(
        (x) => x.finding.status !== "critico" && x.finding.impact === "alto" && x.finding.effort !== "alto",
      ),
      later: open.filter(
        (x) => x.finding.status !== "critico" && !(x.finding.impact === "alto" && x.finding.effort !== "alto"),
      ),
      ok: all.filter((x) => x.finding.status === "ok"),
    };
  }, [output.findings]);

  /**
   * How much we can vouch for each finding. Pure domain (`findingResolution`),
   * so the plan, the pending map and the checklist all tell the same story.
   * Without an `evaluation` there is no evidence at all, so a tick can only
   * ever be a declaration — never "verified".
   */
  const resolutionOf = (items: ReadinessItemKey[]) =>
    findingResolution(items, profile ?? EMPTY_READINESS_PROFILE, {
      verified: evaluation?.verified ?? [],
      contradicted: evaluation?.contradicted ?? [],
      // `onVerifyNow` exists only when there is a page we can read. No page,
      // no possible proof — so never park the user in "unconfirmed" forever.
      canVerify: Boolean(onVerifyNow),
      // Items the latest scan can structurally never prove (SPA/GTM): with
      // these, "awaiting proof" would be the same life sentence.
      unprovable: evaluation?.unprovable ?? [],
    });

  /**
   * The pending map. A finding drops out ONLY when we can actually stand
   * behind it (proved, or unprovable-by-nature and declared) — the earlier
   * version listed every non-ok finding regardless, so an item wearing a green
   * "corrigido" badge still showed as pending and the two flatly contradicted
   * each other on screen.
   */
  const pending = useMemo(() => {
    const urgency = [
      ...groups.blockers.map((entry) => ({ ...entry, color: "error" as const })),
      ...groups.quick.map((entry) => ({ ...entry, color: "primary" as const })),
      ...groups.later.map((entry) => ({ ...entry, color: "grey" as const })),
    ];
    return (
      urgency
        .map((entry) => ({
          ...entry,
          resolution: resolutionOf(resolvableItems(entry.finding.dimension, entry.finding.related_items)),
        }))
        .filter((entry) => isFindingPending(entry.resolution))
        // Verification state outranks urgency in the chip's colour: "you ticked
        // this but we could not confirm it" is the more useful warning.
        .map((entry) => ({
          ...entry,
          color: entry.resolution === "open" ? entry.color : RESOLUTION_COLOR[entry.resolution],
        }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, profile, evaluation]);

  /**
   * The plan in reading order (blockers → quick wins → later), which is what
   * the numbered badges count. Also gives the honest "X de N concluídos":
   * N is what the plan actually lists, and X only counts findings we can
   * stand behind — never a box someone merely ticked.
   */
  const planOrder = useMemo(
    () => [...groups.blockers, ...groups.quick, ...groups.later].map((entry) => entry.index),
    [groups],
  );
  const planDone = planOrder.length - pending.length;

  /** Open one finding and bring it on screen — the "hook" every pending-item
   *  chip (and the blocker CTA) resolves to. */
  const focusFinding = (index: number) => {
    setExpanded(index);
    window.setTimeout(() => {
      document.getElementById(`finding-${index}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 60);
  };

  // The deep-link entry point resolves to the same hook every pending chip
  // uses — after the async mount, which is why the native hash scroll could
  // never work here.
  useEffect(() => {
    if (focusRequest) focusFinding(focusRequest.index);
    // Nonce is the trigger; focusFinding is stable in behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.nonce]);

  const focusPrimaryBlocker = () => {
    if (groups.blockers[0]) focusFinding(groups.blockers[0].index);
  };

  const levelChip = (label: string, value: ReadinessLevel) => (
    <Chip
      label={`${label}: ${t(`level-${value}`)}`}
      size="small"
      variant="outlined"
      color={value === "alto" ? "primary" : "grey"}
      className="flex-none"
    />
  );

  /**
   * Every section now carries an icon in its label — the earlier version had
   * four sections in a row with IDENTICAL typography (uppercase gray label +
   * body text), so nothing anchored the eye and the card read as one dense
   * paragraph. `emphasize` boxes the one section that is not descriptive but
   * ACTIONABLE (what to actually do), matching the tinted-box language
   * already used for the checklist's own teaching tips.
   */
  const section = (icon: React.ReactNode, title: string, body: React.ReactNode, emphasize = false) =>
    emphasize ? (
      <Box className="bg-primary/5 flex flex-row items-start gap-2 rounded-2xl p-3">
        <span className="text-primary mt-0.5 flex-none">{icon}</span>
        <Box className="flex flex-col gap-0.5">
          <Typography variant="subtitle2" className="text-text-secondary mb-0 uppercase">
            {title}
          </Typography>
          {body}
        </Box>
      </Box>
    ) : (
      <Box className="flex flex-col gap-0.5 rounded-2xl bg-yellow-50 p-3">
        <Box className="flex flex-row items-center gap-1.5">
          <span className="text-text-secondary flex-none">{icon}</span>
          <Typography variant="subtitle2" className="text-text-secondary mb-0 font-extrabold uppercase">
            {title}
          </Typography>
        </Box>
        {body}
      </Box>
    );

  const findingCard = ({ finding, index }: { finding: ReadinessFinding; index: number }) => {
    const items = resolvableItems(finding.dimension, finding.related_items);
    // NOT "did they tick it" but "how much can we vouch for it" — a tick alone
    // used to paint this card green, which read as system confirmation when it
    // only ever meant "I said so".
    const resolution = resolutionOf(items);
    const resolved = resolution === "verified" || resolution === "declared";
    const howTo = howToByIndex?.[index];
    const open = expanded === index;
    // Position in the plan as the reader sees it, not the model's array index.
    const position = planOrder.indexOf(index) + 1;
    const needsSpecialist =
      finding.effort === "alto" || (typeof howTo === "object" && howTo.howTo.needs_specialist === true);

    return (
      // The template's card-accordion (FAQ pattern): each finding is one
      // elevated card whose collapsed face carries dimension + verdict chips +
      // the ACTION preview — the plan scans as a to-do list instead of four
      // walls of analysis bleeding into each other.
      <Box key={index} className="mb-2.5 rounded-xl shadow-sm">
        <Accordion id={`finding-${index}`} expanded={open} onChange={() => toggle(index)}>
          {/* Explicit accessible name (P4): without it the button's name is
              the concatenation of the whole collapsed card — unusable in a
              rotor list. The state (resolution when settled, status when
              open) restates the one chip a sighted reader sees. */}
          <AccordionSummary
            className="group"
            aria-label={t("finding-summary-aria", {
              position,
              dimension: t(`dimension-${finding.dimension}`),
              state: resolution !== "open" ? t(`resolution-${resolution}`) : t(`status-${finding.status}`),
            })}
          >
            <Card className="w-full shadow-none! group-aria-expanded:rounded-b-none">
              <CardContent className="flex flex-col gap-1.5">
                <Box className="flex flex-row flex-wrap items-center gap-2">
                  {/* Position badge: the plan is an ordered queue, so say which
                      one this is — and mark the done ones without needing the
                      reader to open anything. */}
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-7 w-7 flex-none items-center justify-center rounded-full border text-sm font-medium",
                      resolved
                        ? "border-success/40 bg-success/10 text-success"
                        : open
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-grey-100 text-text-secondary",
                    )}
                  >
                    {resolved ? <NiCheck size="small" /> : position}
                  </span>
                  <Typography variant="h6" component="h4" className="mb-0 grow">
                    {t(`dimension-${finding.dimension}`)}
                  </Typography>
                  <Box className="flex flex-none flex-row flex-wrap items-center gap-1">
                    {/* One chip, one truth: proved / your word / not checked yet
                        / the page disagrees. Never a green tick for a claim. */}
                    {resolution !== "open" ? (
                      <Chip
                        icon={resolution === "verified" ? <NiCheck size="small" /> : undefined}
                        label={t(`resolution-${resolution}`)}
                        size="small"
                        variant="outlined"
                        color={RESOLUTION_COLOR[resolution]}
                        className="flex-none"
                      />
                    ) : (
                      <>
                        {finding.status === "sem_dados" && (
                          <Chip
                            label={t("status-sem_dados")}
                            size="small"
                            variant="outlined"
                            color="grey"
                            className="flex-none"
                          />
                        )}
                        {levelChip(t("impact"), finding.impact)}
                        {levelChip(t("effort"), finding.effort)}
                      </>
                    )}
                    <NiChevronRightSmall size={20} className="accordion-rotate" />
                  </Box>
                </Box>
                {/* Collapsed, the card leads with its payoff — what to DO.
                    Open, the full tinted AÇÃO section below takes over. */}
                {!open && (
                  <Typography
                    variant="body2"
                    className={cn("text-text-secondary line-clamp-2 leading-6", resolved && "line-through")}
                  >
                    {finding.recommended_action}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </AccordionSummary>
          <AccordionDetails className="bg-background-paper rounded-b-xl px-7 py-6 pt-0">
            <Box className="flex flex-col gap-3">
              {/* Three columns on wide screens: what blocks / what to do /
                  how you'll know it's done. Stacked below md. The middle one
                  is tinted because it is the only ACTIONABLE column — the
                  other two are context and proof. */}
              <Box className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                <Box className="flex flex-col gap-3">
                  {section(
                    <NiFlag size="small" />,
                    t("section-problem"),
                    <Typography variant="body2" className="leading-6">
                      {finding.finding}
                    </Typography>,
                  )}

                  {finding.evidence.length > 0 &&
                    section(
                      <NiSearch size="small" />,
                      t("section-evidence"),
                      <Box className="flex flex-col gap-1.5">
                        {finding.evidence.map((evidence, evidenceIndex) => (
                          <Box key={evidenceIndex} className="flex flex-row items-start gap-2">
                            <Chip
                              label={t(`source-${evidence.source}`)}
                              size="small"
                              variant="outlined"
                              color={SOURCE_COLOR[evidence.source] ?? "default"}
                              className="mt-0.5 flex-none"
                            />
                            <Typography variant="body2" className="leading-6">
                              {evidence.statement}
                            </Typography>
                          </Box>
                        ))}
                      </Box>,
                    )}
                </Box>

                {/* The one line the whole card exists to deliver — boxed and tinted
            so it visually wins against the descriptive sections around it. */}
                {section(
                  <NiArrowRight size="small" />,
                  t("section-action"),
                  <Box className="flex flex-col gap-2">
                    <Typography
                      variant="body1"
                      className={cn("leading-6 font-medium", resolved && "text-text-secondary line-through")}
                    >
                      {finding.recommended_action}
                    </Typography>
                    {/* Once the step-by-step has been paid for, it belongs HERE —
                      numbered, in the action column — not in a separate block
                      further down that repeats the same job. */}
                    {typeof howTo === "object" && howTo.howTo.steps.length > 0 && (
                      <Box component="ol" className="m-0 flex list-decimal flex-col gap-1 pl-5">
                        {howTo.howTo.steps.map((step, stepIndex) => (
                          <Typography key={stepIndex} component="li" variant="body2" className="leading-6">
                            {step}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>,
                  true,
                )}

                {/* Completion criteria — the checklist items this finding is
                  actually about, each its own box. One "marcar como resolvido"
                  used to tick them all at once, which is a lie whenever a
                  finding spans several (you fixed the Pixel, not the CAPI).
                  `success_criterion` stays as the sentence that says what
                  "done" looks like. */}
                {section(
                  <NiCheck size="small" />,
                  t("section-success"),
                  <Box className="flex flex-col gap-1">
                    {items.length > 0 && onResolve && profile
                      ? items.map((key) => (
                          <FormControlLabel
                            key={key}
                            className="m-0"
                            control={
                              <Checkbox
                                size="small"
                                checked={profile[key] === true}
                                onChange={(event) => onResolve([key], event.target.checked)}
                              />
                            }
                            label={
                              <Typography variant="body2" className={profile[key] ? "text-text-secondary" : undefined}>
                                {t(`item-${key}`)}
                              </Typography>
                            }
                          />
                        ))
                      : null}
                    <Typography variant="body2" className="text-text-secondary leading-6">
                      {finding.success_criterion}
                    </Typography>
                  </Box>,
                )}
              </Box>

              {/* `midia` has no checklist items to tick — its concrete door is
                  the Creative Test Plan on the creatives surface. */}
              {finding.dimension === "midia" && creativePlanHref && (
                <Box className="flex flex-col items-start gap-1">
                  <Button
                    component={Link}
                    href={creativePlanHref}
                    size="small"
                    variant="contained"
                    startIcon={<NiCamera size="small" />}
                  >
                    {t("creative-plan-cta")}
                  </Button>
                  <Typography variant="body2" className="text-text-secondary">
                    {t("creative-plan-hint")}
                  </Typography>
                </Box>
              )}

              {/* `oferta` is context-driven by design: the fix happens on the
                  product context screen, and the next verdict re-reads it. */}
              {finding.dimension === "oferta" && productContextHref && (
                <Box className="flex flex-col items-start gap-1">
                  <Button
                    component={Link}
                    href={productContextHref}
                    size="small"
                    variant="contained"
                    startIcon={<NiTag size="small" />}
                  >
                    {t("offer-context-cta")}
                  </Button>
                  <Typography variant="body2" className="text-text-secondary">
                    {t("offer-context-hint")}
                  </Typography>
                </Box>
              )}

              {/* The honest middle state, spelled out: they said it is done and
                  we CAN check — so say we haven't yet, and hand them the
                  one-click way to settle it instead of a vague warning. */}
              {resolution === "awaiting-proof" && (
                <Alert severity="warning" className="neutral bg-background-paper/60!">
                  <Typography variant="body2">{t("resolution-awaiting-proof-body")}</Typography>
                  {onVerifyNow && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="grey"
                      className="mt-2"
                      startIcon={<NiShieldCheck size="small" />}
                      disabled={verifying}
                      onClick={onVerifyNow}
                    >
                      {verifying ? t("verifying-now") : t("verify-now")}
                    </Button>
                  )}
                </Alert>
              )}

              {/* The user's word is all there is here — never pretend otherwise. */}
              {resolution === "declared" && (
                <Typography variant="body2" className="text-text-secondary">
                  {t("resolution-declared-body")}
                </Typography>
              )}

              {/* Settled by trust, with the WHY: our page read structurally
                  cannot see these tags (client-side rendering / GTM), so the
                  user's word is the best data obtainable. Plain text, not a
                  warning — it is settled, not pending. */}
              {resolution === "declared-unverifiable" && (
                <Typography variant="body2" className="text-text-secondary">
                  {t("resolution-declared-unverifiable-body")}
                </Typography>
              )}

              {/* Ticked, but the page says no. Loudest state on the card. */}
              {resolution === "contradicted" && (
                <Alert severity="error" className="neutral bg-background-paper/60!">
                  <Typography variant="body2">{t("resolution-contradicted-body")}</Typography>
                </Alert>
              )}

              <Box className="border-grey-50 flex flex-col gap-3 border-t pt-3">
                {/* HOW to do it — the gap between knowing and doing, on demand. */}
                <Box className="bg-grey-25/60 flex flex-col gap-2 rounded-2xl p-4">
                  <Typography variant="subtitle2" className="text-text-secondary uppercase">
                    {t("howto-title")}
                  </Typography>

                  {howTo === undefined && onHowTo && (
                    <Box className="flex flex-col items-start gap-1">
                      <Typography variant="body2" className="text-text-secondary">
                        {t("howto-teaser")}
                      </Typography>
                      <Button size="small" variant="outlined" color="grey" onClick={() => onHowTo(index)}>
                        {howToCost > 0 ? t("howto-cta-cost", { cost: howToCost }) : t("howto-cta")}
                      </Button>
                    </Box>
                  )}

                  {howTo === "loading" && (
                    <Box className="flex flex-row items-center gap-2">
                      <CircularProgress size={16} />
                      <Typography variant="body2" className="text-text-secondary">
                        {t("howto-loading")}
                      </Typography>
                    </Box>
                  )}

                  {typeof howTo === "object" && (
                    <>
                      {/* The steps themselves now render inside the ACTION
                          column — repeating them here was the same content
                          twice on one card. What stays is what belongs to the
                          generation: the honest empty answer, the caveat and
                          the sources it was grounded in. */}
                      {howTo.howTo.steps.length === 0 && (
                        // An honest empty answer: the knowledge base did not cover
                        // it, so no tutorial was invented (and nothing was charged).
                        <Alert severity="info" className="neutral bg-background-paper/60!">
                          <Typography variant="body2">{howTo.howTo.note || t("howto-unsupported")}</Typography>
                        </Alert>
                      )}
                      {howTo.howTo.steps.length > 0 && howTo.howTo.note && (
                        <Typography variant="body2" className="text-text-secondary">
                          {howTo.howTo.note}
                        </Typography>
                      )}
                      {howTo.sources.length > 0 && (
                        <Box className="flex flex-row flex-wrap gap-1">
                          {howTo.sources.slice(0, 4).map((source, sourceIndex) => (
                            <Chip key={sourceIndex} label={source.title} size="small" variant="outlined" color="grey" />
                          ))}
                        </Box>
                      )}
                    </>
                  )}

                  {needsSpecialist && (
                    <Box className="flex flex-row flex-wrap items-center gap-2">
                      <Typography variant="body2" className="text-text-secondary">
                        {t("howto-specialist")}
                      </Typography>
                      {/* The door to the item's TEACHING panel — where the
                          earned concierge appears only if assistReason says
                          so. oferta/midia map to no items: plain text, no
                          fake door. */}
                      {items.length > 0 && onOpenItemHelp && (
                        <Button size="small" variant="text" color="primary" onClick={() => onOpenItemHelp(items[0])}>
                          {t("howto-specialist-cta")}
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>

                {finding.technical_basis.length > 0 &&
                  section(
                    <NiBook size="small" />,
                    t("section-technical-basis"),
                    <Box className="flex flex-col gap-0.5">
                      {finding.technical_basis.map((basis, basisIndex) => (
                        <Typography key={basisIndex} variant="body2" className="leading-6">
                          {basis.rule} <span className="text-text-secondary">{basis.citation}</span>
                        </Typography>
                      ))}
                    </Box>,
                  )}

                {registeredByIndex[index] && experimentHref ? (
                  <Alert severity="success" className="neutral bg-background-paper/60!">
                    <Typography variant="body2">
                      {t("experiment-planned")}{" "}
                      <Link href={experimentHref(registeredByIndex[index])}>{t("open-experiment")}</Link>
                    </Typography>
                  </Alert>
                ) : onRegisterFinding ? (
                  <Box className="flex flex-col items-start gap-1">
                    <Button
                      size="small"
                      variant="outlined"
                      color="grey"
                      startIcon={<NiFlask size="small" />}
                      disabled={registeringIndex != null}
                      onClick={() => onRegisterFinding(index)}
                    >
                      {registeringIndex === index ? t("registering-experiment") : t("register-experiment")}
                    </Button>
                    <Typography variant="body2" className="text-text-secondary">
                      {t("register-experiment-hint")}
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>
    );
  };

  const group = (title: string, hint: string, entries: { finding: ReadinessFinding; index: number }[]) =>
    entries.length === 0 ? null : (
      <Box className="flex flex-col gap-2">
        <Box className="flex flex-col gap-0.5">
          <Typography variant="subtitle1" component="h3" className="mb-0">
            {title} <span className="text-text-secondary">({entries.length})</span>
          </Typography>
          <Typography variant="body2" className="text-text-secondary">
            {hint}
          </Typography>
        </Box>
        {/* Each card-accordion wrapper carries its own mb — no extra gap here. */}
        <Box className="flex flex-col">{entries.map(findingCard)}</Box>
      </Box>
    );

  /**
   * The panel's inset boxes (what blocks spend / why the base is thin). The
   * template's outlined-paper border with NO fill — a filled box would fight
   * the card's own wash, and an `Alert severity="error"` read as "the app
   * broke" when the message is "your structure is not ready".
   */
  const insetBox = (icon: React.ReactNode, title: string, body: React.ReactNode, action?: React.ReactNode) => (
    <Box className="MuiPaper-outlined MuiPaper-rounded flex w-full flex-col justify-between gap-4 rounded-lg p-5 sm:flex-row sm:items-center sm:p-7">
      <Box className="flex flex-row items-start gap-4">
        <span className="mt-0.5 flex-none">{icon}</span>
        <Box className="min-w-0">
          <Typography variant="subtitle2" component="h3" className="mb-0.5">
            {title}
          </Typography>
          {body}
        </Box>
      </Box>
      {action}
    </Box>
  );

  return (
    <Box className="flex flex-col gap-4">
      {/* THE ANSWER — its own card, in the template's hero shape (see
          applications/ai-content/learn LearnHero): thick paper outline, a flat
          verdict-toned fill, and a paper→transparent horizontal gradient over
          it so the tint stays whisper-light on the left and strengthens to the
          right. Splitting it from the plan is the point: what the credits
          bought is one object, the work to do is another. */}
      <Card
        component="section"
        className="outline-background-paper relative flex min-h-80 flex-col p-0 outline-4 -outline-offset-4"
      >
        <Box aria-hidden className={cn("absolute inset-1 z-0 rounded-xl", VERDICT_WASH[output.verdict])} />
        <Box
          aria-hidden
          className="from-background-paper to-background-paper/0 absolute inset-1 z-1 rounded-xl bg-linear-to-r rtl:bg-linear-to-l"
        />

        <CardContent className="z-10 flex flex-1 flex-col items-start justify-between p-5! sm:p-7!">
          <Box className="mb-4 flex w-full flex-row flex-wrap items-center justify-between gap-3">
            <Box className="flex min-w-0 flex-row items-center gap-4">
              <Box
                className={cn(
                  "flex h-16 w-16 flex-none items-center justify-center rounded-2xl",
                  VERDICT_TONE[output.verdict],
                )}
              >
                {VERDICT_ICON[output.verdict]}
              </Box>
              {/* The verdict word IS what the credits bought — it stands alone
                  on the headline line, at the icon's optical center. */}
              <Typography variant="h4" component="h2" className="card-title mb-0 min-w-0">
                {t(`verdict-${output.verdict}`)}
              </Typography>
            </Box>
            {/* Provenance and certainty are the answer's METADATA — which
                product, read when, how sure — so they travel together on the
                trailing edge instead of hanging under the headline where they
                competed with it. Shrinkable and wrapping: pinned `flex-none`,
                a long product name pushed the badge past the card's right edge
                at 390 (clipped, not scrollable). */}
            <Box className="flex min-w-0 flex-row flex-wrap items-center gap-x-4 gap-y-1">
              <Typography variant="body2" className="text-text-secondary">
                {t("verdict-meta", {
                  product: productName,
                  when: dateOnly.format(new Date(meta.createdAt)),
                })}
              </Typography>
              {/* The template's badge: a pastel tiny Button. Rendered as a
                  `span` and out of the tab order because it is a LABEL — a
                  real <button> here puts an inert stop in the keyboard walk
                  and is announced as an action that does nothing. */}
              <Button
                component="span"
                role="note"
                tabIndex={-1}
                variant="pastel"
                size="tiny"
                color={CONFIDENCE_COLOR[output.confidence]}
                disableElevation
                disableRipple
                className="pointer-events-none flex-none self-center"
                startIcon={<NiPulse size="tiny" aria-hidden />}
              >
                {`${t("confidence")}: ${t(`confidence-${output.confidence}`)}`}
              </Button>
            </Box>
          </Box>

          <Box className="flex h-full w-full flex-col items-start justify-between gap-5">
            <Typography variant="body1" component="p" className="text-text-secondary w-full text-start">
              {output.summary}
            </Typography>

            {output.blocking.length > 0 &&
              insetBox(
                <NiExclamationHexagon size="medium" className="text-error" aria-hidden />,
                t("blocking-title"),
                // Every blocker, not just the first: the panel claims to name
                // what stops the spend, and silently dropping the rest of the
                // list makes a resolved #1 look like the finish line.
                <Box className="flex flex-col gap-0.5">
                  {output.blocking.map((item, blockingIndex) => (
                    <Typography key={blockingIndex} variant="body2" className="text-text-secondary">
                      {output.blocking.length > 1 ? `${blockingIndex + 1}. ${item}` : item}
                    </Typography>
                  ))}
                </Box>,
                groups.blockers.length > 0 ? (
                  <Button
                    variant="contained"
                    color="primary"
                    size="medium"
                    disableElevation
                    className="flex-none"
                    startIcon={<NiLock size="medium" aria-hidden />}
                    onClick={focusPrimaryBlocker}
                  >
                    {t("fix-blocker")}
                  </Button>
                ) : undefined,
              )}

            {/* Same language — a caveat about the answer belongs INSIDE the
                answer, not floating between it and the plan. */}
            {output.insufficient_data &&
              insetBox(
                <NiInfoSquare size="medium" className="text-info" aria-hidden />,
                t("insufficient-title"),
                <Typography variant="body2" className="text-text-secondary">
                  {output.missing_data || t("insufficient-body")}
                </Typography>,
              )}
          </Box>
        </CardContent>
      </Card>

      {/* THE WORK — a second card, so the plan never competes with the answer
          above it for the same surface. */}
      <Card component="section">
        <CardContent className="flex flex-col gap-5">
          <Box className="flex flex-row flex-wrap items-end justify-between gap-3">
            <Box className="flex flex-col gap-0.5">
              <Typography variant="h5" component="h2" className="card-title mb-0">
                {t("plan-title")}
              </Typography>
              <Typography variant="body2" className="text-text-secondary">
                {t("plan-body")}
              </Typography>
            </Box>
            {/* Completion drive over the plan itself. It counts only findings
                we can vouch for (see `pending`), so it can never be inflated by
                ticking — same rule the readiness rings follow. */}
            {planOrder.length > 0 && (
              <Box className="flex min-w-48 flex-col gap-1">
                <Typography variant="body2" className="text-text-secondary text-right">
                  {t("plan-progress", { done: planDone, total: planOrder.length })}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.round((planDone / planOrder.length) * 100)}
                  color={planDone === planOrder.length ? "success" : "primary"}
                  className="rounded-full"
                />
              </Box>
            )}
          </Box>

          {/* The pending map: one hook per open finding, colored by urgency
              (blocker / quick win / later). Same language as the completeness
              card on the context screen — click → the exact card opens and
              scrolls into view. */}
          {pending.length > 0 && (
            <Box className="flex flex-col gap-1.5">
              <Typography variant="body2" className="text-text-secondary">
                {t("plan-jump-hint")}
              </Typography>
              <Box className="flex flex-row flex-wrap gap-1.5">
                {pending.map(({ finding, index, color }) => (
                  <Chip
                    key={index}
                    label={t(`dimension-${finding.dimension}`)}
                    size="small"
                    variant="outlined"
                    color={color}
                    className="cursor-pointer"
                    // Plan position + action, not just a dimension name — two
                    // findings can share a dimension (P4).
                    aria-label={t("pending-chip-aria", {
                      position: planOrder.indexOf(index) + 1,
                      dimension: t(`dimension-${finding.dimension}`),
                    })}
                    onClick={() => focusFinding(index)}
                  />
                ))}
              </Box>
            </Box>
          )}

          {group(t("plan-blockers"), t("plan-blockers-hint"), groups.blockers)}
          {group(t("plan-quick"), t("plan-quick-hint"), groups.quick)}
          {group(t("plan-later"), t("plan-later-hint"), groups.later)}

          {/* What is already fine is worth one line of credit, not a section. */}
          {groups.ok.length > 0 && (
            <Box className="text-success flex flex-row items-center gap-1.5">
              <NiCheck size="small" />
              <Typography variant="body2" className="text-success">
                {t("plan-ok", {
                  count: groups.ok.length,
                  dimensions: groups.ok.map((x) => t(`dimension-${x.finding.dimension}`)).join(", "),
                })}
              </Typography>
            </Box>
          )}

          {meta.knowledgeRefs.length > 0 && (
            <>
              <Divider />
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
            </>
          )}

          <Box className="flex flex-row flex-wrap items-center justify-between gap-2">
            <Box className="flex flex-col">
              <Typography variant="body2" className="text-text-secondary">
                {t("generated-at", { when: dateTime.format(new Date(meta.createdAt)) })}
              </Typography>
              {/* When to come back (R1). Absent on verdicts stored before the
                field existed — they render exactly as they always did. */}
              {output.next_review && (
                <Typography variant="body2" className="text-text-secondary">
                  {t("next-review-label", { when: output.next_review })}
                </Typography>
              )}
            </Box>
            {onFeedback && (
              <Box className="flex flex-row flex-wrap items-center gap-1">
                <Typography variant="body2" className="text-text-secondary mr-1">
                  {t("feedback-question")}
                </Typography>
                {(["useful", "not_useful", "incorrect"] as DiagnosisRating[]).map((value) => (
                  <Button
                    key={value}
                    size="small"
                    color={feedback === value ? "primary" : "grey"}
                    variant={feedback === value ? "outlined" : "text"}
                    disabled={feedbackBusy}
                    onClick={() => onFeedback(value)}
                  >
                    {t(`feedback-${value}`)}
                  </Button>
                ))}
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
