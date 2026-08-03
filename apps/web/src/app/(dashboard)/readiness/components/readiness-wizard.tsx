"use client";

import type { AssistOffering } from "../actions";
import FunnelModelStep from "./funnel-model-step";
import ReadinessChecklist from "./readiness-checklist";
import ReadinessScan, { type ScanTrendEntry, type ScanView } from "./readiness-scan";
import ReadinessSignals from "./readiness-signals";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Box, Button, Collapse, Typography } from "@mui/material";

import SetupWizard, { type WizardStep } from "@/components/product/setup-wizard";
import NiExclamationHexagon from "@/icons/nexture/ni-exclamation-hexagon";
import type { AssistReason } from "@/lib/readiness/assist";
import {
  groupForItem,
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
  productId,
  profile,
  evaluation,
  onChange,
  scan,
  hasUrl,
  onScan,
  onRefreshScan,
  scanTrend,
  scanning,
  onComplete,
  busy,
  credit,
  canGenerate = true,
  saveState,
  onRetrySave,
  onBeforeAdvance,
  assistOffering = null,
  assistOpenItems = [],
  skippedItems = [],
  helpOpenedItems = [],
  onJourneySignal,
  scanAttempts = 0,
  creditBalance = null,
  onRequestAssist,
  bare = false,
  initialFocus = null,
}: {
  /** Scopes the resume-position storage — the cursor is per product. */
  productId: string;
  profile: ReadinessProfile;
  evaluation: ReadinessEvaluation;
  onChange: (next: ReadinessProfile) => void;
  scan: ScanView | null;
  hasUrl: boolean;
  onScan: () => void;
  /** Refresh the persisted scan row (pending speed measurement) — no new read. */
  onRefreshScan?: () => void;
  /** Oldest→newest proved-count series for the scan card. */
  scanTrend?: ScanTrendEntry[];
  scanning: boolean;
  /** Generate the verdict (persists the profile first). */
  onComplete: () => void;
  busy: boolean;
  /** What the check costs and what the org has — shown before they commit. */
  credit: { balance: number; verdictCost: number; howToCost: number } | null;
  /**
   * The ONE derived generate-gate (owned by the page, U4): finish-early on any
   * step and the final step must never disagree about whether generating is
   * possible. Defaults permissive — the server re-checks anyway.
   */
  canGenerate?: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  onRetrySave: () => void;
  onBeforeAdvance: () => Promise<boolean>;
  /** Concierge plumbing — step one is where a beginner actually gives up. */
  assistOffering?: AssistOffering | null;
  assistOpenItems?: string[];
  /** Durable resistance signals (U5) — survive step changes and reloads. */
  skippedItems?: ReadinessItemKey[];
  helpOpenedItems?: ReadinessItemKey[];
  onJourneySignal?: (kind: "skipped" | "helpOpened", key: ReadinessItemKey) => void;
  scanAttempts?: number;
  creditBalance?: number | null;
  onRequestAssist?: (key: ReadinessItemKey, reason: AssistReason, note: string) => Promise<boolean>;
  /** Inside the review Dialog the surface is already a card — drop the shell. */
  bare?: boolean;
  /**
   * Open at ONE item's teaching panel (U7): jumps to the item's dimension
   * step and expands its help. Overrides the stored resume position.
   */
  initialFocus?: { itemKey: ReadinessItemKey; nonce: number } | null;
}) {
  const t = useTranslations("readiness");
  // Resume where they left off — per device, per product. The durable progress
  // is the profile itself (server-persisted); this is only the cursor, so
  // localStorage (the `seenaly:last-product` convention) is the right home.
  const stepStorageKey = `seenaly:readiness-step:${productId}`;
  const storedStep = typeof window === "undefined" ? 0 : Number(window.localStorage.getItem(stepStorageKey) ?? 0) || 0;
  // U7: a focused item lands on its dimension's step (steps = funnel-model,
  // scan, ...groups, review ⇒ index = 2 + group position). Overrides the
  // stored resume position; a group this model lacks (-1) falls back to it.
  const focusGroupKey = initialFocus ? groupForItem(initialFocus.itemKey) : null;
  const focusGroupPosition = focusGroupKey
    ? groupsForModel(profile.funnelModel).findIndex((group) => group.key === focusGroupKey)
    : -1;
  const focusStep = focusGroupPosition >= 0 ? 2 + focusGroupPosition : null;
  // Counted over what APPLIES to this funnel model — telling a direct-response
  // seller they are missing four trial-activation items they can never have
  // would be a permanent, false deficit.
  const applicable = new Set(READINESS_ITEM_KEYS.filter((key) => !evaluation.notApplicable.includes(key)));
  const confirmed = [...applicable].filter((key) => profile[key]).length;
  const missing = applicable.size - confirmed;
  // The header promises the blockers "aparecem na hora, de graça" — and until
  // now they appeared only on the last step. The free half of this layer is
  // also its motivation engine: a beginner who sees a real, named problem
  // surface the moment they answer keeps answering. The review step owns the
  // full panel, so this compact one stands down there to avoid saying it twice.
  // Seeded from the SAME position the wizard mounts at: `onStepChange` only
  // fires on a change, so starting at 0 would show this panel on top of the
  // review step's full one for anyone resuming at the end.
  const [stepIndex, setStepIndex] = useState<number>(focusStep ?? storedStep);
  const liveBlockers = evaluation.blockers;

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
      // The ONE answer that reframes every step after it, so it is the one
      // answer that cannot be skipped by inertia. Blank used to mean "venda
      // direta" silently — a SaaS was audited against a public checkout it does
      // not have. The escape is inside the step ("não sei" → direct, with the
      // consequence written on it), so this blocks a non-answer, never a user.
      canAdvance: !busy && profile.funnelModel !== null,
    },
    // Reading the page comes BEFORE the questions, not after: asking someone to
    // declare a pixel we can see for ourselves is redundant work AND an
    // invitation to answer wrong. What the read PROVES is confirmed here and
    // never asked again (`autoConfirmProven` in experience.tsx).
    //
    // It settles 6 of the 25 items at most — CAPI is server-side, checkout and
    // activation live behind the login, funnel and organic are not on the page
    // — so the questions that follow are the ones no page read could answer.
    {
      title: t("wizard-scan-title"),
      shortLabel: t("wizard-short-scan"),
      hint: t("wizard-scan-hint"),
      content: (
        <ReadinessScan
          scan={scan}
          hasUrl={hasUrl}
          onScan={onScan}
          busy={scanning || busy}
          onRefresh={onRefreshScan}
          productId={productId}
          trend={scanTrend}
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
        // The checkout step's "why" has to follow the declared model, exactly
        // as the engine's briefing already does. Saying "o último metro antes
        // de o dinheiro entrar" to a trial-first business describes a public
        // checkout it does not have — the user then answers about the wrong
        // surface and the engine audits the upgrade flow with those answers.
        hint:
          group.key === "checkout" && profile.funnelModel && profile.funnelModel !== "direct"
            ? t(`group-why-checkout-${profile.funnelModel}`)
            : t(`group-why-${group.key}`),
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
            skippedItems={skippedItems}
            helpOpenedItems={helpOpenedItems}
            onJourneySignal={onJourneySignal}
            scanAttempts={scanAttempts}
            creditBalance={creditBalance}
            onRequestAssist={onRequestAssist}
            focusItemKey={focusGroupKey === group.key && initialFocus ? initialFocus : null}
          />
        ),
        // Every dimension is optional — never block advancing on a blank one.
        canAdvance: !busy,
      }),
    ),
    // Review: the free blockers land here (real value before any credit spent),
    // and the single primary action generates the full verdict.
    {
      title: t("wizard-review-title"),
      shortLabel: t("wizard-short-review"),
      hint: t("wizard-review-hint"),
      content: (
        <Box className="flex flex-col gap-3">
          <ReadinessSignals evaluation={evaluation} productId={productId} />
          <Typography variant="body2" className={!canGenerate ? "text-warning" : "text-text-secondary"}>
            {!credit
              ? t("wizard-review-note")
              : !canGenerate
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
      // in-wizard banner explain the shortfall and link to billing.
      canAdvance: !busy && canGenerate,
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
      {/* Visible on EVERY step (U4) — it explains why the finish-early
          shortcut is absent, and it is reachable inside the review Dialog,
          which used to cover the page-level billing CTA entirely. */}
      {!canGenerate && credit && (
        <Box className="flex flex-row flex-wrap items-center gap-2">
          <Typography variant="body2" className="text-warning">
            {t("wizard-review-insufficient", { cost: credit.verdictCost, balance: credit.balance })}
          </Typography>
          <Button size="small" variant="outlined" color="grey" href="/settings/billing" LinkComponent={Link}>
            {t("credits-manage")}
          </Button>
        </Box>
      )}
      {/* Live, free, deterministic — recomputed as they tick, never an LLM
          call. Hidden on the review step, which renders the full panel with
          the fix doors. */}
      <Collapse in={liveBlockers.length > 0 && stepIndex < steps.length - 1} unmountOnExit>
        <Box className="MuiPaper-outlined MuiPaper-rounded flex flex-row items-start gap-3 rounded-lg p-3">
          <NiExclamationHexagon size="small" className="text-error mt-0.5 flex-none" aria-hidden />
          <Box className="min-w-0">
            <Typography variant="subtitle2" component="h3" className="mb-0.5">
              {t("blockers-title", { count: liveBlockers.length })}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("blockers-live-hint")}
            </Typography>
          </Box>
        </Box>
      </Collapse>
      <SetupWizard
        steps={steps}
        onComplete={() => {
          // A generated verdict retires the resume point — next time the
          // wizard opens it should start from the top, not mid-journey.
          window.localStorage.removeItem(stepStorageKey);
          onComplete();
        }}
        onBeforeAdvance={onBeforeAdvance}
        onFinishEarly={onComplete}
        initialStep={focusStep ?? storedStep}
        onStepChange={(index) => {
          setStepIndex(index);
          window.localStorage.setItem(stepStorageKey, String(index));
        }}
        // Safe here ONLY because every readiness step is order-independent and
        // the profile autosaves continuously (a rail jump skips onBeforeAdvance).
        //
        // Held back until the funnel model is declared, for two reasons that
        // point the same way: a jump would re-open the silent default the step
        // gate just closed, and the path itself is not settled yet — without a
        // model the rail shows 8 steps that become 9 the moment "trial" is
        // picked, so the target of a jump would shift under the user.
        navigableRail={profile.funnelModel !== null}
        jumpLabel={(title) => t("wizard-jump-to", { step: title })}
        finishEarlyLabel={t("wizard-finish-early")}
        // "Gerar com o que já confirmei" has to be TRUE when it is offered.
        // With nothing confirmed it would spend credits on a verdict made of
        // missing data and teach a beginner the product has nothing to say.
        // Picking a funnel model is not a confirmation, so it does not count —
        // the shortcut simply waits until there is something to generate FROM,
        // which the page read usually supplies on step two. Nothing is gated:
        // the free blockers keep updating live and the final step always
        // offers the full verdict. `canGenerate` keeps this shortcut honest on
        // EVERY step — it used to check balance only on the last one (U4).
        canFinishEarly={confirmed > 0 && canGenerate}
        completeLabel={busy ? t("verifying") : t("see-verdict")}
        backLabel={t("wizard-back")}
        continueLabel={t("wizard-continue")}
        nextStepLabel={t("wizard-next")}
        stepLabel={(current, total) => t("wizard-step", { current, total })}
        bare={bare}
      />
    </Box>
  );
}
