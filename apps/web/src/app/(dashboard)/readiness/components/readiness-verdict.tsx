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
  FormControl,
  FormControlLabel,
  // Aliased: `Link` in this file is next/link, for in-app navigation. These
  // references point OFF-site, so they are plain anchors, MUI-styled.
  Link as MuiLink,
  Typography,
} from "@mui/material";

import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiBook from "@/icons/nexture/ni-book";
import NiCamera from "@/icons/nexture/ni-camera";
import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";
import NiCheck from "@/icons/nexture/ni-check";
import NiCheckSquare from "@/icons/nexture/ni-check-square";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";
import NiCreditCard from "@/icons/nexture/ni-credit-card";
import NiExclamationHexagon from "@/icons/nexture/ni-exclamation-hexagon";
import NiFaceFrown from "@/icons/nexture/ni-face-frown";
import NiFaceNeutral from "@/icons/nexture/ni-face-neutral";
import NiFaceSmile from "@/icons/nexture/ni-face-smile";
import NiFaceSmileMore from "@/icons/nexture/ni-face-smile-more";
import NiFlag from "@/icons/nexture/ni-flag";
import NiFlask from "@/icons/nexture/ni-flask";
import NiInfoSquare from "@/icons/nexture/ni-info-square";
import NiLayout from "@/icons/nexture/ni-layout";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiRocket from "@/icons/nexture/ni-rocket";
import NiSearch from "@/icons/nexture/ni-search";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiShieldCross from "@/icons/nexture/ni-shield-cross";
import NiSquircle from "@/icons/nexture/ni-squircle";
import NiTag from "@/icons/nexture/ni-tag";
import type { Confidence, EvidenceSource } from "@/lib/diagnosis/schema";
import {
  EMPTY_READINESS_PROFILE,
  type FindingResolution,
  findingResolution,
  type ReadinessEvaluation,
  type ReadinessItemKey,
  type ReadinessProfile,
  resolvableItems,
} from "@/lib/readiness/checklist";
import type { HowToOutput } from "@/lib/readiness/howto";
import type {
  ReadinessDimension,
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

/** One icon per audited dimension, so a tile is recognisable before it is read. */
const DIMENSION_ICON: Record<ReadinessDimension, React.ReactNode> = {
  oferta: <NiTag size="medium" aria-hidden />,
  pagina: <NiLayout size="medium" aria-hidden />,
  checkout: <NiCreditCard size="medium" aria-hidden />,
  mensuracao: <NiPulse size="medium" aria-hidden />,
  ativacao: <NiRocket size="medium" aria-hidden />,
  funil: <NiChartFunnel size="medium" aria-hidden />,
  descoberta: <NiSearch size="medium" aria-hidden />,
  midia: <NiCamera size="medium" aria-hidden />,
};

type TileTone = "done" | "urgent" | "open";

/**
 * Three tones, not one per group: settled, costs-you-now, worth-doing. Colour
 * carries the binary a glance can actually resolve; the exact reason
 * (blocker / high impact / medium) is spelled out in the tile's label, where
 * it can't be misread as a fourth priority level.
 */
const TILE_TONE: Record<TileTone, { box: string; icon: string }> = {
  done: { box: "bg-grey-25", icon: "text-text-disabled" },
  urgent: { box: "bg-error-light/10", icon: "text-error" },
  open: { box: "bg-primary-light/10", icon: "text-primary" },
};

/**
 * Competence feedback on REAL progress: the face reads the same settled count
 * the fraction does, so it can never be nudged by ticking a box the scan
 * disproves (a contradicted item is not settled).
 */
const MOOD = {
  bad: { icon: <NiFaceFrown size="small" aria-hidden />, tone: "text-error" },
  mid: { icon: <NiFaceNeutral size="small" aria-hidden />, tone: "text-warning" },
  good: { icon: <NiFaceSmile size="small" aria-hidden />, tone: "text-warning" },
  great: { icon: <NiFaceSmileMore size="small" aria-hidden />, tone: "text-success" },
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
   * The plan in reading order (blockers → quick wins → later), which is what
   * the numbered badges count.
   */
  const planOrder = useMemo(
    () => [...groups.blockers, ...groups.quick, ...groups.later].map((entry) => entry.index),
    [groups],
  );

  /** Open one finding and bring it on screen — the "hook" every plan tile
   *  (and the deep link) resolves to. */
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
  const section = (icon: React.ReactNode, tone: string, title: string, body: React.ReactNode) => (
    <Box className="flex flex-row gap-2.5">
      <span className={cn("mt-0.5 flex-none", tone)}>{icon}</span>
      <Box className="w-full min-w-0">
        <Typography variant="subtitle2" component="h5" className="mb-0.5">
          {title}
        </Typography>
        {body}
      </Box>
    </Box>
  );

  /**
   * The official pages that carry the click-by-click detail, lifted from the
   * retrieved excerpts. They matter most exactly when `steps` is empty: our
   * corpus captured the platforms' OVERVIEW pages, which link out to the
   * interface tutorials — so we can still hand over the address even when we
   * cannot write the walkthrough. `rel=noopener` because these open off-site.
   */
  const referenceList = (references: HowToOutput["references"]) => {
    if (references.length === 0) return null;
    return (
      <Box className="flex w-full flex-col gap-1">
        <Typography variant="subtitle2" component="h5">
          {t("howto-references")}
        </Typography>
        {references.map((reference, referenceIndex) => (
          <MuiLink
            key={referenceIndex}
            href={reference.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            className="inline-flex flex-row items-center gap-1"
          >
            <NiArrowRight size="tiny" className="flex-none" />
            {reference.label}
          </MuiLink>
        ))}
      </Box>
    );
  };

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
      // The template's OUTLINED accordion (ui/surfaces/accordion): a bordered
      // head that opens into a bordered panel, no shadow, no nested card. The
      // plan scans as a to-do list instead of four walls of analysis.
      <Accordion
        key={index}
        id={`finding-${index}`}
        elevation={0}
        className="mb-1.5"
        expanded={open}
        onChange={() => toggle(index)}
      >
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
          {/* The template's outlined accordion head (ui/surfaces/accordion):
                the whole row is one bordered button whose border opens into the
                detail panel below. The dimension icon replaces the numbered
                badge — position is the plan tiles' job now. */}
          <Button
            component="div"
            variant="outlined"
            size="large"
            color="grey"
            className="full-width-button border-grey-100 hover:text-primary group-aria-expanded:text-primary items-start group-aria-expanded:rounded-b-none group-aria-expanded:border-b-transparent hover:bg-transparent"
            startIcon={<span className="flex-none">{DIMENSION_ICON[finding.dimension]}</span>}
            endIcon={<NiChevronRightSmall size={20} className="accordion-rotate flex-none" />}
          >
            <Box className="flex w-full min-w-0 flex-col gap-2 md:flex-row md:items-center">
              <Box className="min-w-0 grow">
                <Typography variant="subtitle2" component="h4" className="mb-0">
                  {t(`dimension-${finding.dimension}`)}
                </Typography>
                {/* The payoff stays visible open OR closed — collapsing it on
                      expand made the head jump and lost the one line that says
                      what this item is for. */}
                <Typography
                  variant="body2"
                  className={cn("text-text-secondary whitespace-normal", resolved && "line-through")}
                >
                  {finding.recommended_action}
                </Typography>
              </Box>
              {/* One badge, one truth: proved / your word / not checked yet /
                    the page disagrees — never a green tick for a claim. Open
                    items wear the same urgency word their plan tile does, so
                    the two surfaces can't tell different stories. */}
              <Box className="flex flex-none flex-row flex-wrap items-center gap-1.5">
                {resolution !== "open" ? (
                  <Button
                    component="span"
                    role="note"
                    tabIndex={-1}
                    variant="pastel"
                    size="tiny"
                    color={RESOLUTION_COLOR[resolution]}
                    disableElevation
                    disableRipple
                    className="pointer-events-none flex-none self-center"
                    startIcon={resolution === "verified" ? <NiCheck size="tiny" aria-hidden /> : undefined}
                  >
                    {t(`resolution-${resolution}`)}
                  </Button>
                ) : (
                  <>
                    {finding.status === "sem_dados" && (
                      <Chip label={t("status-sem_dados")} size="small" variant="outlined" color="grey" />
                    )}
                    {levelChip(t("impact"), finding.impact)}
                    {levelChip(t("effort"), finding.effort)}
                  </>
                )}
              </Box>
            </Box>
          </Button>
        </AccordionSummary>
        {/* The head's border continues into the panel (border-t-transparent):
              one object, not a card floating under a button. */}
        <AccordionDetails className="border-grey-100 rounded-b-lg border border-solid border-t-transparent px-6 py-4">
          <Box className="flex flex-col gap-4">
            {/* One reading line per section: coloured icon, name, then the
                  prose in secondary text. No tinted boxes competing for
                  attention — the sections are peers, read top to bottom. */}
            {section(
              <NiFlag size="small" />,
              "text-accent-2",
              t("section-problem"),
              <Typography variant="body2" className="text-text-secondary">
                {finding.finding}
              </Typography>,
            )}

            {finding.evidence.length > 0 &&
              section(
                <NiSearch size="small" />,
                "text-accent-3",
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
                      <Typography variant="body2" className="text-text-secondary">
                        {evidence.statement}
                      </Typography>
                    </Box>
                  ))}
                </Box>,
              )}

            {section(
              <NiArrowRight size="small" />,
              "text-secondary",
              t("section-action"),
              <Box className="flex flex-col gap-2">
                <Typography variant="body2" className={cn("text-text-secondary", resolved && "line-through")}>
                  {finding.recommended_action}
                </Typography>
                {/* Once the step-by-step has been paid for, it belongs HERE —
                      numbered, under the action — not in a separate block
                      further down that repeats the same job. */}
                {typeof howTo === "object" && howTo.howTo.steps.length > 0 && (
                  <Box component="ol" className="m-0 flex list-decimal flex-col gap-1 pl-5">
                    {howTo.howTo.steps.map((step, stepIndex) => (
                      <Typography key={stepIndex} component="li" variant="body2" className="text-text-secondary">
                        {step}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>,
            )}

            {/* Completion criteria — the checklist items this finding is
                  actually about, each its own checkbox. One "marcar como
                  resolvido" used to tick them all at once, which is a lie
                  whenever a finding spans several (you fixed the Pixel, not the
                  CAPI). `success_criterion` stays as the sentence that says
                  what "done" looks like. */}
            {section(
              <NiCheck size="small" />,
              "text-accent-1",
              t("section-success"),
              <>
                <Typography variant="body2" className="text-text-secondary">
                  {finding.success_criterion}
                </Typography>
                {items.length > 0 && onResolve && profile && (
                  <Box className="bg-grey-20 mt-3 flex flex-col items-start rounded-lg p-4">
                    {items.map((key) => (
                      // The template's task-list checkbox (dashboards/visual):
                      // squircle icons, `group` for the hover tint, struck
                      // through once ticked.
                      <FormControl key={key} className="group">
                        <FormControlLabel
                          className="items-start"
                          checked={profile[key] === true}
                          control={
                            <Checkbox
                              icon={
                                <NiSquircle size="large" className="text-text-disabled! group-hover:text-primary!" />
                              }
                              checkedIcon={<NiCheckSquare size="large" />}
                              onChange={(event) => onResolve([key], event.target.checked)}
                            />
                          }
                          label={
                            <Typography
                              variant="body2"
                              className={cn(profile[key] && "text-text-secondary line-through")}
                            >
                              {t(`item-${key}`)}
                            </Typography>
                          }
                        />
                      </FormControl>
                    ))}
                  </Box>
                )}
              </>,
            )}

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

            <Box className="border-grey-50 flex flex-col gap-4 border-t pt-4">
              {/* HOW to do it — the gap between knowing and doing, on demand. */}
              {section(
                <NiBook size="small" />,
                "text-primary",
                t("howto-title"),
                <Box className="flex flex-col gap-2">
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
                        // It must still offer a way forward — an empty answer with
                        // no next action is the dead end this screen exists to avoid.
                        // Nothing was persisted or charged, so retrying is free and
                        // succeeds once the corpus covers the topic.
                        <Box className="flex flex-col items-start gap-2">
                          <Alert severity="info" className="neutral bg-background-paper/60!">
                            <Typography variant="body2">{howTo.howTo.note || t("howto-unsupported")}</Typography>
                          </Alert>
                          {/* The official page IS the next action when the steps
                              are missing — sending the reader away empty-handed
                              while we hold the address is the dead end. */}
                          {referenceList(howTo.howTo.references)}
                          <Typography variant="body2" className="text-text-secondary">
                            {t("howto-retry-hint")}
                          </Typography>
                          {onHowTo && (
                            <Button size="small" variant="outlined" color="grey" onClick={() => onHowTo(index)}>
                              {t("howto-retry")}
                            </Button>
                          )}
                        </Box>
                      )}
                      {howTo.howTo.steps.length > 0 && referenceList(howTo.howTo.references)}
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
                </Box>,
              )}

              {finding.technical_basis.length > 0 &&
                section(
                  <NiBook size="small" />,
                  "text-accent-4",
                  t("section-technical-basis"),
                  <Box className="flex flex-col gap-0.5">
                    {finding.technical_basis.map((basis, basisIndex) => (
                      <Typography key={basisIndex} variant="body2" className="text-text-secondary">
                        {basis.rule} <span className="text-text-disabled">{basis.citation}</span>
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
    );
  };

  const group = (title: string, hint: string, entries: { finding: ReadinessFinding; index: number }[]) =>
    entries.length === 0 ? null : (
      <Box className="flex flex-col gap-2">
        <Box className="flex flex-col gap-0.5">
          <Typography variant="h6" component="h3" className="card-title mb-0">
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
   * A caveat about the ANSWER (what blocks spend / why the base is thin). Kept
   * as plain toned prose rather than a boxed Alert: the doors now live in the
   * plan tiles below, so this only has to STATE the thing — and an error Alert
   * read as "the app broke" when the message is "your structure is not ready".
   */
  const caveat = (icon: React.ReactNode, title: string, body: React.ReactNode) => (
    <Box className="flex w-full flex-row items-start gap-3">
      <span className="mt-0.5 flex-none">{icon}</span>
      <Box className="min-w-0">
        <Typography variant="subtitle2" component="h3" className="mb-0.5">
          {title}
        </Typography>
        {body}
      </Box>
    </Box>
  );

  /**
   * The plan as DOORS. Every finding — including the ones already settled — is
   * one tile that opens its card below, so the answer card is the entry point
   * to the work instead of a dead summary that ends at "fix the first
   * blocker". Reading order is the plan's own leverage order; the settled ones
   * ride along greyed out, which is what makes the X/N count legible at a
   * glance instead of needing a separate progress sentence.
   */
  const tiles = useMemo(() => {
    const ordered = [...groups.blockers, ...groups.quick, ...groups.later, ...groups.ok];
    return ordered.map((entry) => {
      const resolution = findingResolution(
        resolvableItems(entry.finding.dimension, entry.finding.related_items),
        profile ?? EMPTY_READINESS_PROFILE,
        {
          verified: evaluation?.verified ?? [],
          contradicted: evaluation?.contradicted ?? [],
          canVerify: Boolean(onVerifyNow),
          unprovable: evaluation?.unprovable ?? [],
        },
      );
      const settled = resolution === "verified" || resolution === "declared" || resolution === "declared-unverifiable";
      const done = settled || entry.finding.status === "ok";
      // The tone says how urgent, the label says the state — a settled item
      // never wears an urgency colour, and an urgent one never wears a label
      // that implies we checked it.
      const tone: TileTone = done
        ? "done"
        : entry.finding.status === "critico" || entry.finding.impact === "alto"
          ? "urgent"
          : "open";
      const label =
        entry.finding.status === "ok"
          ? t("tile-ok")
          : resolution === "verified"
            ? t("tile-verified")
            : resolution === "declared" || resolution === "declared-unverifiable"
              ? t("tile-declared")
              : resolution === "contradicted"
                ? t("tile-contradicted")
                : resolution === "awaiting-proof"
                  ? t("tile-awaiting")
                  : entry.finding.status === "critico"
                    ? t("tile-blocker")
                    : t(`tile-impact-${entry.finding.impact}`);
      return { ...entry, tone, label, done };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, profile, evaluation, onVerifyNow]);

  const tilesDone = tiles.filter((tile) => tile.done).length;
  const tilePercent = tiles.length === 0 ? 0 : Math.round((tilesDone / tiles.length) * 100);
  const mood: keyof typeof MOOD =
    tilePercent === 100 ? "great" : tilePercent >= 60 ? "good" : tilePercent >= 25 ? "mid" : "bad";

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

          <Box className="flex w-full flex-col items-start gap-5">
            <Typography variant="body1" component="p" className="text-text-secondary w-full text-start">
              {output.summary}
            </Typography>

            {output.blocking.length > 0 &&
              caveat(
                <NiExclamationHexagon size="medium" className="text-error" aria-hidden />,
                t("blocking-title"),
                // Every blocker, not just the first: the card claims to name
                // what stops the spend, and silently dropping the rest of the
                // list makes a resolved #1 look like the finish line.
                <Box className="flex flex-col gap-0.5">
                  {output.blocking.map((item, blockingIndex) => (
                    <Typography key={blockingIndex} variant="body2" className="text-text-secondary">
                      {output.blocking.length > 1 ? `${blockingIndex + 1}. ${item}` : item}
                    </Typography>
                  ))}
                </Box>,
              )}

            {/* A caveat about the answer belongs INSIDE the answer, not
                floating between it and the plan. */}
            {output.insufficient_data &&
              caveat(
                <NiInfoSquare size="medium" className="text-info" aria-hidden />,
                t("insufficient-title"),
                <Typography variant="body2" className="text-text-secondary">
                  {output.missing_data || t("insufficient-body")}
                </Typography>,
              )}
          </Box>

          {/* THE PLAN AS DOORS — the card stops at "here is the answer" and
              becomes the way IN to the work. Each tile opens its finding
              below; nothing here is decoration. */}
          {tiles.length > 0 && (
            <Box className="MuiPaper-outlined MuiPaper-rounded bg-background-paper/95 mt-10 flex w-full flex-col items-center rounded-lg p-5">
              <Typography variant="h4" component="h3" className="card-title mb-0">
                {t("plan-title")}
              </Typography>
              <Typography variant="body1" className="text-text-secondary mb-4 text-center">
                {t("plan-body")}
              </Typography>

              <Box className="flex w-full flex-row flex-wrap justify-center gap-2.5">
                {tiles.map(({ finding, index, tone, label }, position) => (
                  <Box
                    key={index}
                    component="button"
                    type="button"
                    onClick={() => focusFinding(index)}
                    // Position in the TILE order, not planOrder — settled `ok`
                    // findings are absent from planOrder, so indexOf gave them
                    // "Item 0 do plano".
                    aria-label={t("finding-summary-aria", {
                      position: position + 1,
                      dimension: t(`dimension-${finding.dimension}`),
                      state: label,
                    })}
                    className="border-grey-50 bg-background-paper flex w-48 flex-none cursor-pointer flex-row items-center rounded-3xl border p-1 text-start transition-transform hover:scale-[1.02]"
                  >
                    <Box
                      className={cn(
                        "flex h-18 w-16 flex-none items-center justify-center rounded-2xl",
                        TILE_TONE[tone].box,
                        TILE_TONE[tone].icon,
                      )}
                    >
                      {DIMENSION_ICON[finding.dimension]}
                    </Box>
                    <Box className="min-w-0 px-3 py-2">
                      <Typography variant="body2" component="span" className="text-text-secondary block leading-4">
                        {label}
                      </Typography>
                      <Typography variant="subtitle2" component="span" className="mb-0 block leading-5">
                        {t(`dimension-${finding.dimension}`)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              {/* Completion drive over the plan itself: the count and the face
                  read the SAME settled set, and only evidence (or an item the
                  scan structurally cannot see) settles one — so neither can be
                  inflated by ticking a box the page disproves. */}
              <Box className="mt-4 flex flex-row items-center gap-2">
                <Typography variant="h5" component="p" className="mb-0">
                  {`${tilesDone}/${tiles.length}`}
                </Typography>
                <Box className={cn("flex flex-row items-center gap-1", MOOD[mood].tone)}>
                  {MOOD[mood].icon}
                  <Typography variant="body2" className={MOOD[mood].tone}>
                    {`${tilePercent}%`}
                  </Typography>
                </Box>
                <span className="sr-only">{t("plan-progress", { done: tilesDone, total: tiles.length })}</span>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* THE WORK — a second card holding the detail each tile opens. Its
          title, the jump chips and the progress bar all moved up into the
          answer card's plan panel: one plan, stated once. */}
      <Card component="section">
        <CardContent className="flex flex-col gap-5">
          {/* No "N already fine" line here any more: every settled dimension
              is its own greyed tile in the panel above, so this only ever
              repeated the same list in words. */}
          {group(t("plan-blockers"), t("plan-blockers-hint"), groups.blockers)}
          {group(t("plan-quick"), t("plan-quick-hint"), groups.quick)}
          {group(t("plan-later"), t("plan-later-hint"), groups.later)}

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
