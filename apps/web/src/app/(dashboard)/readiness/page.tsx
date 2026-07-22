"use client";

import { type DiagnosisRating, recordDiagnosisFeedback } from "../diagnosis/actions";
import { registerExperimentFromReadinessFinding } from "../experiments/actions";
import { useOrganization } from "../settings/organization/components/use-organization";
import {
  generateFindingHowTo,
  generateReadiness,
  getReadinessCreditInfo,
  saveReadiness,
  scanProductSite,
} from "./actions";
import ReadinessChecklist from "./components/readiness-checklist";
import ReadinessScan, { type ScanView } from "./components/readiness-scan";
import ReadinessSignals from "./components/readiness-signals";
import ReadinessVerdict, { type HowToState, type ReadinessMeta } from "./components/readiness-verdict";
import ReadinessWizard from "./components/readiness-wizard";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert, Box, Breadcrumbs, Button, Grid, MenuItem, Skeleton, TextField, Typography } from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import ProcessingOverlay, { type ProcessingStage } from "@/components/product/processing-overlay";
import NiBook from "@/icons/nexture/ni-book";
import NiListCheck from "@/icons/nexture/ni-list-check";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiSearch from "@/icons/nexture/ni-search";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiSparkle from "@/icons/nexture/ni-sparkle";
import NiTag from "@/icons/nexture/ni-tag";
import { track } from "@/lib/analytics";
import {
  EMPTY_READINESS_PROFILE,
  evaluateReadiness,
  type ReadinessItemKey,
  type ReadinessProfile,
  toReadinessProfile,
} from "@/lib/readiness/checklist";
import type { ReadinessOutput } from "@/lib/readiness/schema";
import { createClient } from "@flyee/auth/client";

/**
 * Job: "is my structure ready to receive paid traffic without burning money,
 * and what do I fix first?" Success: the reader leaves knowing whether to spend
 * now and which single fix returns the most money.
 *
 * The screen is a verdict, not a form. The checklist below it is the input that
 * earns the verdict — and because the blocker list is computed locally, the
 * user sees real value the moment they tick a box, before spending any credit.
 */

type ProductRow = { id: string; name: string; landing_page_url: string | null; price: number | null };

type VerdictRow = {
  id: string;
  output: ReadinessOutput;
  created_at: string;
  knowledge_refs: { title: string; trust_level: number }[];
};

export default function ReadinessPage() {
  const t = useTranslations("readiness");
  const td = useTranslations("dashboard");
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedProductId = searchParams.get("product");
  // Arriving straight from product creation: greet, don't drop into a form wall.
  const isNew = searchParams.get("new") === "1";
  const { configured, loading, loadError, userId, orgs, currentOrg } = useOrganization();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [hasPlanPrice, setHasPlanPrice] = useState(false);
  const [profile, setProfile] = useState<ReadinessProfile>(EMPTY_READINESS_PROFILE);
  const [savedProfile, setSavedProfile] = useState<ReadinessProfile>(EMPTY_READINESS_PROFILE);
  const [rows, setRows] = useState<VerdictRow[]>([]);
  const [scan, setScan] = useState<ScanView | null>(null);
  const [scanning, setScanning] = useState(false);
  const [registeringIndex, setRegisteringIndex] = useState<number | null>(null);
  const [feedbackByVerdict, setFeedbackByVerdict] = useState<Record<string, DiagnosisRating>>({});
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cost + balance, so the user knows what a check spends BEFORE clicking and
  // never meets "insufficient credits" as a dead end.
  const [credit, setCredit] = useState<{ balance: number; cost: number } | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(false);
  const [howToByIndex, setHowToByIndex] = useState<Record<number, HowToState | undefined>>({});
  // The user ticked a fix as done AFTER this verdict was produced, so the
  // verdict on screen is now behind reality.
  const [staleVerdict, setStaleVerdict] = useState(false);

  const product = products.find((p) => p.id === selectedProductId) ?? null;
  const ready = productsLoaded && loaded;
  const dirty = useMemo(() => JSON.stringify(profile) !== JSON.stringify(savedProfile), [profile, savedProfile]);

  // Mirrors the server's context exactly — the two must never disagree about
  // whether a blocker exists (the brief tells the engine these are on screen).
  const evaluation = useMemo(
    () =>
      evaluateReadiness(profile, {
        hasLandingPage: Boolean(product?.landing_page_url),
        hasPrice: product?.price != null || hasPlanPrice,
      }),
    [profile, product, hasPlanPrice],
  );

  const loadProducts = useCallback(async () => {
    if (!currentOrg) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("id, name, landing_page_url, price")
      .eq("org_id", currentOrg.id)
      .order("updated_at", { ascending: false });
    const list = (data as ProductRow[]) ?? [];
    setProducts(list);
    setSelectedProductId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev;
      if (requestedProductId && list.some((p) => p.id === requestedProductId)) return requestedProductId;
      return list[0]?.id ?? null;
    });
    setProductsLoaded(true);
  }, [currentOrg, requestedProductId]);

  const loadReadiness = useCallback(async () => {
    if (!selectedProductId) {
      setRows([]);
      setProfile(EMPTY_READINESS_PROFILE);
      setSavedProfile(EMPTY_READINESS_PROFILE);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    const supabase = createClient();
    const [{ data: readinessRow }, { data: verdicts }, { data: plans }, { data: scanRow }] = await Promise.all([
      supabase.from("product_readiness").select("*").eq("product_id", selectedProductId).maybeSingle(),
      supabase
        .from("diagnoses")
        .select("id, output, created_at, knowledge_refs")
        .eq("product_id", selectedProductId)
        .eq("scope", "readiness")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("product_plans").select("price").eq("product_id", selectedProductId),
      supabase
        .from("product_scans")
        .select("requested_url, final_url, ok, status_code, error, result, created_at")
        .eq("product_id", selectedProductId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const next = toReadinessProfile(readinessRow as Record<string, unknown> | null);
    setProfile(next);
    setSavedProfile(next);
    const list = (verdicts as VerdictRow[]) ?? [];
    setRows(list);
    setHasPlanPrice(((plans as { price: number | null }[]) ?? []).some((plan) => plan.price != null));
    setScan(
      scanRow
        ? {
            requestedUrl: scanRow.requested_url as string,
            finalUrl: (scanRow.final_url as string | null) ?? null,
            ok: scanRow.ok === true,
            statusCode: (scanRow.status_code as number | null) ?? null,
            error: (scanRow.error as string | null) ?? null,
            createdAt: scanRow.created_at as string,
            signals: scanRow.ok === true ? (scanRow.result as ScanView["signals"]) : null,
          }
        : null,
    );

    setStaleVerdict(false);

    // Restore how-tos the org already PAID for — losing them on reload would
    // charge twice for the same answer.
    if (list[0]) {
      const { data: howtos } = await supabase
        .from("readiness_howtos")
        .select("finding_index, steps, sources")
        .eq("diagnosis_id", list[0].id);
      const map: Record<number, HowToState> = {};
      for (const row of (howtos ?? []) as {
        finding_index: number;
        steps: { steps?: string[]; needs_specialist?: boolean; note?: string };
        sources: { title: string; trust_level: number }[];
      }[]) {
        map[row.finding_index] = {
          howTo: {
            steps: Array.isArray(row.steps?.steps) ? row.steps.steps : [],
            needs_specialist: row.steps?.needs_specialist === true,
            note: typeof row.steps?.note === "string" ? row.steps.note : "",
          },
          sources: row.sources ?? [],
        };
      }
      setHowToByIndex(map);
    } else {
      setHowToByIndex({});
    }

    // This user's own ratings, to render the active choice.
    if (list.length > 0 && userId) {
      const { data: fb } = await supabase
        .from("diagnosis_feedback")
        .select("diagnosis_id, rating")
        .eq("user_id", userId)
        .in(
          "diagnosis_id",
          list.map((r) => r.id),
        );
      const map: Record<string, DiagnosisRating> = {};
      for (const entry of (fb as { diagnosis_id: string; rating: DiagnosisRating }[]) ?? []) {
        map[entry.diagnosis_id] = entry.rating;
      }
      setFeedbackByVerdict(map);
    } else {
      setFeedbackByVerdict({});
    }
    setLoaded(true);
  }, [selectedProductId, userId]);

  const submitFeedback = async (verdictId: string, rating: DiagnosisRating) => {
    if (!currentOrg) return;
    const previous = feedbackByVerdict[verdictId];
    setFeedbackByVerdict((prev) => ({ ...prev, [verdictId]: rating })); // optimistic
    setFeedbackBusy(true);
    const result = await recordDiagnosisFeedback(currentOrg.id, verdictId, rating);
    setFeedbackBusy(false);
    if (result.ok) {
      track("feedback_recorded", { rating, scope: "readiness" });
      return;
    }
    setFeedbackByVerdict((prev) => {
      const next = { ...prev };
      if (previous) next[verdictId] = previous;
      else delete next[verdictId];
      return next;
    });
    setError(result.error);
  };

  const loadCredit = useCallback(async () => {
    if (!currentOrg) return;
    const info = await getReadinessCreditInfo(currentOrg.id);
    if (info.ok) setCredit({ balance: info.balance, cost: info.cost });
  }, [currentOrg]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadCredit();
  }, [loadCredit]);

  useEffect(() => {
    loadReadiness();
  }, [loadReadiness]);

  // Takes the profile explicitly: "mark as resolved" saves immediately, and
  // reading `profile` from the closure would persist the pre-tick state.
  const persist = async (next: ReadinessProfile = profile) => {
    if (!selectedProductId) return false;
    const result = await saveReadiness(selectedProductId, next);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setSavedProfile(next);
    return true;
  };

  /**
   * "I already fixed this" ticks the checklist items the finding is about.
   * Free and instant: the deterministic blockers recompute on the spot, which
   * is the whole point — re-validating must not require regenerating a verdict.
   */
  const resolveItems = async (items: ReadinessItemKey[], resolved: boolean) => {
    setError(null);
    const next = { ...profile };
    for (const key of items) next[key] = resolved;
    setProfile(next);
    setStaleVerdict(true);
    track("readiness_finding_resolved", { resolved, items: items.length });
    await persist(next);
  };

  const requestHowTo = async (findingIndex: number) => {
    if (!latest) return;
    setError(null);
    setHowToByIndex((prev) => ({ ...prev, [findingIndex]: "loading" }));
    const result = await generateFindingHowTo(latest.id, findingIndex);
    if (!result.ok) {
      setHowToByIndex((prev) => {
        const next = { ...prev };
        delete next[findingIndex];
        return next;
      });
      if (result.code === "insufficient_credits") {
        setOutOfCredits(true);
        return;
      }
      setError(result.error);
      return;
    }
    setHowToByIndex((prev) => ({ ...prev, [findingIndex]: { howTo: result.howTo, sources: result.sources } }));
    track("readiness_howto", { cached: result.cached, steps: result.howTo.steps.length });
    if (!result.cached) loadCredit();
  };

  // A fix the user intends to make becomes a tracked experiment, so the
  // learning survives — same loop as the campaign diagnosis.
  const registerFinding = async (findingIndex: number) => {
    if (!latest) return;
    setError(null);
    setRegisteringIndex(findingIndex);
    try {
      const result = await registerExperimentFromReadinessFinding(latest.id, findingIndex);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      track("experiment_registered", { from: "readiness" });
      router.push(`/experiments/${result.id}`);
    } finally {
      setRegisteringIndex(null);
    }
  };

  /**
   * Pull ONLY the latest scan row. Calling the full `loadReadiness()` here was
   * a real bug: it flips `loaded` to false (unmounting the wizard, which resets
   * its internal step index to 1) and overwrites `profile` from the database,
   * wiping every box the user had just ticked but not yet saved.
   */
  const refreshScan = useCallback(async () => {
    if (!selectedProductId) return;
    const supabase = createClient();
    const { data: scanRow } = await supabase
      .from("product_scans")
      .select("requested_url, final_url, ok, status_code, error, result, created_at")
      .eq("product_id", selectedProductId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setScan(
      scanRow
        ? {
            requestedUrl: scanRow.requested_url as string,
            finalUrl: (scanRow.final_url as string | null) ?? null,
            ok: scanRow.ok === true,
            statusCode: (scanRow.status_code as number | null) ?? null,
            error: (scanRow.error as string | null) ?? null,
            createdAt: scanRow.created_at as string,
            signals: scanRow.ok === true ? (scanRow.result as ScanView["signals"]) : null,
          }
        : null,
    );
  }, [selectedProductId]);

  const runScan = async () => {
    if (!selectedProductId) return;
    setError(null);
    setScanning(true);
    try {
      // Persist first: the user is mid-wizard with unsaved ticks, and a scan
      // is a good moment to make them durable.
      if (dirty) await persist();
      const result = await scanProductSite(selectedProductId);
      // A site that did not answer is a recorded outcome the card explains —
      // only "we could not even try" surfaces as an error.
      if (!result.ok) {
        setError(result.error);
        return;
      }
      track("readiness_scanned", { reachable: result.scanned });
      await refreshScan();
    } finally {
      setScanning(false);
    }
  };

  // One goal-first action: the declared structure is saved as part of asking
  // for the verdict, so the user never has to remember a separate save.
  const verify = async () => {
    if (!selectedProductId) return;
    setError(null);
    setOutOfCredits(false);
    setBusy(true);
    try {
      if (dirty && !(await persist())) return;
      const result = await generateReadiness(selectedProductId);
      if (!result.ok) {
        // Running out of credits is not a failure to apologise for — it is a
        // state with a way out. Render it as guidance, not a red error.
        if (result.code === "insufficient_credits") {
          setCredit({ balance: result.balance ?? 0, cost: result.cost ?? 0 });
          setOutOfCredits(true);
          return;
        }
        setError(result.error);
        return;
      }
      track("readiness_generated");
      await Promise.all([loadReadiness(), loadCredit()]);
    } finally {
      setBusy(false);
    }
  };

  const latest = rows[0];
  const history = rows.slice(1);

  /**
   * "What would firm up the verdict" as ACTIONS, not prose.
   *
   * Derived from state we can actually observe — no scan on file, unconfirmed
   * checklist items, missing price/page — so every button is guaranteed to be
   * a real gap. The model's `missing_data` stays as the "why" above them.
   */
  const firmUpActions = product ? (
    <Box className="flex flex-row flex-wrap gap-2">
      {!scan?.ok && product.landing_page_url && (
        <Button variant="outlined" color="grey" size="small" onClick={runScan} disabled={scanning || busy}>
          {scanning ? t("scanning") : t("firm-run-scan")}
        </Button>
      )}
      {evaluation.confirmed < evaluation.total && (
        <Button
          variant="outlined"
          color="grey"
          size="small"
          onClick={() => document.getElementById("readiness-checklist")?.scrollIntoView({ behavior: "smooth" })}
        >
          {t("firm-review-checklist", { remaining: evaluation.total - evaluation.confirmed })}
        </Button>
      )}
      {(!product.landing_page_url || product.price == null) && (
        <Button variant="outlined" color="grey" size="small" href={`/products/${product.id}`} LinkComponent={Link}>
          {t("firm-complete-product")}
        </Button>
      )}
    </Box>
  ) : null;

  // The REAL steps generateReadiness() performs, in order. The scan step is
  // omitted when there is no scan — narrating work we aren't doing would be the
  // same dishonesty as a fake progress bar.
  const stages: ProcessingStage[] = useMemo(() => {
    const list: (ProcessingStage | null)[] = [
      { icon: <NiTag />, label: t("stage-context") },
      { icon: <NiListCheck />, label: t("stage-checklist") },
      scan?.ok ? { icon: <NiSearch />, label: t("stage-scan") } : null,
      { icon: <NiBook />, label: t("stage-knowledge") },
      { icon: <NiPulse />, label: t("stage-leverage") },
      { icon: <NiSparkle />, label: t("stage-writing") },
    ];
    return list.filter((s): s is ProcessingStage => s !== null);
  }, [scan?.ok, t]);

  // The result view's primary action. First-run has no verify button here —
  // the guided wizard owns that action, so nothing competes with it.
  const reVerifyButton = (
    <Button
      variant="contained"
      startIcon={<NiShieldCheck size="small" />}
      onClick={verify}
      disabled={busy || scanning || !product || (credit != null && credit.cost > 0 && credit.balance < credit.cost)}
    >
      {busy ? t("verifying") : t("verify-again")}
    </Button>
  );

  return (
    <Grid container spacing={5} className="items-start">
      {/* Covers both entry points into generation: finishing the guided wizard
          and re-verifying from the result view. */}
      <ProcessingOverlay open={busy} title={t("verifying")} stages={stages} patienceLabel={t("stage-patience")} />
      <Grid size={"grow"} spacing={5} container>
        <Grid size={12} spacing={2.5} container className="items-center">
          <Grid size={{ xs: 12, md: "grow" }}>
            <Typography variant="h1" component="h1" className="mb-0">
              {t("title")}
            </Typography>
            <Breadcrumbs>
              <Link color="inherit" href="/home">
                {t("crumb-home")}
              </Link>
              <Typography variant="body2">{t("title")}</Typography>
            </Breadcrumbs>
          </Grid>
          {products.length > 1 && ready && (
            <Grid size={{ xs: 12, md: "auto" }}>
              <TextField
                select
                size="small"
                label={t("select-product")}
                value={selectedProductId ?? ""}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="min-w-56"
              >
                {products.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
        </Grid>

        {!configured && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("not-configured")}
            </Alert>
          </Grid>
        )}

        {configured && loadError && (
          <Grid size={12}>
            <Alert severity="error" className="neutral bg-background-paper/60!">
              {td("org-load-error")}
            </Alert>
          </Grid>
        )}

        {configured && !loading && !loadError && orgs.length === 0 && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("no-org")}
            </Alert>
          </Grid>
        )}

        {configured && (loading || (currentOrg && !ready)) && (
          <Grid size={12}>
            <Skeleton variant="rounded" height={320} />
          </Grid>
        )}

        {/* No product context: readiness has nothing to audit. */}
        {currentOrg && ready && !product && (
          <Grid size={12}>
            <EmptyState
              icon={<NiTag />}
              title={t("no-product-title")}
              description={t("no-product-body")}
              action={{ label: t("no-product-cta"), href: "/products/new" }}
            />
          </Grid>
        )}

        {error && (
          <Grid size={12}>
            <Alert severity="error" className="neutral bg-background-paper/60!">
              {error}
            </Alert>
          </Grid>
        )}

        {/* Out of credits: say the numbers and give the way out. A bare
            "insufficient credits" leaves the user with no idea what they have,
            what it costs, or how to fix it. */}
        {(outOfCredits || (credit != null && credit.cost > 0 && credit.balance < credit.cost)) && (
          <Grid size={12}>
            <Alert severity="warning" className="neutral bg-background-paper/60!">
              <Typography variant="subtitle2">{t("credits-out-title")}</Typography>
              <Typography variant="body2">
                {t("credits-out-body", { balance: credit?.balance ?? 0, cost: credit?.cost ?? 0 })}
              </Typography>
              <Button
                variant="outlined"
                color="grey"
                size="small"
                className="mt-2"
                href="/settings/billing"
                LinkComponent={Link}
              >
                {t("credits-manage")}
              </Button>
            </Alert>
          </Grid>
        )}

        {/* FIRST RUN (no verdict): the guided flow. One dimension per step,
            options to tick, a progress rail, ending in the free blockers + one
            primary action — never a wall of 21 checkboxes and rival buttons. */}
        {product && ready && !latest && (
          <>
            <Grid size={12}>
              <Alert
                severity={isNew ? "success" : "info"}
                icon={<NiShieldCheck size="small" />}
                className="neutral bg-background-paper/60!"
              >
                <Typography variant="subtitle2">{isNew ? t("welcome-title") : t("intro-title")}</Typography>
                <Typography variant="body2">{isNew ? t("welcome-body") : t("intro-body")}</Typography>
              </Alert>
            </Grid>
            <Grid size={12}>
              <ReadinessWizard
                profile={profile}
                evaluation={evaluation}
                onChange={setProfile}
                scan={scan}
                hasUrl={Boolean(product.landing_page_url)}
                onScan={runScan}
                scanning={scanning}
                onComplete={verify}
                busy={busy}
                credit={credit}
              />
            </Grid>
          </>
        )}

        {/* HAS A VERDICT: the result leads. Moving to the diagnosis is the
            forward action; adjusting the answers and re-verifying is secondary
            and lives with the checklist it depends on. */}
        {product && ready && latest && (
          <>
            <Grid size={12}>
              <ReadinessVerdict
                output={latest.output}
                meta={
                  {
                    createdAt: latest.created_at,
                    knowledgeRefs: latest.knowledge_refs ?? [],
                  } satisfies ReadinessMeta
                }
                feedback={feedbackByVerdict[latest.id] ?? null}
                onFeedback={(rating) => submitFeedback(latest.id, rating)}
                feedbackBusy={feedbackBusy}
                onRegisterFinding={registerFinding}
                registeringIndex={registeringIndex}
                profile={profile}
                onResolve={resolveItems}
                howToByIndex={howToByIndex}
                onHowTo={requestHowTo}
                firmUpActions={firmUpActions}
              />

              {/* Ticking a fix makes the verdict on screen older than reality —
                  offer the cheap re-check right where the change happened. */}
              {staleVerdict && (
                <Alert severity="info" className="neutral bg-background-paper/60! mt-3">
                  <Typography variant="body2">{t("stale-verdict")}</Typography>
                </Alert>
              )}

              <Box className="mt-3 flex flex-row flex-wrap gap-2">
                {/* Readiness cleared the way — the diagnosis is the next room. */}
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<NiPulse size="small" />}
                  onClick={() => router.push(`/diagnosis?product=${product.id}`)}
                >
                  {t("go-to-diagnosis")}
                </Button>
              </Box>
            </Grid>

            <Grid size={12}>
              <Box className="flex flex-col gap-0.5">
                <Typography variant="h5" component="h2" className="mb-0">
                  {t("adjust-title")}
                </Typography>
                <Typography variant="body2" className="text-text-secondary">
                  {t("adjust-body")}
                </Typography>
              </Box>
            </Grid>
            <Grid size={12}>
              <ReadinessSignals evaluation={evaluation} />
            </Grid>
            <Grid size={12}>
              <ReadinessScan
                scan={scan}
                hasUrl={Boolean(product.landing_page_url)}
                onScan={runScan}
                busy={scanning || busy}
              />
            </Grid>
            <Grid size={12} id="readiness-checklist">
              <ReadinessChecklist
                profile={profile}
                evaluation={evaluation}
                onChange={setProfile}
                disabled={busy || scanning}
              />
              <Box className="mt-3 flex flex-row flex-wrap items-center gap-2">
                {reVerifyButton}
                {dirty && (
                  <Typography variant="body2" className="text-text-secondary">
                    {t("reverify-hint")}
                  </Typography>
                )}
              </Box>
            </Grid>
          </>
        )}

        {history.length > 0 && (
          <Grid size={12}>
            <Typography variant="h5" component="h2" className="mb-3">
              {t("history-title")}
            </Typography>
            <Box className="flex flex-col gap-2">
              {history.map((row) => (
                <Box key={row.id} className="border-grey-50 flex flex-col gap-0.5 border-b pb-2">
                  <Typography variant="body2" className="text-text-secondary">
                    {new Date(row.created_at).toLocaleString()} · {t(`verdict-${row.output.verdict}`)}
                  </Typography>
                  <Typography variant="body2" className="line-clamp-2">
                    {row.output.summary}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}
