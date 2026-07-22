"use client";

import type { DiagnosisRating } from "../../diagnosis/components/diagnosis-card";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

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
  Typography,
} from "@mui/material";

import NiChevronDown from "@/icons/nexture/ni-chevron-down";
import NiFlag from "@/icons/nexture/ni-flag";
import NiFlask from "@/icons/nexture/ni-flask";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiShieldCross from "@/icons/nexture/ni-shield-cross";
import type { Confidence, EvidenceSource } from "@/lib/diagnosis/schema";
import { type ReadinessItemKey, type ReadinessProfile, resolvableItems } from "@/lib/readiness/checklist";
import type { HowToOutput } from "@/lib/readiness/howto";
import type {
  ReadinessFinding,
  ReadinessLevel,
  ReadinessOutput,
  ReadinessVerdict as Verdict,
} from "@/lib/readiness/schema";

const VERDICT_ICON: Record<Verdict, React.ReactNode> = {
  pronto: <NiShieldCheck size="medium" />,
  quase: <NiFlag size="medium" />,
  nao_pronto: <NiShieldCross size="medium" />,
};

/** The verdict drives the whole card's tone — it is the answer they came for. */
const VERDICT_TONE: Record<Verdict, string> = {
  pronto: "bg-success/10 text-success",
  quase: "bg-warning/10 text-warning",
  nao_pronto: "bg-error/10 text-error",
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
 * The verdict, presented as a PLAN rather than a report.
 *
 * The first version rendered all seven findings fully expanded — evidence
 * chips, technical basis, citations, the lot — and users (including the
 * product's own author) bounced off it: "um relatoriozão, sem critérios de
 * leitura". Everything was equally loud, so nothing was.
 *
 * So the reading order is now explicit and three-layered:
 *   verdict → what blocks spending → a prioritized, COLLAPSED plan.
 * Findings are grouped by what the reader should do about them (blockers →
 * quick wins → later → already fine) and the detail only opens on demand. The
 * step-by-step is likewise on demand: adding it inline would have rebuilt the
 * exact wall this rewrite removes.
 */
export default function ReadinessVerdict({
  output,
  meta,
  feedback,
  onFeedback,
  feedbackBusy,
  onRegisterFinding,
  registeringIndex,
  profile,
  onResolve,
  howToByIndex,
  onHowTo,
  firmUpActions,
}: {
  output: ReadinessOutput;
  meta: ReadinessMeta;
  feedback?: DiagnosisRating | null;
  onFeedback?: (rating: DiagnosisRating) => void;
  feedbackBusy?: boolean;
  /** Turn one finding into a tracked experiment (closes the learning loop). */
  onRegisterFinding?: (findingIndex: number) => void;
  registeringIndex?: number | null;
  /** Current declared checklist — decides which findings read as resolved. */
  profile?: ReadinessProfile;
  /** Tick/untick the checklist items a finding is about. */
  onResolve?: (items: ReadinessItemKey[], resolved: boolean) => void;
  howToByIndex?: Record<number, HowToState | undefined>;
  onHowTo?: (findingIndex: number) => void;
  /** Deterministic "what would firm this up" buttons, owned by the page. */
  firmUpActions?: React.ReactNode;
}) {
  const t = useTranslations("readiness");
  const tone = VERDICT_TONE[output.verdict];

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

  const levelChip = (label: string, value: ReadinessLevel) => (
    <Chip
      label={`${label}: ${t(`level-${value}`)}`}
      size="small"
      variant="outlined"
      color={value === "alto" ? "primary" : "grey"}
      className="flex-none"
    />
  );

  const section = (title: string, body: React.ReactNode) => (
    <Box className="flex flex-col gap-0.5">
      <Typography variant="subtitle2" className="text-text-secondary uppercase">
        {title}
      </Typography>
      {body}
    </Box>
  );

  const findingRow = ({ finding, index }: { finding: ReadinessFinding; index: number }) => {
    const items = resolvableItems(finding.dimension, finding.related_items);
    // "Resolved" is read from the checklist, the single source of structural
    // truth — so ticking it here and ticking it there mean the same thing.
    const resolved = items.length > 0 && profile != null && items.every((key) => profile[key]);
    const howTo = howToByIndex?.[index];
    const needsSpecialist =
      finding.effort === "alto" || (typeof howTo === "object" && howTo.howTo.needs_specialist === true);

    return (
      <Accordion key={index} disableGutters elevation={0} className="border-grey-50 border-b">
        <AccordionSummary expandIcon={<NiChevronDown size="small" />} aria-label={finding.recommended_action}>
          {/* Padding lives here, not on the summary: the app's accordion.css
              applies `p-0` to .MuiAccordionSummary-root, so rows would collide. */}
          <Box className="flex w-full flex-row items-center gap-3 py-3 pr-2">
            {items.length > 0 && onResolve && (
              // Stop propagation: ticking "done" must not also toggle the panel.
              <Box onClick={(event) => event.stopPropagation()} className="flex-none">
                <Checkbox
                  size="small"
                  checked={resolved}
                  onChange={(event) => onResolve(items, event.target.checked)}
                  slotProps={{ input: { "aria-label": t("resolve-aria", { fix: finding.recommended_action }) } }}
                />
              </Box>
            )}
            <Box className="grow overflow-hidden">
              <Typography variant="subtitle2" className="text-text-secondary mb-0">
                {t(`dimension-${finding.dimension}`)}
              </Typography>
              <Typography
                variant="body2"
                className={resolved ? "text-text-secondary line-through" : "text-text-primary line-clamp-1"}
              >
                {finding.recommended_action}
              </Typography>
            </Box>
            <Box className="hidden flex-none flex-row gap-1 sm:flex">
              {/* Grouping already conveys critical/attention, so a status chip
                  would be noise — except `sem_dados`, which means "we could not
                  evaluate this" and is NOT the same as "do it later". */}
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
            </Box>
          </Box>
        </AccordionSummary>

        <AccordionDetails>
          <Box className="flex flex-col gap-3 pb-4">
            <Typography variant="body1" className="leading-6">
              {finding.finding}
            </Typography>

            {finding.evidence.length > 0 && (
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
              </Box>
            )}

            {section(
              t("section-success"),
              <Typography variant="body2" className="leading-6">
                {finding.success_criterion}
              </Typography>,
            )}

            {/* HOW to do it — the gap between knowing and doing. On demand, so
                the plan above stays scannable. */}
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
                    {t("howto-cta")}
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
                  {howTo.howTo.steps.length > 0 ? (
                    <Box component="ol" className="m-0 list-decimal space-y-1.5 pl-5">
                      {howTo.howTo.steps.map((step, stepIndex) => (
                        <Typography key={stepIndex} component="li" variant="body2" className="leading-6">
                          {step}
                        </Typography>
                      ))}
                    </Box>
                  ) : (
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
                <Typography variant="body2" className="text-text-secondary">
                  {t("howto-specialist")}
                </Typography>
              )}
            </Box>

            {finding.technical_basis.length > 0 &&
              section(
                t("section-technical-basis"),
                <Box className="flex flex-col gap-0.5">
                  {finding.technical_basis.map((basis, basisIndex) => (
                    <Typography key={basisIndex} variant="body2" className="leading-6">
                      {basis.rule} <span className="text-text-secondary">{basis.citation}</span>
                    </Typography>
                  ))}
                </Box>,
              )}

            {onRegisterFinding && (
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
                {/* Say what the button DOES — "registrar como experimento" was
                    jargon nobody could decode. */}
                <Typography variant="body2" className="text-text-secondary">
                  {t("register-experiment-hint")}
                </Typography>
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
    );
  };

  const group = (title: string, hint: string, entries: { finding: ReadinessFinding; index: number }[]) =>
    entries.length === 0 ? null : (
      <Box className="flex flex-col gap-1">
        <Box className="flex flex-col gap-0.5">
          <Typography variant="subtitle1" component="h3" className="mb-0">
            {title} <span className="text-text-secondary">({entries.length})</span>
          </Typography>
          <Typography variant="body2" className="text-text-secondary">
            {hint}
          </Typography>
        </Box>
        <Box>{entries.map(findingRow)}</Box>
      </Box>
    );

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-5">
        <Box className="flex flex-row flex-wrap items-center gap-3">
          <span className={`flex h-12 w-12 flex-none items-center justify-center rounded-2xl ${tone}`}>
            {VERDICT_ICON[output.verdict]}
          </span>
          <Box className="grow">
            <Typography variant="h5" component="h2" className="card-title mb-0">
              {t(`verdict-${output.verdict}`)}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("verdict-subtitle")}
            </Typography>
          </Box>
          <Chip
            label={`${t("confidence")}: ${t(`confidence-${output.confidence}`)}`}
            size="small"
            variant="outlined"
            color={CONFIDENCE_COLOR[output.confidence]}
            className="flex-none"
          />
        </Box>

        <Typography variant="body1" className="leading-6">
          {output.summary}
        </Typography>

        {output.blocking.length > 0 && (
          <Alert severity="error" className="neutral bg-background-paper/60!">
            <Typography variant="subtitle2">{t("blocking-title")}</Typography>
            <Box component="ul" className="m-0 mt-1 list-disc space-y-0.5 pl-5">
              {output.blocking.map((item, index) => (
                <Typography key={index} component="li" variant="body2">
                  {item}
                </Typography>
              ))}
            </Box>
          </Alert>
        )}

        {output.insufficient_data && (
          <Alert severity="info" className="neutral bg-background-paper/60!">
            <Typography variant="subtitle2">{t("insufficient-title")}</Typography>
            <Typography variant="body2">{output.missing_data || t("insufficient-body")}</Typography>
          </Alert>
        )}

        <Divider />

        <Box className="flex flex-col gap-5">
          <Box className="flex flex-col gap-0.5">
            <Typography variant="h5" component="h2" className="card-title mb-0">
              {t("plan-title")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("plan-body")}
            </Typography>
          </Box>

          {group(t("plan-blockers"), t("plan-blockers-hint"), groups.blockers)}
          {group(t("plan-quick"), t("plan-quick-hint"), groups.quick)}
          {group(t("plan-later"), t("plan-later-hint"), groups.later)}

          {/* What is already fine is worth one line of credit, not a section. */}
          {groups.ok.length > 0 && (
            <Typography variant="body2" className="text-success">
              {t("plan-ok", {
                count: groups.ok.length,
                dimensions: groups.ok.map((x) => t(`dimension-${x.finding.dimension}`)).join(", "),
              })}
            </Typography>
          )}
        </Box>

        {/* Turned from prose into real actions — the page owns them because
            they are derived from actual state, not from the model. */}
        {firmUpActions && (
          <>
            <Divider />
            <Box className="flex flex-col gap-2">
              <Box className="flex flex-col gap-0.5">
                <Typography variant="subtitle2" className="text-text-secondary uppercase">
                  {t("section-missing")}
                </Typography>
                {!output.insufficient_data && output.missing_data && (
                  <Typography variant="body2" className="text-text-secondary leading-6">
                    {output.missing_data}
                  </Typography>
                )}
              </Box>
              {firmUpActions}
            </Box>
          </>
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

        <Typography variant="body2" className="text-text-secondary">
          {t("generated-at", { when: new Date(meta.createdAt).toLocaleString() })}
        </Typography>

        {onFeedback && (
          <>
            <Divider />
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
