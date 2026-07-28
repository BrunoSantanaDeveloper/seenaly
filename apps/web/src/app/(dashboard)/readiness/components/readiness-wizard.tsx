"use client";

import type { AssistOffering } from "../actions";
import FunnelModelStep from "./funnel-model-step";
import ReadinessChecklist from "./readiness-checklist";
import ReadinessScan, { type ScanView } from "./readiness-scan";
import ReadinessSignals from "./readiness-signals";
import { useTranslations } from "next-intl";

import { Box, Button, Typography } from "@mui/material";

import SetupWizard, { type WizardStep } from "@/components/product/setup-wizard";
import type { AssistReason } from "@/lib/readiness/assist";
import {
  groupsForModel,
  READINESS_ITEM_KEYS,
  type ReadinessEvaluation,
  type ReadinessItemKey,
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
  assistOffering = null,
  assistOpenItems = [],
  scanAttempts = 0,
  creditBalance = null,
  onRequestAssist,
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
  /** Concierge plumbing — step one is where a beginner actually gives up. */
  assistOffering?: AssistOffering | null;
  assistOpenItems?: string[];
  scanAttempts?: number;
  creditBalance?: number | null;
  onRequestAssist?: (key: ReadinessItemKey, reason: AssistReason, note: string) => Promise<boolean>;
}) {
  const t = useTranslations("readiness");
  // Counted over what APPLIES to this funnel model — telling a direct-response
  // seller they are missing four trial-activation items they can never have
  // would be a permanent, false deficit.
  const applicable = new Set(READINESS_ITEM_KEYS.filter((key) => !evaluation.notApplicable.includes(key)));
  const confirmed = [...applicable].filter((key) => profile[key]).length;
  const missing = applicable.size - confirmed;
  /** Known-insufficient balance: explain it here AND block the doomed click. */
  const short = credit != null && credit.verdictCost > 0 && credit.balance < credit.verdictCost;

  const steps: WizardStep[] = [
    // Leads the wizard because it reframes every step after it: a trial-first
    // funnel keeps its checkout behind the login (unreachable by any scan, and
    // the ad optimizes the SIGNUP), and a lead-first one has no self-service
    // checkout at all. Auditing before knowing this audits the wrong surface.
    {
      title: t("funnel-model-title"),
      shortLabel: t("wizard-short-funnel-model"),
      hint: t("funnel-model-hint"),
      content: (
        <FunnelModelStep
          value={profile.funnelModel}
          onChange={(next) => onChange({ ...profile, funnelModel: next })}
          disabled={busy}
        />
      ),
      canAdvance: !busy,
    },
    // One step per dimension — the "why" becomes the step hint, so the checklist
    // renders bare (no repeated header), exactly like product-form's fields.
    // Only the groups this model actually has (activation is trial-first only).
    ...groupsForModel(profile.funnelModel).map(
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
            // Step one is exactly where the beginner stalls, so the teaching and
            // the evidence have to be right here, not behind the verdict.
            signals={scan?.ok ? scan.signals : null}
            scanUrl={scan?.finalUrl ?? scan?.requestedUrl ?? null}
            hasLandingPage={hasUrl}
            onVerifyNow={onScan}
            scanning={scanning}
            assistOffering={assistOffering}
            assistOpenItems={assistOpenItems}
            scanAttempts={scanAttempts}
            creditBalance={creditBalance}
            onRequestAssist={onRequestAssist}
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
      />
    </Box>
  );
}
