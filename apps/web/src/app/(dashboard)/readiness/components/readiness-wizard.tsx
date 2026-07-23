"use client";

import ReadinessChecklist from "./readiness-checklist";
import ReadinessScan, { type ScanView } from "./readiness-scan";
import ReadinessSignals from "./readiness-signals";
import { useTranslations } from "next-intl";

import { Box, Button, Typography } from "@mui/material";

import SetupWizard, { type WizardStep } from "@/components/product/setup-wizard";
import {
  READINESS_GROUPS,
  READINESS_ITEM_KEYS,
  type ReadinessEvaluation,
  type ReadinessProfile,
} from "@/lib/readiness/checklist";

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
  saveState,
  onRetrySave,
  onBeforeAdvance,
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
  credit: { balance: number; verdictCost: number; howToCost: number } | null;
  saveState: "idle" | "saving" | "saved" | "error";
  onRetrySave: () => void;
  onBeforeAdvance: () => Promise<boolean>;
}) {
  const t = useTranslations("readiness");
  const confirmed = READINESS_ITEM_KEYS.filter((key) => profile[key]).length;
  const missing = READINESS_ITEM_KEYS.length - confirmed;
  /** Known-insufficient balance: explain it here AND block the doomed click. */
  const short = credit != null && credit.verdictCost > 0 && credit.balance < credit.verdictCost;

  const steps: WizardStep[] = [
    // One step per dimension — the "why" becomes the step hint, so the checklist
    // renders bare (no repeated header), exactly like product-form's fields.
    ...READINESS_GROUPS.map(
      (group): WizardStep => ({
        title: t(`group-${group.key}`),
        shortLabel: t(`wizard-short-${group.key}`),
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
      shortLabel: t("wizard-short-scan"),
      hint: t("wizard-scan-hint"),
      content: <ReadinessScan scan={scan} hasUrl={hasUrl} onScan={onScan} busy={scanning || busy} />,
      canAdvance: !busy,
    },
    // Review: the free blockers land here (real value before any credit spent),
    // and the single primary action generates the full verdict.
    {
      title: t("wizard-review-title"),
      shortLabel: t("wizard-short-review"),
      hint: t("wizard-review-hint"),
      content: (
        <Box className="flex flex-col gap-3">
          <ReadinessSignals evaluation={evaluation} />
          <Typography variant="body2" className={short ? "text-warning" : "text-text-secondary"}>
            {!credit
              ? t("wizard-review-note")
              : short
                ? t("wizard-review-insufficient", {
                    cost: credit.verdictCost,
                    balance: credit.balance,
                  })
                : t("wizard-review-cost", {
                    cost: credit.verdictCost,
                    balance: credit.balance,
                  })}
          </Typography>
        </Box>
      ),
      // Don't let them click into a guaranteed failure — the line above and the
      // page-level notice explain the shortfall and link to billing.
      canAdvance: !busy && !short,
    },
  ];

  return (
    <Box className="flex flex-col gap-2">
      <Box className="flex min-h-6 flex-wrap items-center justify-between gap-2" aria-live="polite">
        <Typography variant="body2" className="text-text-secondary">
          {t("wizard-confirmed", { confirmed, missing })}
        </Typography>
        <Typography variant="body2" className={saveState === "error" ? "text-error" : "text-text-secondary"}>
          {t(`save-${saveState}`)}
        </Typography>
        {saveState === "error" && (
          <Button type="button" variant="text" size="small" onClick={onRetrySave}>
            {t("retry")}
          </Button>
        )}
      </Box>
      <SetupWizard
        steps={steps}
        onComplete={onComplete}
        onBeforeAdvance={onBeforeAdvance}
        onFinishEarly={onComplete}
        finishEarlyLabel={t("wizard-finish-early")}
        completeLabel={busy ? t("verifying") : t("see-verdict")}
        backLabel={t("wizard-back")}
        continueLabel={t("wizard-continue")}
        nextStepLabel={t("wizard-next")}
        stepLabel={(current, total) => t("wizard-step", { current, total })}
        className="max-w-3xl"
      />
    </Box>
  );
}
