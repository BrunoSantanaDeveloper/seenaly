"use client";

import type { OrganicRecommendationRow, RecommendationFeedback } from "../types";
import { useTranslations } from "next-intl";

import { Alert, Box, Button, Card, CardContent, Chip, Divider, Typography } from "@mui/material";

import NiFlask from "@/icons/nexture/ni-flask";
import NiPulse from "@/icons/nexture/ni-pulse";

const priorityColor = {
  critica: "error",
  alta: "warning",
  media: "primary",
  baixa: "default",
} as const;

const confidenceColor = {
  baixa: "warning",
  media: "primary",
  alta: "success",
} as const;

export default function RecommendationCard({
  recommendation,
  busy,
  onFeedback,
  onCreateExperiment,
}: {
  recommendation: OrganicRecommendationRow;
  busy?: boolean;
  onFeedback?: (value: RecommendationFeedback) => void;
  onCreateExperiment?: () => void;
}) {
  const t = useTranslations("organicGrowth");
  const evidence = recommendation.evidence ?? [];

  const section = (label: string, body: React.ReactNode) => (
    <Box className="flex flex-col gap-1">
      <Typography variant="subtitle2" className="text-text-secondary uppercase">
        {label}
      </Typography>
      {body}
    </Box>
  );

  return (
    <Card component="article">
      <CardContent className="flex flex-col gap-5">
        <Box className="flex flex-row flex-wrap items-start gap-2">
          <span className="bg-primary/10 text-primary flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
            <NiPulse size="medium" />
          </span>
          <Box className="grow">
            <Typography variant="overline" className="text-primary">
              {t(`recommendation-kind-${recommendation.kind}`)}
            </Typography>
            <Typography variant="h5" component="h2" className="card-title mb-0">
              {recommendation.diagnosis}
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            color={priorityColor[recommendation.priority]}
            label={t(`priority-${recommendation.priority}`)}
          />
          <Chip
            size="small"
            variant="outlined"
            color={confidenceColor[recommendation.confidence]}
            label={`${t("confidence")}: ${t(`confidence-${recommendation.confidence}`)}`}
          />
        </Box>

        {evidence.length === 0 ? (
          <Alert severity="warning" className="neutral bg-background-paper/60!">
            {t("recommendation-no-evidence")}
          </Alert>
        ) : (
          section(
            t("recommendation-evidence"),
            <Box className="flex flex-col gap-2">
              {evidence.map((item, index) => (
                <Box key={item.id ?? index} className="flex flex-row items-start gap-2">
                  <Chip size="small" variant="outlined" color="grey" label={t(`evidence-${item.kind}`)} />
                  <Typography variant="body2" className="leading-6">
                    {item.fact}
                  </Typography>
                </Box>
              ))}
            </Box>,
          )
        )}

        {section(
          t("recommendation-hypothesis"),
          <Typography variant="body1" className="leading-6">
            {recommendation.hypothesis}
          </Typography>,
        )}

        {section(
          t("recommendation-action"),
          <Typography variant="body1" className="leading-6 font-medium">
            {recommendation.recommended_action}
          </Typography>,
        )}

        <Box className="grid gap-3 sm:grid-cols-3">
          <Box>
            <Typography variant="body2" className="text-text-secondary">
              {t("effort")}
            </Typography>
            <Typography variant="subtitle2">{t(`effort-${recommendation.estimated_effort}`)}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" className="text-text-secondary">
              {t("impact")}
            </Typography>
            <Typography variant="subtitle2">{t(`impact-${recommendation.expected_impact}`)}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" className="text-text-secondary">
              {t("recommendation-next-review")}
            </Typography>
            <Typography variant="subtitle2">{recommendation.next_review}</Typography>
          </Box>
        </Box>

        {section(
          t("recommendation-risk"),
          <Typography variant="body2" className="text-text-secondary leading-6">
            {recommendation.risk}
          </Typography>,
        )}

        {section(
          t("recommendation-success"),
          <Typography variant="body2" className="leading-6">
            {recommendation.success_criterion}
          </Typography>,
        )}

        <Divider />

        <Box className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center print:hidden">
          {recommendation.experiment_id ? (
            <Button variant="outlined" color="grey" href={`/experiments/${recommendation.experiment_id}`}>
              {t("open-experiment")}
            </Button>
          ) : (
            onCreateExperiment && (
              <Button
                variant="outlined"
                color="grey"
                startIcon={<NiFlask size="small" />}
                disabled={busy}
                onClick={onCreateExperiment}
              >
                {t("create-experiment")}
              </Button>
            )
          )}

          {onFeedback && (
            <Box className="flex flex-row flex-wrap items-center gap-1">
              <Typography variant="body2" className="text-text-secondary mr-1">
                {t("feedback-question")}
              </Typography>
              {(["useful", "not_useful", "incorrect"] as RecommendationFeedback[]).map((value) => (
                <Button
                  key={value}
                  size="small"
                  color={recommendation.feedback === value ? "primary" : "grey"}
                  variant={recommendation.feedback === value ? "outlined" : "text"}
                  disabled={busy}
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
  );
}
