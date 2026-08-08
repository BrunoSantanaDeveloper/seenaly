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
import ReadinessHistory, { DeltaChips } from "./components/readiness-history";
import { type ScanTrendEntry, type ScanView } from "./components/readiness-scan";
import ReadinessVerdict, { type HowToState, type ReadinessMeta } from "./components/readiness-verdict";
import ReadinessWizard from "./components/readiness-wizard";
import VerifiedCelebration, { type CelebrationSurface } from "./components/verified-celebration";
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
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";

import EmptyState from "@/components/product/empty-state";
import LoadErrorState from "@/components/product/load-error-state";
import ProcessingOverlay, { type ProcessingStage } from "@/components/product/processing-overlay";
import NextTaskCard from "@/components/product-workspace/next-task";
import NiBook from "@/icons/nexture/ni-book";
import NiCamera from "@/icons/nexture/ni-camera";
import NiCross from "@/icons/nexture/ni-cross";
import NiListCheck from "@/icons/nexture/ni-list-check";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiScreen from "@/icons/nexture/ni-screen";
import NiSearch from "@/icons/nexture/ni-search";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiSparkle from "@/icons/nexture/ni-sparkle";
import NiTag from "@/icons/nexture/ni-tag";
import { track } from "@/lib/analytics";
import { EMPTY_JOURNEY_SIGNALS, type ReadinessJourneySignals, sanitizeJourneySignals } from "@/lib/readiness/assist";
import {
  autoConfirmProven,
  EMPTY_READINESS_PROFILE,
  evaluateReadiness,
  mapRegisteredExperiments,
  READINESS_ITEM_KEYS,
  type ReadinessItemKey,
  type ReadinessProfile,
  scanProvedCount,
  toReadinessProfile,
  verifyItem,
} from "@/lib/readiness/checklist";
import { compareVerdicts } from "@/lib/readiness/compare";
import type { ReadinessErrorCode } from "@/lib/readiness/errors";
import { normalizeStoredHowTo } from "@/lib/readiness/howto";
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
  /** `used` marks the excerpts the verdict actually cited; absent on verdicts
   *  stored before citations were resolved (see `citedExcerptIndexes`). */
  knowledge_refs: { title: string; trust_level: number; used?: boolean }[];
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
  // Multi-org correctness: the org everything charges/reads against is the
  // RESOLVED product's org, never useOrganization's orgs[0] default — a user
  // in two orgs opening a product from org #2 must see org #2's balance and
  // never a silently-substituted product.
  const [productOrgId, setProductOrgId] = useState<string | null>(null);
  const [productNotFound, setProductNotFound] = useState(false);
  const [hasPlanPrice, setHasPlanPrice] = useState(false);
  const [profile, setProfile] = useState<ReadinessProfile>(EMPTY_READINESS_PROFILE);
  const [savedProfile, setSavedProfile] = useState<ReadinessProfile>(EMPTY_READINESS_PROFILE);
  // Concierge resistance signals (U5) — durable, so the earned offer survives
  // a step change or a reload instead of evaporating with local state.
  const [journey, setJourney] = useState<ReadinessJourneySignals>(EMPTY_JOURNEY_SIGNALS);
  const [savedJourney, setSavedJourney] = useState<ReadinessJourneySignals>(EMPTY_JOURNEY_SIGNALS);
  const [rows, setRows] = useState<VerdictRow[]>([]);
  const [scan, setScan] = useState<ScanView | null>(null);
  // The honest proved-count series (R3) — read from the product_scans time
  // series that previously only ever served its latest row.
  const [scanTrend, setScanTrend] = useState<ScanTrendEntry[]>([]);
  const [historyExpandedId, setHistoryExpandedId] = useState<string | null>(null);
  // Deep link (U1): ?verdict=<id>#finding-<n> from the experiment backlink.
  const requestedVerdictId = searchParams.get("verdict");
  const pendingFindingRef = useRef<number | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ index: number; nonce: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [registeringIndex, setRegisteringIndex] = useState<number | null>(null);
  const [registeredByIndex, setRegisteredByIndex] = useState<Record<number, string>>({});
  const [feedbackByVerdict, setFeedbackByVerdict] = useState<Record<string, DiagnosisRating>>({});
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  // Failures arrive as stable CODES (lib/readiness/errors) translated client-
  // side; `detail` is the raw upstream text rendered as a secondary technical
  // line. "unknown" wraps actions that have not adopted the contract yet.
  const [error, setError] = useState<{ code: ReadinessErrorCode | "unknown"; detail?: string } | null>(null);
  // Guidance that is NOT an error (scan cooldown, generation already running):
  // rendered as an info alert, never red.
  const [notice, setNotice] = useState<string | null>(null);
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
  // No active subscription: a guided state with a door to billing — never a
  // raw red alert (U4).
  const [noSubscription, setNoSubscription] = useState(false);
  // A failed credit read is an ERROR with a retry, never a silently missing
  // banner (P5 — error ≠ empty).
  const [creditLoadFailed, setCreditLoadFailed] = useState(false);
  const [creditRetrying, setCreditRetrying] = useState(false);
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
  const [celebrateSurface, setCelebrateSurface] = useState<CelebrationSurface>("modal");
  // Which surface the reward has EARNED. A proof the user asked for and waited
  // through the overlay for is the result of that action, so it may own the
  // screen; the delayed PageSpeed refetch lands ~25s later, unannounced, and
  // background work never seizes the screen (.claude/rules/app-ux.md). Set at
  // the two call sites that can change `scan`, read when the effect fires.
  const celebrateSurfaceRef = useRef<CelebrationSurface>("modal");
  // The concierge: catalog price + which items already have an open request, so
  // the same session is never sold twice.
  const [assistOffering, setAssistOffering] = useState<AssistOffering | null>(null);
  const [assistOpenItems, setAssistOpenItems] = useState<string[]>([]);
  // How many times this page has been read — a second failed proof is what
  // separates real resistance from a first attempt.
  const [scanAttempts, setScanAttempts] = useState(0);
  const verifiedRef = useRef<Set<ReadinessItemKey>>(new Set());
  const verifiedSeededRef = useRef(false);
  // Latest profile, for the DELAYED speed-measurement refetch: folding with a
  // 25s-old closure would overwrite every box ticked meanwhile.
  const profileRef = useRef<ReadinessProfile>(profile);
  // One pending refetch for the background PageSpeed job; cleared on unmount
  // and on product switch so it can never fold another product's scan.
  const psiTimerRef = useRef<number | null>(null);
  // Checklist + scan live in a modal now, off the main result scroll.
  const [reviewOpen, setReviewOpen] = useState(false);
  // U7: open the review modal AT one item's teaching panel (dimension step +
  // expanded help). Nonce so the same item can be requested again.
  const [reviewFocus, setReviewFocus] = useState<{ itemKey: ReadinessItemKey; nonce: number } | null>(null);
  const fullScreenDialog = useMediaQuery("(max-width:640px)");

  const product = products.find((p) => p.id === selectedProductId) ?? null;
  // The org money and data are scoped to: the resolved product's org when a
  // product is forced, the session's current org otherwise.
  const effectiveOrgId = productOrgId ?? currentOrg?.id ?? null;
  const ready = productsLoaded && loaded;
  const canShowProductData = !dataLoadError || Boolean(product && loaded);
  // Journey signals ride the same debounced autosave as the profile (U5).
  const dirty = useMemo(
    () => JSON.stringify({ profile, journey }) !== JSON.stringify({ profile: savedProfile, journey: savedJourney }),
    [profile, journey, savedProfile, savedJourney],
  );

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

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Switching products must re-seed silently: the next product's already-proved
  // items are its baseline, not a fresh win to celebrate. The pending speed
  // refetch dies with the switch too — it must never fold another product.
  useEffect(() => {
    verifiedSeededRef.current = false;
    if (psiTimerRef.current) {
      window.clearTimeout(psiTimerRef.current);
      psiTimerRef.current = null;
    }
  }, [selectedProductId]);

  useEffect(
    () => () => {
      if (psiTimerRef.current) window.clearTimeout(psiTimerRef.current);
    },
    [],
  );

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
      setCelebrateSurface(celebrateSurfaceRef.current);
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

    // FORCED PRODUCT (workspace route / ?product=): resolve THAT row first,
    // under RLS, and derive the org from it. The old shape filtered by
    // orgs[0] and fell back to localStorage/list[0] when the forced id was
    // not in that list — silently rendering ANOTHER product under this URL
    // for a user whose product lives in their second org.
    if (requestedProductId) {
      const { data: forced, error: forcedError } = await supabase
        .from("products")
        .select("id, name, landing_page_url, price, org_id")
        .eq("id", requestedProductId)
        .maybeSingle();
      if (forcedError) {
        setDataLoadError(true);
        setProductsLoaded(true);
        setLoaded(true);
        return;
      }
      if (!forced) {
        // Deleted mid-session or a foreign id: a proper not-found state,
        // never a silent substitution (the server layout already 404s the
        // cold path — this covers client-navigation races).
        setProductNotFound(true);
        setProducts([]);
        setSelectedProductId(null);
        setProductOrgId(null);
        setProductsLoaded(true);
        return;
      }
      setProductNotFound(false);
      setProductOrgId(forced.org_id as string);
      const { data, error: productsError } = await supabase
        .from("products")
        .select("id, name, landing_page_url, price")
        .eq("org_id", forced.org_id)
        .order("updated_at", { ascending: false });
      if (productsError) {
        setDataLoadError(true);
        setProductsLoaded(true);
        setLoaded(true);
        return;
      }
      setDataLoadError(false);
      setProducts((data as ProductRow[]) ?? []);
      setSelectedProductId(requestedProductId);
      setProductsLoaded(true);
      return;
    }

    // Free browsing (/readiness with no product): the current org scopes the
    // list, as before.
    setProductNotFound(false);
    setProductOrgId(null);
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
      { data: trendRows, error: trendError },
    ] = await Promise.all([
      supabase.from("product_readiness").select("*").eq("product_id", selectedProductId).maybeSingle(),
      // 6, not 5: the 6th row exists solely as the predecessor of the 5th
      // displayed history row, so every visible row carries a real delta or
      // the honest "first verdict" caption.
      supabase
        .from("diagnoses")
        .select("id, output, created_at, knowledge_refs")
        .eq("product_id", selectedProductId)
        .eq("scope", "readiness")
        .order("created_at", { ascending: false })
        .limit(6),
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
      // The proved-count series (R3): the time series finally feeds the UI.
      supabase
        .from("product_scans")
        .select("ok, created_at, result")
        .eq("product_id", selectedProductId)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);
    if (readinessError || verdictsError || plansError || scanError || trendError) {
      setDataLoadError(true);
      setLoaded(true);
      return;
    }
    setDataLoadError(false);
    const next = toReadinessProfile(readinessRow as Record<string, unknown> | null);
    setProfile(next);
    setSavedProfile(next);
    // Sanitize on read too — the row shape is never trusted.
    const storedJourney = sanitizeJourneySignals(
      ((readinessRow as { extra?: { journey?: unknown } } | null)?.extra ?? {}).journey,
    );
    setJourney(storedJourney);
    setSavedJourney(storedJourney);
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

    setScanTrend(
      ((trendRows as { ok: boolean; created_at: string; result: unknown }[]) ?? [])
        .map((row) => ({
          createdAt: row.created_at,
          ok: row.ok === true,
          proved: row.ok === true ? scanProvedCount(row.result as ScanView["signals"]) : null,
        }))
        // Oldest→newest, the direction a trend reads.
        .reverse() as ScanTrendEntry[],
    );
    setHistoryExpandedId(null);
    setScanAttempts(scanCount ?? 0);
    setStaleVerdict(false);

    // Restore how-tos the org already PAID for — losing them on reload would
    // charge twice for the same answer. Same pass rebuilds the registered-
    // experiment map (U6): the in-memory-only version made "Register
    // experiment" reappear after a reload — a button that lies.
    if (list[0]) {
      const [{ data: howtos, error: howtosError }, { data: experimentRows }] = await Promise.all([
        supabase.from("readiness_howtos").select("finding_index, steps, sources").eq("diagnosis_id", list[0].id),
        supabase.from("experiments").select("id, change_made").eq("diagnosis_id", list[0].id),
      ]);
      if (howtosError) {
        setDataLoadError(true);
        setLoaded(true);
        return;
      }
      // A failed experiments read falls back to the un-registered rendering —
      // safe: the register action is idempotent and free, a re-click cannot
      // duplicate or charge.
      setRegisteredByIndex(
        mapRegisteredExperiments(
          list[0].output.findings,
          (experimentRows as { id: string; change_made: string | null }[]) ?? [],
        ),
      );
      const map: Record<number, HowToState> = {};
      for (const row of (howtos ?? []) as {
        finding_index: number;
        steps: unknown;
        sources: { title: string; trust_level: number }[];
      }[]) {
        map[row.finding_index] = {
          // The shared normalizer, not a hand-rolled copy — this read path
          // silently missed `references` when the shape grew.
          howTo: normalizeStoredHowTo(row.steps),
          sources: row.sources ?? [],
        };
      }
      setHowToByIndex(map);
    } else {
      setHowToByIndex({});
      setRegisteredByIndex({});
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
    // The verdict belongs to the PRODUCT's org — writing orgs[0] here filed
    // an org-#2 verdict's feedback under org #1.
    if (!effectiveOrgId) return;
    const previous = feedbackByVerdict[verdictId];
    setFeedbackByVerdict((prev) => ({ ...prev, [verdictId]: rating })); // optimistic
    setFeedbackBusy(true);
    const result = await recordDiagnosisFeedback(effectiveOrgId, verdictId, rating);
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
    // Foreign action, not yet on the code contract — wrap as unknown.
    setError({ code: "unknown", detail: result.error });
  };

  const loadCredit = useCallback(async () => {
    if (!effectiveOrgId) return;
    setCreditRetrying(true);
    const info = await getReadinessCreditInfo(effectiveOrgId);
    setCreditRetrying(false);
    if (info.ok) {
      setCreditLoadFailed(false);
      setCredit({
        balance: info.balance,
        verdictCost: info.verdictCost,
        howToCost: info.howToCost,
      });
      return;
    }
    // A failed read used to be swallowed: no cost banner, outOfBalance false,
    // and the user could click into a knowable failure. Error ≠ empty (P5).
    setCreditLoadFailed(true);
  }, [effectiveOrgId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadCredit();
  }, [loadCredit]);

  const loadAssist = useCallback(async () => {
    if (!selectedProductId) return;
    const info = await getAssistInfo(selectedProductId);
    // A missing catalog arrives as ok:true with a null offering — the offer
    // simply never appears. A NOT-ok result is a real read failure; the
    // concierge is optional enrichment, so it degrades silently for now
    // (P5 upgrades this to a retriable inline state).
    if (!info.ok) return;
    setAssistOffering(info.offering);
    setAssistOpenItems(info.openItems);
  }, [selectedProductId]);

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
      else if (result.code === "no_subscription" || result.code === "subscription_suspended") setNoSubscription(true);
      else setError({ code: result.code, detail: result.detail });
      return false;
    }
    track("readiness_assist_requested", { item: key, reason, already: result.alreadyOpen });
    await Promise.all([loadAssist(), loadCredit()]);
    return true;
  };

  useEffect(() => {
    loadReadiness();
  }, [loadReadiness]);

  // The redirects carry EVERY query param except `product` (which becomes the
  // path segment) plus the hash — dropping them killed the welcome greeting
  // (new=1) and the experiment backlink (?verdict=…#finding-N).
  const redirectSuffix = useCallback(() => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.delete("product");
    const query = qs.toString();
    return (query ? `?${query}` : "") + window.location.hash;
  }, [searchParams]);

  useEffect(() => {
    if (!workspace && requestedProductId) {
      router.replace(`/products/${requestedProductId}/readiness${redirectSuffix()}`);
    }
  }, [redirectSuffix, requestedProductId, router, workspace]);

  useEffect(() => {
    if (!workspace && !requestedProductId && productsLoaded && selectedProductId) {
      router.replace(`/products/${selectedProductId}/readiness${redirectSuffix()}`);
    }
  }, [productsLoaded, redirectSuffix, requestedProductId, router, selectedProductId, workspace]);

  // Deep link (U1): the hash never reaches searchParams — read it once on
  // mount. The scroll must run AFTER the async load (native hash scroll fires
  // before #finding-N exists).
  useEffect(() => {
    const match = /^#finding-(\d+)$/.exec(window.location.hash);
    if (match) pendingFindingRef.current = Number(match[1]);
  }, []);

  useEffect(() => {
    if (!loaded || rows.length === 0) return;
    // ?verdict= names a specific verdict. When it IS the latest, the main card
    // handles it (plus the finding focus below); an older one gets its history
    // row expanded and scrolled to its anchor; an unknown id degrades to an
    // info notice — never an error rendered over a working screen.
    if (requestedVerdictId && requestedVerdictId !== rows[0].id) {
      const inHistory = rows.slice(1).some((row) => row.id === requestedVerdictId);
      if (inHistory) {
        setHistoryExpandedId(requestedVerdictId);
        window.setTimeout(() => {
          document.getElementById(`verdict-${requestedVerdictId}`)?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 120);
      } else {
        setNotice(t("deep-link-verdict-missing"));
      }
      pendingFindingRef.current = null;
      return;
    }
    if (pendingFindingRef.current !== null) {
      const findings = rows[0].output.findings.length;
      const index = Math.min(Math.max(0, pendingFindingRef.current), Math.max(0, findings - 1));
      pendingFindingRef.current = null;
      setFocusRequest({ index, nonce: Date.now() });
    }
    // Run once per load of this product's rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, rows]);

  // Takes the profile explicitly: "mark as resolved" saves immediately, and
  // reading `profile` from the closure would persist the pre-tick state.
  const persist = useCallback(
    async (next: ReadinessProfile = profile) => {
      if (!selectedProductId) return false;
      setSaveState("saving");
      const result = await saveReadiness(selectedProductId, next, journey);
      if (!result.ok) {
        setSaveState("error");
        setError({ code: result.code, detail: result.detail });
        return false;
      }
      setSavedProfile(next);
      setSavedJourney(journey);
      setSaveState("saved");
      return true;
    },
    [journey, profile, selectedProductId],
  );

  /** Record one durable resistance signal (U5) — a set-union, one-way. */
  const recordJourneySignal = useCallback((kind: "skipped" | "helpOpened", key: ReadinessItemKey) => {
    setJourney((current) => {
      const listKey = kind === "skipped" ? "skippedItems" : "helpOpenedItems";
      if (current[listKey].includes(key)) return current;
      return { ...current, [listKey]: [...current[listKey], key] };
    });
  }, []);

  /**
   * "Ver opções de ajuda" from a specialist finding (U7): open the review
   * modal at that item's teaching panel. Counts as an explicit help request —
   * the same resistance signal as the "não sei o que é isso" button.
   */
  const openReviewAtItem = (key: ReadinessItemKey) => {
    setResolveRefused(null);
    setReviewFocus({ itemKey: key, nonce: Date.now() });
    setReviewOpen(true);
    recordJourneySignal("helpOpened", key);
  };

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
    // Same rule, ONE tier-aware authority: verifyItem refuses only proved-tier
    // claims the evidence positively disproves — a raw observeItem===false
    // here also refused weak-tier hints (e.g. mobile-tested without a viewport
    // tag), which the contract forbids ("weak … never used to refuse").
    const disproved = resolved ? items.filter((key) => verifyItem(key, true, signals) === "contradicted") : [];
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
    // The rail's queue is server-rendered in the product layout, so a task
    // that just became resolved must be re-read there too — otherwise the
    // list the user is steering by silently disagrees with the screen.
    if (workspace) router.refresh();
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
      if (result.code === "no_subscription" || result.code === "subscription_suspended") {
        setNoSubscription(true);
        return;
      }
      setError({ code: result.code, detail: result.detail });
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
        // Foreign action, not yet on the code contract — wrap as unknown.
        setError({ code: "unknown", detail: result.error });
        return;
      }
      track("experiment_registered", { from: "readiness" });
      setRegisteredByIndex((previous) => ({ ...previous, [findingIndex]: result.id }));
      // The rail's queue is server-rendered in the product layout, so a task
      // that just became resolved must be re-read there too — otherwise the
      // list the user is steering by silently disagrees with the screen.
      if (workspace) router.refresh();
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
  const refreshScan = useCallback(
    async ({ countAttempt = true }: { countAttempt?: boolean } = {}) => {
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
        setError({ code: "load_failed", detail: scanError.message });
        return;
      }
      // `scanAttempts` feeds the concierge's resistance heuristics — only a REAL
      // new page read counts. Refreshing to pick up the background speed
      // measurement must not inflate it.
      if (countAttempt) setScanAttempts((previous) => previous + 1);
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
    },
    [selectedProductId],
  );

  /**
   * Fold what the read PROVED into the profile (one-way — see
   * `autoConfirmProven`). Reads the LATEST profile via ref, because the
   * delayed speed-measurement refetch calls this 25s later and a stale
   * closure would overwrite every box ticked meanwhile.
   */
  const foldProven = async (view: ScanView | null) => {
    const current = profileRef.current;
    const proven = autoConfirmProven(current, view?.ok ? view.signals : null);
    if (proven !== current) {
      const gained = READINESS_ITEM_KEYS.filter((key) => proven[key] && !current[key]);
      setProfile(proven);
      await persist(proven);
      track("readiness_autoconfirmed", { items: gained.length });
    }
  };

  /**
   * "Atualizar resultado" on the pending speed measurement: the user is looking
   * at the card and pressed it, so this is foreground too — unlike the silent
   * 25s timer that does the same fetch on its own.
   */
  const refreshScanManually = () => {
    celebrateSurfaceRef.current = "modal";
    void refreshScan({ countAttempt: false });
  };

  const runScan = async () => {
    if (!selectedProductId) return;
    setError(null);
    setNotice(null);
    // Foreground, asked-for work: whatever it proves has earned the screen.
    celebrateSurfaceRef.current = "modal";
    setScanning(true);
    try {
      // Persist first: the user is mid-wizard with unsaved ticks, and a scan
      // is a good moment to make them durable.
      if (dirty) await persist();
      const result = await scanProductSite(selectedProductId);
      // A site that did not answer is a recorded outcome the card explains —
      // only "we could not even try" surfaces as an error.
      if (!result.ok) {
        // The cooldown is guidance, never a red error: the page was read
        // moments ago and the throttle protects a free resource.
        if (result.code === "scan_cooldown") {
          setNotice(t("scan-cooldown", { seconds: result.retryAfterSeconds ?? 60 }));
          return;
        }
        setError({ code: result.code, detail: result.detail });
        return;
      }
      track("readiness_scanned", { reachable: result.scanned });
      // A fresh read makes any earlier refusal text stale (U8).
      setResolveRefused(null);
      const view = await refreshScan();

      // Everything the read PROVED is now settled — confirm it instead of
      // asking the user to declare what we just saw with our own eyes. This is
      // one-way (see `autoConfirmProven`): absence never un-confirms anything,
      // because a client-rendered page hides its tags from an HTML fetch.
      await foldProven(view ?? null);

      // The official speed measurement runs in a background job (10–25s):
      // one delayed refetch picks it up — without counting as a new page
      // read — and re-folds so a fast page auto-ticks pageFast.
      if (view?.ok && view.signals?.psi?.status === "pending") {
        if (psiTimerRef.current) window.clearTimeout(psiTimerRef.current);
        psiTimerRef.current = window.setTimeout(async () => {
          // Nobody is waiting on this one — it may congratulate, never intrude.
          celebrateSurfaceRef.current = "toast";
          const fresh = await refreshScan({ countAttempt: false });
          await foldProven(fresh ?? null);
        }, 25_000);
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
    setNotice(null);
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
        // Another tab already started this verification — its result will
        // land here; waiting is the answer, not a red error.
        if (result.code === "generation_in_progress") {
          setNotice(t("verify-in-progress"));
          return;
        }
        // No subscription: guidance with a door, never a red dead end.
        if (result.code === "no_subscription" || result.code === "subscription_suspended") {
          setNoSubscription(true);
          return;
        }
        setError({ code: result.code, detail: result.detail });
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
  // The forward exit must not depend on "pronto" alone: "quase" has ZERO
  // blockers by definition (reconcileVerdict enforces it), so hiding the exit
  // there contradicted the verdict itself — and a real user got stranded
  // exactly that way. Readiness advises, it never gates (docs/PRODUCT.md:
  // "não é um portão"), so even "nao_pronto" keeps a deliberate, eyes-open way
  // through.
  const verdictValue = latest?.output.verdict ?? null;
  // ONE derived gate for every "generate" affordance (U4) — finish-early on
  // step 2 and the final step must never disagree. Permissive when the cost
  // is unknown or zero: the server re-checks, and a phantom gate would
  // violate the value-first invariant.
  const canGenerate = !(credit != null && credit.verdictCost > 0 && credit.balance < credit.verdictCost);
  const outOfBalance = !canGenerate;
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

  // The REAL steps scanProductSite() performs, in execution order (see
  // lib/readiness/scan.ts): validate + DNS-resolve the host, fetch the page
  // following redirects, probe robots.txt/sitemap.xml, parse the HTML, then
  // settle what the read proved. A page fetch across the open internet is a
  // 5–15s wait — long enough that a button label alone reads as "broken".
  const scanStages: ProcessingStage[] = useMemo(
    () => [
      { icon: <NiSearch />, label: t("scan-stage-address") },
      { icon: <NiScreen />, label: t("scan-stage-fetch") },
      { icon: <NiListCheck />, label: t("scan-stage-discovery") },
      { icon: <NiPulse />, label: t("scan-stage-parse") },
      { icon: <NiShieldCheck />, label: t("scan-stage-settle") },
    ],
    [t],
  );

  /**
   * A disabled button must say WHY at the button. The shortfall notice lives at
   * the top of the page, so someone who scrolled down to the action bar met a
   * dead control with no reason given — and the credit wall is exactly where
   * the free grant is supposed to convert into a plan, so a silent block is
   * both a UX failure and a lost upgrade.
   */
  const reVerifyButton = (
    <>
      {outOfBalance ? (
        <Tooltip title={t("credits-out-body", { balance: credit?.balance ?? 0, cost: credit?.verdictCost ?? 0 })}>
          {/* A disabled MUI button fires no pointer events — the span is what
              the tooltip can actually listen on. */}
          <span className="inline-flex">
            <Button variant="outlined" color="grey" startIcon={<NiShieldCheck size="small" />} disabled>
              {t("verify-again")}
            </Button>
          </span>
        </Tooltip>
      ) : (
        <Button
          variant={reVerifyIsPrimary ? "contained" : "outlined"}
          color={reVerifyIsPrimary ? "primary" : "grey"}
          startIcon={<NiShieldCheck size="small" />}
          onClick={verify}
          disabled={busy || scanning || !product}
        >
          {busy ? t("verifying") : t("verify-again")}
        </Button>
      )}
      {/* The way out, right beside the block — never only at the top of a page
          the user has already scrolled past. */}
      {outOfBalance && (
        <Button
          variant="contained"
          color="primary"
          startIcon={<NiSparkle size="small" />}
          href="/settings/billing"
          LinkComponent={Link}
        >
          {t("credits-manage")}
        </Button>
      )}
    </>
  );

  return (
    <Grid container spacing={5} className="items-start">
      {/* Covers both entry points into generation: finishing the guided wizard
          and re-verifying from the result view. */}
      <ProcessingOverlay open={busy} title={t("verifying")} stages={stages} patienceLabel={t("stage-patience")} />
      {/* Same treatment for the scan: it is foreground work the user asked for,
          it takes tens of seconds, and its result rewrites the screen — the
          three conditions that earn a blocking overlay (.claude/rules/app-ux.md).
          `scanning` is owned here, so all three entry points (wizard step, the
          checklist's "Verificar agora", the review modal) get it at once. */}
      <ProcessingOverlay
        open={scanning}
        title={t("verifying-now")}
        stages={scanStages}
        patienceLabel={t("scan-stage-patience")}
      />
      <VerifiedCelebration
        open={celebrateOpen}
        items={justVerified}
        surface={celebrateSurface}
        onClose={() => setCelebrateOpen(false)}
      />
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

        {/* The URL names a product that no longer resolves (deleted mid-
            session, foreign id): a proper not-found, never a silently
            substituted product. */}
        {currentOrg && ready && !dataLoadError && productNotFound && (
          <Grid size={12}>
            <EmptyState
              icon={<NiTag />}
              title={t("product-not-found-title")}
              description={t("product-not-found-body")}
              action={{ label: t("product-not-found-cta"), href: "/products" }}
            />
          </Grid>
        )}

        {/* No product context: readiness has nothing to audit. */}
        {currentOrg && ready && !dataLoadError && !productNotFound && products.length === 0 && (
          <Grid size={12}>
            <EmptyState
              icon={<NiTag />}
              title={t("no-product-title")}
              description={t("no-product-body")}
              action={{ label: t("no-product-cta"), href: "/products/new" }}
            />
          </Grid>
        )}

        {/* Workspace mode has its own product switcher in the rail — this
            guidance points at the in-page selector, which only exists on the
            standalone route. */}
        {!workspace && currentOrg && ready && !dataLoadError && products.length > 1 && !product && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {t("select-product-guidance")}
            </Alert>
          </Grid>
        )}

        {error && (
          <Grid size={12}>
            <Alert severity="error" className="neutral bg-background-paper/60!">
              <Typography variant="body2">{t(`error-${error.code}`)}</Typography>
              {error.detail && (
                <Typography variant="caption" className="text-text-secondary">
                  {t("error-detail", { detail: error.detail })}
                </Typography>
              )}
            </Alert>
          </Grid>
        )}

        {notice && (
          <Grid size={12}>
            <Alert severity="info" className="neutral bg-background-paper/60!">
              {notice}
            </Alert>
          </Grid>
        )}

        {/* A failed credit read renders as a retriable error, never as a
            silently missing cost banner (P5). Gated on !dataLoadError so a
            total load failure shows ONE error, not a stack. */}
        {creditLoadFailed && !dataLoadError && (
          <Grid size={12}>
            <LoadErrorState
              title={t("credit-load-error-title")}
              description={t("credit-load-error-body")}
              retryLabel={tc("retry")}
              busy={creditRetrying}
              onRetry={() => void loadCredit()}
            />
          </Grid>
        )}

        {/* No subscription: the guided path (U4) — what happened and the one
            door out, in every flow that can hit it (verdict, how-to, assist). */}
        {noSubscription && (
          <Grid size={12}>
            <Alert severity="warning" className="neutral bg-background-paper/60!">
              <Typography variant="subtitle2">{t("no-subscription-title")}</Typography>
              <Typography variant="body2">{t("no-subscription-body")}</Typography>
              <Button
                variant="contained"
                color="primary"
                size="small"
                className="mt-2"
                href="/settings/billing"
                LinkComponent={Link}
              >
                {t("no-subscription-cta")}
              </Button>
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
                onRefreshScan={refreshScanManually}
                scanTrend={scanTrend}
                productId={product.id}
                canGenerate={canGenerate}
                scanning={scanning}
                onComplete={verify}
                busy={busy}
                credit={credit}
                saveState={saveState}
                onRetrySave={() => void persist()}
                onBeforeAdvance={() => (dirty ? persist() : Promise.resolve(true))}
                assistOffering={assistOffering}
                assistOpenItems={assistOpenItems}
                skippedItems={journey.skippedItems}
                helpOpenedItems={journey.helpOpenedItems}
                onJourneySignal={recordJourneySignal}
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
                productContextHref={`/products/${product.id}?focus=price`}
                focusRequest={focusRequest}
                onOpenItemHelp={openReviewAtItem}
              />

              {/* The payoff of re-checking, right under the verdict: what
                  moved since the previous reading. Informational chips only —
                  nothing here competes with the single-primary action bar. */}
              {rows.length > 1 && (
                <Box className="mt-3 flex flex-row flex-wrap items-center gap-1">
                  <Typography variant="body2" className="text-text-secondary mr-1">
                    {t("delta-since-last")}
                  </Typography>
                  <DeltaChips delta={compareVerdicts(rows[1].output, rows[0].output)} />
                </Box>
              )}

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
                  onClick={() => {
                    // Reopening the editor makes an old refusal stale (U8).
                    setResolveRefused(null);
                    setReviewOpen(true);
                  }}
                >
                  {t("review-answers")}
                </Button>
                {/* The creative plan is the NEXT room in the journey (context →
                    readiness → creatives → launch → diagnosis) — jumping
                    straight to the campaign diagnosis from here used to skip
                    two rooms and, worse, could land a zero-data user on a
                    screen with nothing to read. "pronto" and "quase" (zero
                    blockers, by reconcileVerdict) offer it plainly;
                    "nao_pronto" keeps a deliberate, eyes-open exit — readiness
                    advises, it never gates. */}
                {(isReady || verdictValue === "quase") && (
                  <Button
                    variant="text"
                    color="grey"
                    startIcon={<NiCamera size="small" />}
                    onClick={() => router.push(`/products/${product.id}/creatives`)}
                  >
                    {t("go-to-creatives")}
                  </Button>
                )}
                {verdictValue === "nao_pronto" && (
                  <Button
                    variant="text"
                    color="grey"
                    size="small"
                    onClick={() => router.push(`/products/${product.id}/creatives`)}
                  >
                    {t("go-anyway")}
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
            onClose={() => {
              setReviewOpen(false);
              setReviewFocus(null);
            }}
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
              <IconButton
                aria-label={t("review-close")}
                onClick={() => {
                  setReviewOpen(false);
                  setReviewFocus(null);
                }}
                className="flex-none"
              >
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
                bare
                initialFocus={reviewFocus}
                profile={profile}
                evaluation={evaluation}
                onChange={setProfile}
                scan={scan}
                hasUrl={Boolean(product.landing_page_url)}
                onScan={runScan}
                onRefreshScan={refreshScanManually}
                scanTrend={scanTrend}
                productId={product.id}
                canGenerate={canGenerate}
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
                skippedItems={journey.skippedItems}
                helpOpenedItems={journey.helpOpenedItems}
                onJourneySignal={recordJourneySignal}
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
            <ReadinessHistory
              rows={history}
              expandedId={historyExpandedId}
              onExpandedChange={setHistoryExpandedId}
              // 6 fetched, 5 shown: a full fetch means the last visible row
              // still has an older, unfetched predecessor.
              hasOlderPredecessor={rows.length === 6}
            />
          </Grid>
        )}

        {/* No dead end at the bottom: the handoff to whatever comes after
            this screen, read from the same queue the rail shows. */}
        {workspace && (
          <Grid size={12}>
            <NextTaskCard skipSource="readiness" />
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}

export default function ReadinessPage() {
  return <ReadinessExperience />;
}
