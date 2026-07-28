"use client";

import FunnelBreakdown from "../../funnel/components/funnel-breakdown";
import type { FunnelCounts } from "../../funnel/types";
import { useTranslations } from "next-intl";

import { Alert, Box, Button, Card, CardContent, Chip, Divider, Typography } from "@mui/material";

import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiBook from "@/icons/nexture/ni-book";
import NiCalendar from "@/icons/nexture/ni-calendar";
import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";
import NiCheck from "@/icons/nexture/ni-check";
import NiExclamationHexagon from "@/icons/nexture/ni-exclamation-hexagon";
import NiFlag from "@/icons/nexture/ni-flag";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiSearch from "@/icons/nexture/ni-search";
import type { Confidence, DiagnosisOutput, EvidenceSource } from "@/lib/diagnosis/schema";
import { splitActionSteps } from "@/lib/diagnosis/steps";

/** Usefulness rating on a diagnosis — the signal that lets us tune the engine. */
export type DiagnosisRating = "useful" | "not_useful" | "incorrect";

const CONFIDENCE_COLOR: Record<Confidence, "warning" | "primary" | "success"> = {
  baixa: "warning",
  media: "primary",
  alta: "success",
};

/** Evidence sources carry different authority — show it, don't flatten it. */
const SOURCE_COLOR: Record<EvidenceSource, "success" | "primary" | "info" | "default"> = {
  meta_docs: "success",
  campaign_data: "primary",
  growth_playbook: "info",
  product_context: "default",
};

export interface DiagnosisMeta {
  createdAt: string;
  hadCampaignData: boolean;
  knowledgeRefs: { title: string; trust_level: number }[];
}

/** The funnel snapshot the engine reasoned from, when one exists. */
export interface DiagnosisFunnel {
  counts: FunnelCounts;
  label: string | null;
}

/**
 * Renders the fixed 9-field answer format. The reader must be able to check
 * the reasoning: every claim shows the source it is anchored to, and an
 * "insufficient data" diagnosis is displayed as a valid, honest outcome —
 * never dressed up as a confident recommendation.
 */
export default function DiagnosisCard({
  output,
  meta,
  funnel = null,
  feedback,
  onFeedback,
  feedbackBusy,
}: {
  output: DiagnosisOutput;
  meta: DiagnosisMeta;
  /**
   * The funnel numbers behind the reasoning. Rendered ONLY when they exist —
   * a chart drawn from no data would fabricate precision the diagnosis itself
   * is careful not to claim.
   */
  funnel?: DiagnosisFunnel | null;
  /** Current user's rating, when the card is interactive. */
  feedback?: DiagnosisRating | null;
  onFeedback?: (rating: DiagnosisRating) => void;
  feedbackBusy?: boolean;
}) {
  const t = useTranslations("diagnosis");
  const tf = useTranslations("funnel");

  /**
   * Nine sections shared identical typography (uppercase gray label + body),
   * so the card read as one undifferentiated column of prose and the reader had
   * to parse every line to find the one they wanted. An icon per section gives
   * the eye an anchor; `emphasize` boxes the section that is not descriptive
   * but ACTIONABLE — the same tinted language used across readiness.
   */
  const section = (icon: React.ReactNode, title: string, body: React.ReactNode, emphasize = false) =>
    emphasize ? (
      <Box className="bg-primary/5 flex flex-row items-start gap-2 rounded-2xl p-3">
        <span className="text-primary mt-0.5 flex-none">{icon}</span>
        <Box className="flex min-w-0 flex-col gap-1">
          <Typography variant="subtitle2" className="text-text-secondary mb-0 uppercase">
            {title}
          </Typography>
          {body}
        </Box>
      </Box>
    ) : (
      <Box className="flex flex-col gap-1">
        <Box className="flex flex-row items-center gap-1.5">
          <span className="text-text-secondary flex-none">{icon}</span>
          <Typography variant="subtitle2" className="text-text-secondary mb-0 uppercase">
            {title}
          </Typography>
        </Box>
        {body}
      </Box>
    );

  // The action is one string, but for a cold-start account it is genuinely a
  // sequence — render the steps the model already wrote instead of a wall.
  const actionSteps = splitActionSteps(output.recommended_action);

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-5">
        <Box className="flex flex-row flex-wrap items-center gap-2">
          <span className="bg-primary/10 text-primary flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
            <NiPulse size="medium" />
          </span>
          <Typography variant="h5" component="h2" className="card-title grow">
            {t("result-title")}
          </Typography>
          <Chip
            label={`${t("confidence")}: ${t(`confidence-${output.confidence}`)}`}
            size="small"
            variant="outlined"
            color={CONFIDENCE_COLOR[output.confidence]}
          />
          <Chip
            label={meta.hadCampaignData ? t("with-campaign-data") : t("without-campaign-data")}
            size="small"
            variant="outlined"
            color={meta.hadCampaignData ? "primary" : "default"}
          />
        </Box>

        {output.insufficient_data && (
          <Alert severity="info" className="neutral bg-background-paper/60!">
            <Typography variant="subtitle2">{t("insufficient-title")}</Typography>
            <Typography variant="body2">{output.missing_data || t("insufficient-body")}</Typography>
          </Alert>
        )}

        {section(
          <NiPulse size="small" />,
          t("section-diagnosis"),
          <Typography variant="body1" className="leading-6">
            {output.diagnosis}
          </Typography>,
        )}

        {section(
          <NiSearch size="small" />,
          t("section-evidence"),
          <Box className="flex flex-col gap-1.5">
            {output.evidence.map((item, index) => (
              <Box key={index} className="flex flex-row items-start gap-2">
                <Chip
                  label={t(`source-${item.source}`)}
                  size="small"
                  variant="outlined"
                  color={SOURCE_COLOR[item.source] ?? "default"}
                  className="mt-0.5 flex-none"
                />
                <Typography variant="body2" className="leading-6">
                  {item.statement}
                </Typography>
              </Box>
            ))}
          </Box>,
        )}

        {/* The numbers the reasoning stands on, drawn as the funnel they are.
            Present only when a real snapshot exists: with no data the card
            stays text, because a chart of nothing invents precision the
            diagnosis explicitly refuses to claim. */}
        {funnel &&
          section(
            <NiChartFunnel size="small" />,
            funnel.label ? t("section-funnel-labelled", { period: funnel.label }) : t("section-funnel"),
            <FunnelBreakdown
              bare
              dense
              counts={funnel.counts}
              labels={{
                visits: tf("field-visits"),
                signups: tf("field-signups"),
                checkout: tf("field-checkoutInitiated"),
                purchases: tf("field-purchases"),
                ofPrevious: tf("of-previous"),
                refundRate: tf("refund-rate"),
                noData: tf("no-data"),
              }}
            />,
          )}

        {output.technical_basis.length > 0 &&
          section(
            <NiBook size="small" />,
            t("section-technical-basis"),
            <Box className="flex flex-col gap-1">
              {output.technical_basis.map((item, index) => (
                <Typography key={index} variant="body2" className="leading-6">
                  {item.rule} <span className="text-text-secondary">{item.citation}</span>
                </Typography>
              ))}
            </Box>,
          )}

        <Divider />

        {section(
          <NiFlag size="small" />,
          t("section-hypothesis"),
          <Typography variant="body1" className="leading-6">
            {output.hypothesis}
          </Typography>,
        )}

        {/* The payoff of the whole card — boxed, and rendered as the numbered
            sequence the model actually wrote instead of one dense paragraph. */}
        {section(
          <NiArrowRight size="small" />,
          t("section-action"),
          actionSteps.length > 1 ? (
            <Box component="ol" className="m-0 flex list-decimal flex-col gap-1.5 pl-5">
              {actionSteps.map((step, index) => (
                <Typography key={index} component="li" variant="body1" className="leading-6 font-medium">
                  {step}
                </Typography>
              ))}
            </Box>
          ) : (
            <Typography variant="body1" className="leading-6 font-medium">
              {output.recommended_action}
            </Typography>
          ),
          true,
        )}

        {section(
          <NiExclamationHexagon size="small" />,
          t("section-risk"),
          <Typography variant="body2" className="text-text-secondary leading-6">
            {output.risk}
          </Typography>,
        )}

        {section(
          <NiCheck size="small" />,
          t("section-success"),
          <Typography variant="body2" className="leading-6">
            {output.success_criterion}
          </Typography>,
        )}

        {section(
          <NiCalendar size="small" />,
          t("section-next-review"),
          <Typography variant="body2" className="text-text-secondary leading-6">
            {output.next_review}
          </Typography>,
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
