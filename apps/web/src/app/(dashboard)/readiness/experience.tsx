"use client";

import { type DiagnosisRating, recordDiagnosisFeedback } from "../diagnosis/actions";
import { registerExperimentFromReadinessFinding } from "../experiments/actions";
import { useOrganization } from "../settings/organization/components/use-organization";
import {
  type AssistOffering,
  generateFindingHowTo,
  generateReadiness,
  getAssistInfo,
  getReadinessCreditInfo,
  requestAssist,
  saveReadiness,
  scanProductSite,
} from "./actions";
import { type ScanView } from "./components/readiness-scan";
import ReadinessVerdict, { type HowToState, type ReadinessMeta } from "./components/readiness-verdict";
import ReadinessWizard from "./components/readiness-wizard";
import VerifiedCelebration from "./components/verified-celebration";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Skeleton,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import LoadErrorState from "@/components/product/load-error-state";
import ProcessingOverlay, { type ProcessingStage } from "@/components/product/processing-overlay";
import NiBook from "@/icons/nexture/ni-book";
import NiCross from "@/icons/nexture/ni-cross";
import NiListCheck from "@/icons/nexture/ni-list-check";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiSearch from "@/icons/nexture/ni-search";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiSparkle from "@/icons/nexture/ni-sparkle";
import NiTag from "@/icons/nexture/ni-tag";
import { track } from "@/lib/analytics";
import {
  autoConfirmProven,
  EMPTY_READINESS_PROFILE,
  evaluateReadiness,
  observeItem,
  READINESS_ITEM_KEYS,
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

export function ReadinessExperience({
  forcedProductId,
  workspace = false,
}: {
  forcedProductId?: string;
  workspace?: boolean;
} = {}) {
  const t = useTranslations("readiness");
  const tc = useTranslations("productCommon");
  const td = useTranslations("dashboard");
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedProductId = forcedProductId ?? searchParams.get("product");
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
  const [registeredByIndex, setRegisteredByIndex] = useState<Record<number, string>>({});
  const [feedbackByVerdict, setFeedbackByVerdict] = useState<Record<string, DiagnosisRating>>({});
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataLoadError, setDataLoadError] = useState(false);
  // Cost + balance, so the user knows what a check spends BEFORE clicking and
  // never meets "insufficient credits" as a dead end.
  const [credit, setCredit] = useState<{
    balance: number;
    verdictCost: number;
    howToCost: number;
  } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [outOfCredits, setOutOfCredits] = useState(false);
  const [howToByIndex, setHowToByIndex] = useState<Record<number, HowToState | undefined>>({});
  // The user ticked a fix as done AFTER this verdict was produced, so the
  // verdict on screen is now behind reality.
  const [staleVerdict, setStaleVerdict] = useState(false);
  // Names of items a "mark as fixed" tried to tick but the page scan disproves.
  const [resolveRefused, setResolveRefused] = useState<string | null>(null);
  // The instant the scan PROVES a new item, celebrate it by name — machine
  // verified, so it cannot be faked (see verified-celebration.tsx).
  const [justVerified, setJustVerified] = useState<ReadinessItemKey[]>([]);
  const [celebrateOpen, setCelebrateOpen] = useState(false);
  // The concierge: catalog price + which items already have an open request, so
  // the same session is never sold twice.
  const [assistOffering, setAssistOffering] = useState<AssistOffering | null>(null);
  const [assistOpenItems, setAssistOpenItems] = useState<string[]>([]);
  // How many times this page has been read — a second failed proof is what
  // separates real resistance from a first attempt.
  const [scanAttempts, setScanAttempts] = useState(0);
  const verifiedRef = useRef<Set<ReadinessItemKey>>(new Set());
  const verifiedSeededRef = useRef(false);
  // Checklist + scan live in a modal now, off the main result scroll.
  const [reviewOpen, setReviewOpen] = useState(false);
  const fullScreenDialog = useMediaQuery("(max-width:640px)");

  const product = products.find((p) => p.id === selectedProductId) ?? null;
  const ready = productsLoaded && loaded;
  const canShowProductData = !dataLoadError || Boolean(product && loaded);
  const dirty = useMemo(() => JSON.stringify(profile) !== JSON.stringify(savedProfile), [profile, savedProfile]);

  // Mirrors the server's context exactly — the two must never disagree about
  // whether a blocker exists (the brief tells the engine these are on screen).
  const evaluation = useMemo(
    () =>
      evaluateReadiness(profile, {
        hasLandingPage: Boolean(product?.landing_page_url),
        hasPrice: product?.price != null || hasPlanPrice,
        // The scan is the evidence that turns a claim into a verified fact —
        // and the only thing that lets us refuse a false one.
        signals: scan?.ok ? scan.signals : null,
      }),
    [profile, product, hasPlanPrice, scan],
  );

  // A stable signature of the proved set, so the celebration effect runs only
  // when what the scan proved actually changes — not on every render.
  const verifiedSignature = useMemo(() => [...evaluation.verified].sort().join("|"), [evaluation.verified]);

  // Switching products must re-seed silently: the next product's already-proved
  // items are its baseline, not a fresh win to celebrate.
  useEffect(() => {
    verifiedSeededRef.current = false;
  }, [selectedProductId]);

  // Fire ONLY on growth within a session. The first pass after load seeds the
  // baseline (proofs already on file are not a new achievement); any item that
  // appears after that is a real, just-earned proof.
  useEffect(() => {
    if (!loaded) return;
    const current = new Set(evaluation.verified);
    if (!verifiedSeededRef.current) {
      verifiedSeededRef.current = true;
      verifiedRef.current = current;
      return;
    }
    const fresh = evaluation.verified.filter((key) => !verifiedRef.current.has(key));
    verifiedRef.current = current;
    if (fresh.length > 0) {
      setJustVerified(fresh);
      setCelebrateOpen(true);
      track("readiness_item_verified", { count: fresh.length });
    }
    // verifiedSignature is the intended trigger; evaluation.verified is read
    // through it and stays stable between real changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifiedSignature, loaded]);

  const loadProducts = useCallback(async () => {
    if (!currentOrg) return;
    const supabase = createClient();
    const { data, error: productsError } = await supabase
      .from("products")
      .select("id, name, landing_page_url, price")
      .eq("org_id", currentOrg.id)
      .order("updated_at", { ascending: false });
    if (productsError) {
      setDataLoadError(true);
      setProductsLoaded(true);
      setLoaded(true);
      return;
    }
    const list = (data as ProductRow[]) ?? [];
    setDataLoadError(false);
    setProducts(list);
    setSelectedProductId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev;
      if (requestedProductId && list.some((p) => p.id === requestedProductId)) return requestedProductId;
      const lastProductId = window.localStorage.getItem(`seenaly:last-product:${currentOrg.id}`);
      if (lastProductId && list.some((p) => p.id === lastProductId)) return lastProductId;
      return list.length === 1 ? list[0].id : null;
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
    const [
      { data: readinessRow, error: readinessError },
      { data: verdicts, error: verdictsError },
      { data: plans, error: plansError },
      { data: scanRow, error: scanError },
      { count: scanCount },
    ] = await Promise.all([
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
      // Total reads of this page, ever. Resistance must survive a reload: the
      // user who tried yesterday and failed is still stuck today.
      supabase.from("product_scans").select("id", { count: "exact", head: true }).eq("product_id", selectedProductId),
    ]);
    if (readinessError || verdictsError || plansError || scanError) {
      setDataLoadError(true);
      setLoaded(true);
      return;
    }
    setDataLoadError(false);
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

    setScanAttempts(scanCount ?? 0);
    setStaleVerdict(false);

    // Restore how-tos the org already PAID for — losing them on reload would
    // charge twice for the same answer.
    if (list[0]) {
      const { data: howtos, error: howtosError } = await supabase
        .from("readiness_howtos")
        .select("finding_index, steps, sources")
        .eq("diagnosis_id", list[0].id);
      if (howtosError) {
        setDataLoadError(true);
        setLoaded(true);
        return;
      }
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
      const { data: fb, error: feedbackError } = await supabase
        .from("diagnosis_feedback")
        .select("diagnosis_id, rating")
        .eq("user_id", userId)
        .in(
          "diagnosis_id",
          list.map((r) => r.id),
        );
      if (feedbackError) {
        setDataLoadError(true);
        setLoaded(true);
        return;
      }
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
    if (info.ok) {
      setCredit({
        balance: info.balance,
        verdictCost: info.verdictCost,
        howToCost: info.howToCost,
      });
    }
  }, [currentOrg]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadCredit();
  }, [loadCredit]);

  const loadAssist = useCallback(async () => {
    if (!currentOrg || !selectedProductId) return;
    const info = await getAssistInfo(currentOrg.id, selectedProductId);
    // A missing catalog means the service is off — the offer simply never
    // appears. That is a valid state, not an error to shout about.
    if (!info.ok) return;
    setAssistOffering(info.offering);
    setAssistOpenItems(info.openItems);
  }, [currentOrg, selectedProductId]);

  useEffect(() => {
    loadAssist();
  }, [loadAssist]);

  /**
   * Buy one guided session for the item the user is stuck on. Refreshes both
   * the queue (so the offer turns into "already requested") and the balance.
   */
  const requestAssistFor = async (key: ReadinessItemKey, reason: string, note: string) => {
    if (!selectedProductId) return false;
    setError(null);
    const result = await requestAssist(selectedProductId, key, reason, note);
    if (!result.ok) {
      if (result.code === "insufficient_credits") setOutOfCredits(true);
      else setError(result.error);
      return false;
    }
    track("readiness_assist_requested", { item: key, reason, already: result.alreadyOpen });
    await Promise.all([loadAssist(), loadCredit()]);
    return true;
  };

  useEffect(() => {
    loadReadiness();
  }, [loadReadiness]);

  useEffect(() => {
    if (!workspace && requestedProductId) {
      router.replace(`/products/${requestedProductId}/readiness`);
    }
  }, [requestedProductId, router, workspace]);

  useEffect(() => {
    if (!workspace && !requestedProductId && productsLoaded && selectedProductId) {
      router.replace(`/products/${selectedProductId}/readiness`);
    }
  }, [productsLoaded, requestedProductId, router, selectedProductId, workspace]);

  // Takes the profile explicitly: "mark as resolved" saves immediately, and
  // reading `profile` from the closure would persist the pre-tick state.
  const persist = useCallback(
    async (next: ReadinessProfile = profile) => {
      if (!selectedProductId) return false;
      setSaveState("saving");
      const result = await saveReadiness(selectedProductId, next);
      if (!result.ok) {
        setSaveState("error");
        setError(result.error);
        return false;
      }
      setSavedProfile(next);
      setSaveState("saved");
      return true;
    },
    [profile, selectedProductId],
  );

  useEffect(() => {
    if (!ready || !selectedProductId || !dirty || busy || scanning) return;
    setSaveState("idle");
    const timeout = window.setTimeout(() => void persist(), 750);
    return () => window.clearTimeout(timeout);
  }, [busy, dirty, persist, ready, scanning, selectedProductId]);

  useEffect(() => {
    const saveBeforeLeaving = () => {
      if (document.visibilityState === "hidden" && dirty) void persist();
    };
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    document.addEventListener("visibilitychange", saveBeforeLeaving);
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => {
      document.removeEventListener("visibilitychange", saveBeforeLeaving);
      window.removeEventListener("beforeunload", warnBeforeLeaving);
    };
  }, [dirty, persist]);

  /**
   * "I already fixed this" ticks the checklist items the finding is about.
   * Free and instant: the deterministic blockers recompute on the spot, which
   * is the whole point — re-validating must not require regenerating a verdict.
   */
  const resolveItems = async (items: ReadinessItemKey[], resolved: boolean) => {
    setError(null);
    setResolveRefused(null);
    const signals = scan?.ok ? scan.signals : null;
    // The checklist refuses a claim the page disproves; this checkbox used to
    // write straight to the profile, so the verdict card was a way AROUND the
    // whole verification layer — tick here and a real blocker silently cleared.
    // Same rule, same choke point: only what the evidence does not contradict.
    const disproved = resolved ? items.filter((key) => observeItem(key, signals) === false) : [];
    const allowed = items.filter((key) => !disproved.includes(key));

    if (disproved.length > 0) {
      setResolveRefused(disproved.map((key) => t(`item-${key}`)).join(", "));
    }
    if (allowed.length === 0) return;

    const next = { ...profile };
    for (const key of allowed) next[key] = resolved;
    setProfile(next);
    setStaleVerdict(true);
    track("readiness_finding_resolved", { resolved, items: allowed.length, refused: disproved.length });
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
      setRegisteredByIndex((previous) => ({ ...previous, [findingIndex]: result.id }));
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
    const { data: scanRow, error: scanError } = await supabase
      .from("product_scans")
      .select("requested_url, final_url, ok, status_code, error, result, created_at")
      .eq("product_id", selectedProductId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (scanError) {
      setError(scanError.message);
      return;
    }
    setScanAttempts((previous) => previous + 1);
    const view: ScanView | null = scanRow
      ? {
          requestedUrl: scanRow.requested_url as string,
          finalUrl: (scanRow.final_url as string | null) ?? null,
          ok: scanRow.ok === true,
          statusCode: (scanRow.status_code as number | null) ?? null,
          error: (scanRow.error as string | null) ?? null,
          createdAt: scanRow.created_at as string,
          signals: scanRow.ok === true ? (scanRow.result as ScanView["signals"]) : null,
        }
      : null;
    setScan(view);
    // Handed back so the caller can fold the proof into the profile without
    // waiting a render for `scan` state to settle.
    return view;
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
      const view = await refreshScan();

      // Everything the read PROVED is now settled — confirm it instead of
      // asking the user to declare what we just saw with our own eyes. This is
      // one-way (see `autoConfirmProven`): absence never un-confirms anything,
      // because a client-rendered page hides its tags from an HTML fetch.
      const proven = autoConfirmProven(profile, view?.ok ? view.signals : null);
      if (proven !== profile) {
        const gained = READINESS_ITEM_KEYS.filter((key) => proven[key] && !profile[key]);
        setProfile(proven);
        await persist(proven);
        track("readiness_autoconfirmed", { items: gained.length });
      }
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
          setCredit((previous) => ({
            balance: result.balance ?? 0,
            verdictCost: result.cost ?? 0,
            howToCost: previous?.howToCost ?? 0,
          }));
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
  const isReady = latest?.output.verdict === "pronto";
  const outOfBalance = credit != null && credit.verdictCost > 0 && credit.balance < credit.verdictCost;
  // Marking a fix done leaves the verdict behind reality; re-verify becomes the
  // one thing to do next. Otherwise the forward action depends on being ready.
  const reVerifyIsPrimary = staleVerdict || dirty;

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

  const reVerifyButton = (
    <Button
      variant={reVerifyIsPrimary ? "contained" : "outlined"}
      color={reVerifyIsPrimary ? "primary" : "grey"}
      startIcon={<NiShieldCheck size="small" />}
      onClick={verify}
      disabled={busy || scanning || !product || outOfBalance}
    >
      {busy ? t("verifying") : t("verify-again")}
    </Button>
  );

  return (
    <Grid container spacing={5} className="items-start">
      {/* Covers both entry points into generation: finishing the guided wizard
          and re-verifying from the result view. */}
      <ProcessingOverlay open={busy} title={t("verifying")} stages={stages} patienceLabel={t("stage-patience")} />
      <VerifiedCelebration open={celebrateOpen} items={justVerified} onClose={() => setCelebrateOpen(false)} />
      <Grid size={"grow"} spacing={5} container>
        <Grid size={12} spacing={2.5} container className="items-center">
          <Grid size={{ xs: 12, md: "grow" }}>
            <Typography variant={workspace ? "h2" : "h1"} component={workspace ? "h2" : "h1"} className="mb-0">
              {t("title")}
            </Typography>
            <Breadcrumbs>
              <Link color="inherit" href="/home">
                {t("crumb-home")}
              </Link>
              <Typography variant="body2">{t("title")}</Typography>
            </Breadcrumbs>
          </Grid>
          {!workspace && products.length > 1 && ready && (
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

        {configured && currentOrg && dataLoadError && (
          <Grid size={12}>
            <LoadErrorState
              title={tc("load-error-title")}
              description={tc("load-error-body")}
              retryLabel={tc("retry")}
              onRetry={() => {
                setDataLoadError(false);
                loadProducts();
                loadReadiness();
              }}
            />
          </Grid>
        )}

        {configured && !loading && !loadError && orgs.length === 0 && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("no-org")}
            </Alert>
          </Grid>
        )}

        {configured && !dataLoadError && (loading || (currentOrg && !ready)) && (
          <Grid size={12}>
            <Skeleton variant="rounded" height={320} />
          </Grid>
        )}

        {/* No product context: readiness has nothing to audit. */}
        {currentOrg && ready && !dataLoadError && products.length === 0 && (
          <Grid size={12}>
            <EmptyState
              icon={<NiTag />}
              title={t("no-product-title")}
              description={t("no-product-body")}
              action={{ label: t("no-product-cta"), href: "/products/new" }}
            />
          </Grid>
        )}

        {currentOrg && ready && !dataLoadError && products.length > 1 && !product && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("select-product-guidance")}
            </Alert>
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
        {(outOfCredits || (credit != null && credit.verdictCost > 0 && credit.balance < credit.verdictCost)) && (
          <Grid size={12}>
            <Alert severity="warning" className="neutral bg-background-paper/60!">
              <Typography variant="subtitle2">{t("credits-out-title")}</Typography>
              <Typography variant="body2">
                {t("credits-out-body", {
                  balance: credit?.balance ?? 0,
                  cost: credit?.verdictCost ?? 0,
                })}
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
        {product && ready && canShowProductData && !latest && (
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
                saveState={saveState}
                onRetrySave={() => void persist()}
                onBeforeAdvance={() => (dirty ? persist() : Promise.resolve(true))}
                assistOffering={assistOffering}
                assistOpenItems={assistOpenItems}
                scanAttempts={scanAttempts}
                creditBalance={credit?.balance ?? null}
                onRequestAssist={requestAssistFor}
              />
            </Grid>
          </>
        )}

        {/* HAS A VERDICT: the verdict + the plan lead. Everything else — editing
            answers, the scan, re-checking — is one action bar and a modal, so
            the result stays scannable instead of a wall of stacked sections. */}
        {product && ready && canShowProductData && latest && (
          <>
            <Grid size={12}>
              <ReadinessVerdict
                output={latest.output}
                productName={product.name}
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
                evaluation={evaluation}
                onVerifyNow={product.landing_page_url ? runScan : undefined}
                verifying={scanning}
                onResolve={resolveItems}
                howToByIndex={howToByIndex}
                onHowTo={requestHowTo}
                howToCost={credit?.howToCost ?? 0}
                registeredByIndex={registeredByIndex}
                experimentHref={(id) => `/products/${product.id}/experiments/${id}`}
                creativePlanHref={`/products/${product.id}/creatives`}
              />

              {/* A "mark as fixed" the page disproves is refused here exactly
                  as it is in the checklist — and says which item and why, so
                  the refusal never reads as a broken checkbox. */}
              {resolveRefused && (
                <Alert severity="warning" className="neutral bg-background-paper/60! mt-3">
                  <Typography variant="subtitle2">{t("resolve-refused-title")}</Typography>
                  <Typography variant="body2">
                    {t("resolve-refused-body", {
                      items: resolveRefused,
                      url: scan?.finalUrl ?? scan?.requestedUrl ?? "",
                    })}
                  </Typography>
                </Alert>
              )}

              {/* Marking a fix done makes the on-screen verdict older than
                  reality — surface the cheap re-check right there. */}
              {staleVerdict && (
                <Alert severity="info" className="neutral bg-background-paper/60! mt-3">
                  <Typography variant="body2">{t("stale-verdict")}</Typography>
                </Alert>
              )}

              {/* ONE action bar. Exactly one primary, decided by state:
                  changed something → re-verify; ready → go diagnose; else →
                  review your answers. Nothing competes. */}
              <Box className="bg-background-paper/95 sticky bottom-2 z-10 mt-3 flex flex-row flex-wrap items-center gap-2 rounded-2xl p-2 shadow-sm backdrop-blur-sm">
                {reVerifyButton}
                <Button
                  variant={reVerifyIsPrimary ? "text" : "contained"}
                  color={reVerifyIsPrimary ? "grey" : "primary"}
                  startIcon={<NiListCheck size="small" />}
                  onClick={() => setReviewOpen(true)}
                >
                  {t("review-answers")}
                </Button>
                {/* The campaign diagnosis is the NEXT room — only offered once
                    the structure is actually ready, never as a premature dead
                    end for someone with no campaigns to diagnose yet. */}
                {isReady && (
                  <Button
                    variant="text"
                    color="grey"
                    startIcon={<NiPulse size="small" />}
                    onClick={() => router.push(`/products/${product.id}/diagnosis`)}
                  >
                    {t("go-to-diagnosis")}
                  </Button>
                )}
              </Box>
            </Grid>
          </>
        )}

        {/* Review modal: the checklist + scan + free blockers, off the main
            scroll. Marking a fix on the plan and ticking it here are the same
            state, so they stay in sync. */}
        {product && ready && canShowProductData && latest && (
          <Dialog
            open={reviewOpen}
            onClose={() => setReviewOpen(false)}
            fullScreen={fullScreenDialog}
            fullWidth
            maxWidth="md"
            scroll="paper"
          >
            <DialogTitle className="flex flex-row items-center gap-2 pr-2">
              <Box className="grow">
                <Typography variant="h5" component="span" className="card-title mb-0">
                  {t("review-title")}
                </Typography>
                <Typography variant="body2" className="text-text-secondary">
                  {t("review-body")}
                </Typography>
              </Box>
              <IconButton aria-label={t("review-close")} onClick={() => setReviewOpen(false)} className="flex-none">
                <NiCross size="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers className="flex flex-col gap-4">
              {/* The SAME guided wizard, not a flat wall of 25 checkboxes.
                  Generating a verdict used to retire the step-by-step forever,
                  which hit hardest exactly the beginner who generated early
                  with almost nothing filled: the guided teaching disappeared
                  the moment they needed it most. The verdict is a RESULT, not
                  a replacement for the intake. */}
              <ReadinessWizard
                profile={profile}
                evaluation={evaluation}
                onChange={setProfile}
                scan={scan}
                hasUrl={Boolean(product.landing_page_url)}
                onScan={runScan}
                scanning={scanning}
                onComplete={() => {
                  setReviewOpen(false);
                  verify();
                }}
                busy={busy}
                credit={credit}
                saveState={saveState}
                onRetrySave={() => void persist()}
                onBeforeAdvance={() => (dirty ? persist() : Promise.resolve(true))}
                assistOffering={assistOffering}
                assistOpenItems={assistOpenItems}
                scanAttempts={scanAttempts}
                creditBalance={credit?.balance ?? null}
                onRequestAssist={requestAssistFor}
              />
              <Box className="bg-background sticky bottom-0 flex flex-row flex-wrap items-center gap-2 py-2">
                <Button variant="text" color="grey" onClick={() => setReviewOpen(false)}>
                  {t("review-close")}
                </Button>
                {dirty && (
                  <Typography variant="body2" className="text-text-secondary">
                    {t("reverify-hint")}
                  </Typography>
                )}
              </Box>
            </DialogContent>
          </Dialog>
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

export default function ReadinessPage() {
  return <ReadinessExperience />;
}
