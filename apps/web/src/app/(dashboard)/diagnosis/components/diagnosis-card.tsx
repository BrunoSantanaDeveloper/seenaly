"use client";

import { useTranslations } from "next-intl";

import { Alert, Box, Button, Card, CardContent, Chip, Divider, Typography } from "@mui/material";

import NiPulse from "@/icons/nexture/ni-pulse";
import type { Confidence, DiagnosisOutput, EvidenceSource } from "@/lib/diagnosis/schema";

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

/**
 * Renders the fixed 9-field answer format. The reader must be able to check
 * the reasoning: every claim shows the source it is anchored to, and an
 * "insufficient data" diagnosis is displayed as a valid, honest outcome —
 * never dressed up as a confident recommendation.
 */
export default function DiagnosisCard({
  output,
  meta,
  feedback,
  onFeedback,
  feedbackBusy,
}: {
  output: DiagnosisOutput;
  meta: DiagnosisMeta;
  /** Current user's rating, when the card is interactive. */
  feedback?: DiagnosisRating | null;
  onFeedback?: (rating: DiagnosisRating) => void;
  feedbackBusy?: boolean;
}) {
  const t = useTranslations("diagnosis");

  const section = (title: string, body: React.ReactNode) => (
    <Box className="flex flex-col gap-1">
      <Typography variant="subtitle2" className="text-text-secondary uppercase">
        {title}
      </Typography>
      {body}
    </Box>
  );

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
          t("section-diagnosis"),
          <Typography variant="body1" className="leading-6">
            {output.diagnosis}
          </Typography>,
        )}

        {section(
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

        {output.technical_basis.length > 0 &&
          section(
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
          t("section-hypothesis"),
          <Typography variant="body1" className="leading-6">
            {output.hypothesis}
          </Typography>,
        )}

        {section(
          t("section-action"),
          <Typography variant="body1" className="leading-6 font-medium">
            {output.recommended_action}
          </Typography>,
        )}

        {section(
          t("section-risk"),
          <Typography variant="body2" className="text-text-secondary leading-6">
            {output.risk}
          </Typography>,
        )}

        {section(
          t("section-success"),
          <Typography variant="body2" className="leading-6">
            {output.success_criterion}
          </Typography>,
        )}

        {section(
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
