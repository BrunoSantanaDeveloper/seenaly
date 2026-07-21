"use client";

import type { DiagnosisRating } from "../../diagnosis/components/diagnosis-card";
import { useTranslations } from "next-intl";

import { Alert, Box, Button, Card, CardContent, Chip, Divider, Typography } from "@mui/material";

import NiFlag from "@/icons/nexture/ni-flag";
import NiFlask from "@/icons/nexture/ni-flask";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiShieldCross from "@/icons/nexture/ni-shield-cross";
import type { Confidence, EvidenceSource } from "@/lib/diagnosis/schema";
import type {
  ReadinessDimension,
  ReadinessFinding,
  ReadinessLevel,
  ReadinessOutput,
  ReadinessStatus,
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

const STATUS_COLOR: Record<ReadinessStatus, "success" | "warning" | "error" | "grey"> = {
  ok: "success",
  atencao: "warning",
  critico: "error",
  sem_dados: "grey",
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

/**
 * Renders the readiness verdict: can I spend on ads yet, and what do I fix
 * first? Findings arrive already ordered by leverage, so the reader's eye lands
 * on the highest-value fix without ranking anything themselves.
 *
 * Every claim shows the source it is anchored to and every fix shows effort ×
 * impact — so a cheap, decisive fix is visibly different from an expensive,
 * incremental one, and the user can disagree with a specific line.
 */
export default function ReadinessVerdict({
  output,
  meta,
  feedback,
  onFeedback,
  feedbackBusy,
  onRegisterFinding,
  registeringIndex,
}: {
  output: ReadinessOutput;
  meta: ReadinessMeta;
  /** Current user's rating, when the card is interactive. */
  feedback?: DiagnosisRating | null;
  onFeedback?: (rating: DiagnosisRating) => void;
  feedbackBusy?: boolean;
  /** Turn one finding into a tracked experiment (closes the learning loop). */
  onRegisterFinding?: (findingIndex: number) => void;
  registeringIndex?: number | null;
}) {
  const t = useTranslations("readiness");
  const tone = VERDICT_TONE[output.verdict];

  const levelChip = (label: string, value: ReadinessLevel) => (
    <Chip
      label={`${label}: ${t(`level-${value}`)}`}
      size="small"
      variant="outlined"
      color={value === "alto" ? "primary" : "grey"}
      className="flex-none"
    />
  );

  const finding = (item: ReadinessFinding, index: number) => (
    <Box key={index} className="flex flex-col gap-2">
      <Divider />
      <Box className="flex flex-row flex-wrap items-center gap-2">
        <Typography variant="subtitle1" component="h3" className="mb-0 grow">
          {t(`dimension-${item.dimension as ReadinessDimension}`)}
        </Typography>
        <Chip
          label={t(`status-${item.status}`)}
          size="small"
          variant="outlined"
          color={STATUS_COLOR[item.status]}
          className="flex-none"
        />
        {levelChip(t("impact"), item.impact)}
        {levelChip(t("effort"), item.effort)}
      </Box>

      <Typography variant="body1" className="leading-6">
        {item.finding}
      </Typography>

      {item.evidence.length > 0 && (
        <Box className="flex flex-col gap-1.5">
          {item.evidence.map((evidence, evidenceIndex) => (
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

      <Box className="flex flex-col gap-0.5">
        <Typography variant="subtitle2" className="text-text-secondary uppercase">
          {t("section-action")}
        </Typography>
        <Typography variant="body1" className="leading-6 font-medium">
          {item.recommended_action}
        </Typography>
      </Box>

      <Box className="flex flex-col gap-0.5">
        <Typography variant="subtitle2" className="text-text-secondary uppercase">
          {t("section-success")}
        </Typography>
        <Typography variant="body2" className="leading-6">
          {item.success_criterion}
        </Typography>
      </Box>

      {item.technical_basis.length > 0 && (
        <Box className="flex flex-col gap-0.5">
          <Typography variant="subtitle2" className="text-text-secondary uppercase">
            {t("section-technical-basis")}
          </Typography>
          {item.technical_basis.map((basis, basisIndex) => (
            <Typography key={basisIndex} variant="body2" className="leading-6">
              {basis.rule} <span className="text-text-secondary">{basis.citation}</span>
            </Typography>
          ))}
        </Box>
      )}

      {/* Close the loop per finding: a fix nobody tracks teaches nothing.
          Offered only where there is something to do — an "ok" dimension is
          not work to schedule. */}
      {onRegisterFinding && item.status !== "ok" && (
        <Box>
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
        </Box>
      )}
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
            <Box component="ul" className="m-0 mt-1 flex flex-col gap-0.5 pl-4">
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

        {output.findings.map(finding)}

        {!output.insufficient_data && output.missing_data && (
          <>
            <Divider />
            <Box className="flex flex-col gap-0.5">
              <Typography variant="subtitle2" className="text-text-secondary uppercase">
                {t("section-missing")}
              </Typography>
              <Typography variant="body2" className="text-text-secondary leading-6">
                {output.missing_data}
              </Typography>
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

        {/* Same usefulness loop as the campaign diagnosis — a readiness verdict
            is a row in `diagnoses`, so it feeds the same engine-quality signal. */}
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
