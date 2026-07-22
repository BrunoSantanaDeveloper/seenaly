"use client";

import ReadinessChecklist from "./readiness-checklist";
import ReadinessScan, { type ScanView } from "./readiness-scan";
import ReadinessSignals from "./readiness-signals";
import { useTranslations } from "next-intl";

import { Box, Typography } from "@mui/material";

import SetupWizard, { type WizardStep } from "@/components/product/setup-wizard";
import { READINESS_GROUPS, type ReadinessEvaluation, type ReadinessProfile } from "@/lib/readiness/checklist";

/**
 * The guided readiness intake (docs/PRODUCT.md phase 7).
 *
 * Who: a beginner who just finished creating a product and is being carried
 * into the next step of the journey. Job: confirm what their structure already
 * has, one dimension at a time. Success: they reach a verdict without ever
 * hitting a wall of 21 checkboxes and three competing buttons.
 *
 * Reuses the SAME `SetupWizard` the product onboarding uses (the one the user
 * praised): one decision per screen, a progress rail, and "finish now" so the
 * remaining steps are opt-in. Each dimension is a step; an optional scan step
 * enriches; the final step shows the FREE deterministic blockers and the one
 * primary action — generate the verdict. Advanced options are never hidden:
 * every item is here, the scan is offered, and the user can finish at any step.
 */
export default function ReadinessWizard({
  profile,
  evaluation,
  onChange,
  scan,
  hasUrl,
  onScan,
  scanning,
  onComplete,
  busy,
  credit,
}: {
  profile: ReadinessProfile;
  evaluation: ReadinessEvaluation;
  onChange: (next: ReadinessProfile) => void;
  scan: ScanView | null;
  hasUrl: boolean;
  onScan: () => void;
  scanning: boolean;
  /** Generate the verdict (persists the profile first). */
  onComplete: () => void;
  busy: boolean;
  /** What the check costs and what the org has — shown before they commit. */
  credit: { balance: number; cost: number } | null;
}) {
  const t = useTranslations("readiness");
  /** Known-insufficient balance: explain it here AND block the doomed click. */
  const short = credit != null && credit.cost > 0 && credit.balance < credit.cost;

  const steps: WizardStep[] = [
    // One step per dimension — the "why" becomes the step hint, so the checklist
    // renders bare (no repeated header), exactly like product-form's fields.
    ...READINESS_GROUPS.map(
      (group): WizardStep => ({
        title: t(`group-${group.key}`),
        hint: t(`group-why-${group.key}`),
        content: (
          <ReadinessChecklist
            profile={profile}
            evaluation={evaluation}
            onChange={onChange}
            groupKeys={[group.key]}
            bare
            disabled={busy}
          />
        ),
        // Every dimension is optional — never block advancing on a blank one.
        canAdvance: !busy,
      }),
    ),
    // Optional enrichment: let us read the page instead of them self-reporting.
    {
      title: t("wizard-scan-title"),
      hint: t("wizard-scan-hint"),
      content: <ReadinessScan scan={scan} hasUrl={hasUrl} onScan={onScan} busy={scanning || busy} />,
      canAdvance: !busy,
    },
    // Review: the free blockers land here (real value before any credit spent),
    // and the single primary action generates the full verdict.
    {
      title: t("wizard-review-title"),
      hint: t("wizard-review-hint"),
      content: (
        <Box className="flex flex-col gap-3">
          <ReadinessSignals evaluation={evaluation} />
          <Typography variant="body2" className={short ? "text-warning" : "text-text-secondary"}>
            {!credit
              ? t("wizard-review-note")
              : short
                ? t("wizard-review-insufficient", { cost: credit.cost, balance: credit.balance })
                : t("wizard-review-cost", { cost: credit.cost, balance: credit.balance })}
          </Typography>
        </Box>
      ),
      // Don't let them click into a guaranteed failure — the line above and the
      // page-level notice explain the shortfall and link to billing.
      canAdvance: !busy && !short,
    },
  ];

  return (
    <SetupWizard
      steps={steps}
      onComplete={onComplete}
      onFinishEarly={onComplete}
      finishEarlyLabel={t("wizard-finish-early")}
      completeLabel={busy ? t("verifying") : t("see-verdict")}
      backLabel={t("wizard-back")}
      continueLabel={t("wizard-continue")}
      stepLabel={(current, total) => t("wizard-step", { current, total })}
      className="max-w-3xl"
    />
  );
}
