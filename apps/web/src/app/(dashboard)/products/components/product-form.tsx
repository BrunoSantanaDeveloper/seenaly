"use client";

import { saveProduct } from "../actions";
import {
  type CompletenessField,
  computeCompleteness,
  type ContextSection,
  SECTION_BY_FIELD,
  sectionCompleteness,
} from "../lib/completeness";
import { clearDraft, isWorthSaving, loadDraft, saveDraft } from "../lib/draft";
import type { ProductInput, ProductStatus, ProductWithChildren } from "../types";
import { FormikProvider, useFormik } from "formik";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import * as yup from "yup";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormLabel,
  Input,
  LinearProgress,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";

import { NumericMaskInput, useCurrencySeparators } from "@/components/product/fields";
import HelpDisclosure from "@/components/product/help-disclosure";
import OptionalFieldGroup, { type OptionalField } from "@/components/product/optional-fields";
import SetupWizard, { type WizardStep } from "@/components/product/setup-wizard";
import NiBinEmpty from "@/icons/nexture/ni-bin-empty";
import NiCheck from "@/icons/nexture/ni-check";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";
import NiCross from "@/icons/nexture/ni-cross";
import NiPlus from "@/icons/nexture/ni-plus";
import { track } from "@/lib/analytics";
import { CONVERSION_TYPES, CREATIVE_FUNNEL_STAGES } from "@/lib/creative-taxonomy";
import {
  BILLING_PERIODS,
  type BillingPeriod,
  derivePricing,
  PRICING_MODEL_SPECS,
  PRICING_MODELS,
  type PricingInputs,
  type PricingInputSpec,
  type PricingModel,
  type PricingPlanRow,
} from "@/lib/pricing";
import { createClient } from "@flyee/auth/client";

interface FormValues {
  name: string;
  status: ProductStatus;
  description: string;
  currency: string;
  price: string;
  unitCost: string;
  marginPct: string;
  avgTicket: string;
  ltv: string;
  targetCac: string;
  monthlyBudget: string;
  conversionType: string;
  funnelStage: string;
  audience: string;
  mainPromise: string;
  landingPageUrl: string;
  landingConversionRate: string;
  optimizationEvent: string;
  notes: string;
  connectionId: string;
  metaAccountId: string;
  objections: string[];
  proofs: { kind: string; content: string }[];
  // Charging model — numbers stay strings while editing (masked inputs).
  pricingModel: string;
  pricingInputs: Record<string, string>;
  plans: PlanFormRow[];
}

/**
 * Fields whose presence means "this form is worth keeping". Deliberately the
 * ones a human types, not the defaults the form ships with (status, currency),
 * which would make every untouched visit look like real work in progress.
 */
const DRAFT_MEANINGFUL_FIELDS = [
  "name",
  "mainPromise",
  "audience",
  "description",
  "price",
  "landingPageUrl",
  "objections",
  "proofs",
  "plans",
];

/** A pricing row while being edited (tier / pack / ladder item). */
interface PlanFormRow {
  name: string;
  price: string;
  period: string;
  quantity: string;
  sharePct: string;
  isPrimary: boolean;
}

// Meta's official pixel/CAPI standard events (trust-1 vocabulary) — offered as
// suggestions so the optimization event converges on canonical names; freeSolo
// still allows custom conversions.
const META_PIXEL_EVENTS = [
  "Purchase",
  "Lead",
  "InitiateCheckout",
  "ViewContent",
  "AddToCart",
  "AddPaymentInfo",
  "CompleteRegistration",
  "Subscribe",
  "StartTrial",
  "Contact",
];

// Formik parses type="number" inputs to float, so at runtime these "string"
// fields can hold numbers — normalize before trimming.
const toNum = (value: string | number): number | null => {
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};
const fromNum = (value: number | null | undefined): string =>
  value === null || value === undefined ? "" : String(value);

function initialValues(product?: ProductWithChildren): FormValues {
  return {
    name: product?.name ?? "",
    // New products start "active" so they read as real/usable immediately.
    status: product?.status ?? "active",
    description: product?.description ?? "",
    currency: product?.currency ?? "BRL",
    price: fromNum(product?.price),
    unitCost: fromNum(product?.unitCost),
    marginPct: fromNum(product?.marginPct),
    avgTicket: fromNum(product?.avgTicket),
    ltv: fromNum(product?.ltv),
    targetCac: fromNum(product?.targetCac),
    monthlyBudget: fromNum(product?.monthlyBudget),
    conversionType: product?.conversionType ?? "",
    funnelStage: product?.funnelStage ?? "",
    audience: product?.audience ?? "",
    mainPromise: product?.mainPromise ?? "",
    landingPageUrl: product?.landingPageUrl ?? "",
    landingConversionRate: fromNum(product?.landingConversionRate),
    optimizationEvent: product?.optimizationEvent ?? "",
    notes: product?.notes ?? "",
    connectionId: product?.connectionId ?? "",
    metaAccountId: product?.metaAccountId ?? "",
    objections: product?.objections?.length ? product.objections : [],
    proofs: product?.proofs?.length ? product.proofs : [],
    pricingModel: product?.pricingModel ?? "",
    pricingInputs: Object.fromEntries(
      Object.entries(product?.pricingInputs ?? {}).map(([key, value]) => [key, fromNum(value as number | null)]),
    ),
    plans: (product?.plans ?? []).map((plan) => ({
      name: plan.name,
      price: fromNum(plan.price),
      period: plan.period,
      quantity: fromNum(plan.quantity),
      sharePct: fromNum(plan.sharePct),
      isPrimary: plan.isPrimary,
    })),
  };
}

/** Form rows → the domain shape the pricing engine reasons with. */
function toPlanRows(rows: PlanFormRow[]): PricingPlanRow[] {
  return rows.map((row) => ({
    name: row.name,
    price: toNum(row.price),
    period: (row.period || "") as BillingPeriod | "",
    quantity: toNum(row.quantity),
    sharePct: toNum(row.sharePct),
    isPrimary: row.isPrimary,
  }));
}

function toPricingInputs(inputs: Record<string, string>): PricingInputs {
  return Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, toNum(value)]));
}

function toInput(values: FormValues, orgId: string, id?: string): ProductInput {
  const typedPrice = toNum(values.price);
  const unitCost = toNum(values.unitCost);
  // Derive margin from price + cost when the user didn't type it — don't ask
  // for the same thing twice (the engine still gets a margin to reason with).
  let marginPct = toNum(values.marginPct);
  if (marginPct == null && typedPrice != null && typedPrice > 0 && unitCost != null) {
    marginPct = Math.round(((typedPrice - unitCost) / typedPrice) * 100);
  }

  // The charging model derives the economics the engine reads. A value the user
  // typed always wins over the derivation.
  const plans = toPlanRows(values.plans);
  const pricingInputs = toPricingInputs(values.pricingInputs);
  const derived = derivePricing({
    model: (values.pricingModel || "") as PricingModel | "",
    plans,
    inputs: pricingInputs,
    marginPct,
  });

  return {
    id,
    orgId,
    name: values.name,
    status: values.status,
    description: values.description,
    currency: values.currency,
    price: typedPrice ?? derived.referencePrice,
    unitCost,
    marginPct,
    avgTicket: toNum(values.avgTicket) ?? derived.avgTicket,
    ltv: toNum(values.ltv) ?? derived.ltv,
    targetCac: toNum(values.targetCac) ?? derived.targetCac,
    monthlyBudget: toNum(values.monthlyBudget),
    pricingModel: values.pricingModel,
    pricingInputs,
    plans,
    conversionType: values.conversionType,
    funnelStage: values.funnelStage,
    audience: values.audience,
    mainPromise: values.mainPromise,
    landingPageUrl: values.landingPageUrl,
    landingConversionRate: toNum(values.landingConversionRate),
    optimizationEvent: values.optimizationEvent,
    notes: values.notes,
    connectionId: values.connectionId || null,
    metaAccountId: values.metaAccountId,
    objections: values.objections,
    proofs: values.proofs,
  };
}

/**
 * Capture the product context — the heart of the product (docs/PRODUCT.md).
 *
 * `variant="wizard"` (first-run creation): progressive disclosure, one block
 * per screen with a progress rail, so a long context capture never feels long.
 * `variant="sections"` (editing): everything at once plus the completeness
 * meter — competence feedback on how much context the engine has to reason with.
 * The two never stack progress mechanics.
 */
export default function ProductForm({
  orgId,
  product,
  variant = "sections",
  onSaveSuccess,
  focusField = null,
}: {
  orgId: string;
  product?: ProductWithChildren;
  variant?: "sections" | "wizard";
  onSaveSuccess?: (productId: string) => Promise<void> | void;
  /**
   * A request (from a sibling card, e.g. the next-step suggestions) to open the
   * section holding `field` and scroll to it. `nonce` lets the same field be
   * requested twice in a row.
   */
  focusField?: { field: CompletenessField; nonce: number } | null;
}) {
  const t = useTranslations("products");
  // Funnel labels are shared with the Organic module (one funnel language).
  const tf = useTranslations("organicGrowth");
  // A draft only exists for a NEW product: when editing, the saved row is the
  // truth and a competing local copy would just raise "which one is real?".
  const draftsEnabled = variant === "wizard" && !product?.id;
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const separators = useCurrencySeparators();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<{ id: string; name: string }[]>([]);

  const nonNegative = useMemo(
    () => (max?: number) =>
      yup.string().test("non-negative", t("error-number"), (value) => {
        if (!value || value.trim() === "") return true;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 && (max === undefined || parsed <= max);
      }),
    [t],
  );

  const validationSchema = useMemo(
    () =>
      yup.object({
        name: yup.string().trim().required(t("error-name-required")),
        price: nonNegative(),
        unitCost: nonNegative(),
        marginPct: nonNegative(100),
        avgTicket: nonNegative(),
        ltv: nonNegative(),
        targetCac: nonNegative(),
        monthlyBudget: nonNegative(),
        landingConversionRate: nonNegative(100),
        landingPageUrl: yup
          .string()
          .test("url", t("error-url"), (value) => !value || /^https?:\/\/.+/.test(value.trim())),
      }),
    [nonNegative, t],
  );

  const formik = useFormik<FormValues>({
    initialValues: initialValues(product),
    validationSchema,
    validateOnBlur: true,
    validateOnMount: false,
    onSubmit: async (values) => {
      setError(null);
      // The server action can fail as a REJECTION, not just an { ok: false }:
      // a dropped connection, or a stale client bundle whose action id no
      // longer exists in the current deployment (that one answers 404). Without
      // this catch the promise rejected, Formik swallowed it, and the user got
      // a dead button with no message at all — the worst possible outcome for
      // someone who just typed a long form.
      try {
        const result = await saveProduct(toInput(values, orgId, product?.id));
        if (!result.ok) {
          setError(result.error);
          return;
        }
        // Saved for real — the crash pad has served its purpose. Clearing here
        // (not on navigation) means a failed save always keeps the draft.
        if (draftsEnabled) clearDraft(window.localStorage, orgId);
        if (!product?.id) {
          track("product_created");
          if (onSaveSuccess) {
            await onSaveSuccess(result.id);
          } else {
            // A first-timer used to be dropped straight into the 9-step
            // readiness wizard the instant they saved — an ambush, and the
            // reason a real user asked "wasn't this supposed to change?".
            // Now the first product gets a short, opt-in landing that says
            // what comes next and what it costs; anyone who has already been
            // through the journey keeps the direct route. Decided BEFORE
            // navigating so there is no redirect flash.
            const supabase = createClient();
            const { count, error: countError } = await supabase
              .from("products")
              .select("id", { count: "exact", head: true })
              .eq("org_id", orgId);
            // Count unavailable → treat as a returning user: the direct route
            // is the safe default (it is the behaviour that already shipped).
            const isFirstProduct = !countError && (count ?? 0) <= 1;
            router.push(isFirstProduct ? `/products/${result.id}?started=1` : `/products/${result.id}/readiness?new=1`);
          }
        } else {
          if (onSaveSuccess) {
            await onSaveSuccess(result.id);
          } else {
            router.push(`/products/${result.id}`);
          }
        }
        router.refresh();
      } catch {
        // Deliberately does NOT clear the form: everything they typed is still
        // on screen, so "try again" costs one click rather than a refill.
        setError(t("error-save-unreachable"));
      }
    },
  });

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("connections")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("provider", "meta-ads")
      .then(({ data }) => setConnections(data ?? []));
  }, [orgId]);

  // Restore once, on mount. Restoring is announced (never silent) and undoable
  // via "começar do zero" — a user who deliberately abandoned a form must not
  // be quietly handed it back with no way out.
  useEffect(() => {
    if (!draftsEnabled) return;
    const draft = loadDraft<FormValues>(window.localStorage, orgId);
    if (!draft) return;
    formik.setValues(draft.values);
    setRestoredAt(draft.savedAt);
    // Mount-only by design: re-running would fight the user's own typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftsEnabled, orgId]);

  // Persist while they type. Debounced so a long form is not a write storm,
  // and gated on `isWorthSaving` so an untouched visit leaves no crumb.
  useEffect(() => {
    if (!draftsEnabled) return;
    const timeout = window.setTimeout(() => {
      if (isWorthSaving(formik.values as unknown as Record<string, unknown>, DRAFT_MEANINGFUL_FIELDS)) {
        saveDraft(window.localStorage, orgId, formik.values);
      }
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [draftsEnabled, orgId, formik.values]);

  const CURRENCY_SYMBOLS: Record<string, string> = { BRL: "R$", USD: "$", EUR: "€" };
  const currencySymbol = CURRENCY_SYMBOLS[formik.values.currency?.toUpperCase()] ?? formik.values.currency;

  const completeness = computeCompleteness(toInput(formik.values, orgId, product?.id));

  // Sections render collapsed by default (compact overview; each summary shows
  // its own fill state, so the gaps stay visible without opening anything).
  // A missing-field chip — here or on the next-step card — opens the exact
  // section and scrolls to it: "you're missing X" must never mean "now hunt
  // for where X lives".
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const openSection = (section: ContextSection) => {
    setExpandedSections((previous) => new Set(previous).add(section));
    window.setTimeout(() => {
      document.getElementById(`context-section-${section}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };
  const toggleSection = (section: string) =>
    setExpandedSections((previous) => {
      const next = new Set(previous);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });

  useEffect(() => {
    if (focusField) openSection(SECTION_BY_FIELD[focusField.field]);
  }, [focusField]);

  // A failed submit must never hide its own error inside a collapsed section —
  // open everything so the inline message is on screen.
  useEffect(() => {
    if (formik.submitCount > 0 && !formik.isValid) {
      setExpandedSections(new Set(["identity", "offer", "economics", "funnel", "meta"]));
    }
  }, [formik.submitCount, formik.isValid]);

  const text = (
    name: keyof FormValues,
    label: string,
    opts: {
      multiline?: boolean;
      type?: string;
      mask?: "money" | "integer" | "percent";
      adornment?: string;
      /** One-line example/explanation under the field (teaches where to get it). */
      hint?: string;
    } = {},
  ) => {
    const err = formik.touched[name] && (formik.errors[name] as string | undefined);
    return (
      <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth error={Boolean(err)}>
        <FormLabel component="label">{label}</FormLabel>
        <Input
          name={name}
          type={opts.mask ? "text" : (opts.type ?? "text")}
          multiline={opts.multiline}
          rows={opts.multiline ? 3 : undefined}
          value={formik.values[name] as string}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          inputComponent={opts.mask ? (NumericMaskInput as never) : undefined}
          inputProps={
            opts.mask
              ? {
                  thousand: separators.thousand,
                  decimal: separators.decimal,
                  decimalScale: opts.mask === "integer" ? 0 : 2,
                  inputMode: opts.mask === "integer" ? "numeric" : "decimal",
                }
              : undefined
          }
          startAdornment={opts.mask === "money" && opts.adornment ? opts.adornment : undefined}
          endAdornment={opts.mask === "percent" ? "%" : undefined}
        />
        {err ? (
          <Typography variant="body2" className="text-error mt-0.5">
            {err}
          </Typography>
        ) : opts.hint ? (
          <Typography variant="body2" className="text-text-secondary mt-0.5">
            {opts.hint}
          </Typography>
        ) : null}
      </FormControl>
    );
  };

  // Canonical taxonomy select: stores a slug, renders a localized label, and
  // keeps any legacy free-text value selectable until the user picks a slug.
  const taxSelect = (
    name: keyof FormValues,
    label: string,
    options: readonly string[],
    labelFor: (slug: string) => string,
  ) => {
    const value = formik.values[name] as string;
    const isLegacy = value !== "" && !options.includes(value);
    return (
      <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth>
        <FormLabel component="label">{label}</FormLabel>
        <Select
          name={name}
          value={value}
          displayEmpty
          variant="standard"
          IconComponent={NiChevronDownSmall}
          onChange={formik.handleChange}
          renderValue={(v) => {
            const sv = v as string;
            if (sv === "") return <span className="text-text-secondary">{t("taxonomy-unset")}</span>;
            return options.includes(sv) ? labelFor(sv) : sv;
          }}
        >
          <MenuItem value="">{t("taxonomy-unset")}</MenuItem>
          {isLegacy && <MenuItem value={value}>{value}</MenuItem>}
          {options.map((slug) => (
            <MenuItem key={slug} value={slug}>
              {labelFor(slug)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  };

  // ---- Field nodes, composed differently per variant ----

  const nameField = text("name", t("field-name"));
  const descriptionField = text("description", t("field-description"), { multiline: true });
  const statusField = (
    <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth>
      <FormLabel component="label">{t("field-status")}</FormLabel>
      <Select
        name="status"
        value={formik.values.status}
        variant="standard"
        IconComponent={NiChevronDownSmall}
        onChange={formik.handleChange}
      >
        <MenuItem value="draft">{t("status-draft")}</MenuItem>
        <MenuItem value="active">{t("status-active")}</MenuItem>
        <MenuItem value="archived">{t("status-archived")}</MenuItem>
      </Select>
    </FormControl>
  );
  const promiseField = text("mainPromise", t("field-mainPromise"), { multiline: true, hint: t("hint-mainPromise") });
  const audienceField = text("audience", t("field-audience"), { multiline: true, hint: t("hint-audience") });

  const currencySelect = (
    <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth>
      <FormLabel component="label">{t("field-currency")}</FormLabel>
      <Select
        name="currency"
        value={formik.values.currency}
        variant="standard"
        IconComponent={NiChevronDownSmall}
        onChange={formik.handleChange}
      >
        {["BRL", "USD", "EUR"].map((code) => (
          <MenuItem key={code} value={code}>
            {code}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  // "Mark what you know": economic context is opt-in, never a wall of numbers.
  const money = (name: keyof FormValues) =>
    text(name, t(`field-${name}`), { mask: "money", adornment: currencySymbol, hint: t(`hint-${name}`) });
  const numberFields: OptionalField[] = [
    { key: "price", chipLabel: t("field-price"), filled: formik.values.price !== "", node: money("price") },
    {
      key: "avgTicket",
      chipLabel: t("field-avgTicket"),
      filled: formik.values.avgTicket !== "",
      node: money("avgTicket"),
    },
    {
      key: "targetCac",
      chipLabel: t("field-targetCac"),
      filled: formik.values.targetCac !== "",
      node: money("targetCac"),
    },
    {
      key: "monthlyBudget",
      chipLabel: t("field-monthlyBudget"),
      filled: formik.values.monthlyBudget !== "",
      node: money("monthlyBudget"),
    },
    {
      key: "marginPct",
      chipLabel: t("field-marginPct"),
      filled: formik.values.marginPct !== "",
      node: text("marginPct", t("field-marginPct"), { mask: "percent", hint: t("hint-marginPct") }),
    },
    { key: "unitCost", chipLabel: t("field-unitCost"), filled: formik.values.unitCost !== "", node: money("unitCost") },
    { key: "ltv", chipLabel: t("field-ltv"), filled: formik.values.ltv !== "", node: money("ltv") },
  ];
  // Margin derived from price + cost — shown read-only so we don't ask twice.
  const derivedMargin = (() => {
    const p = toNum(formik.values.price);
    const c = toNum(formik.values.unitCost);
    return p != null && p > 0 && c != null ? Math.round(((p - c) / p) * 100) : null;
  })();
  // ---- Charging model: the user states FACTS, the system derives economics ----

  const pricingModel = (formik.values.pricingModel || "") as PricingModel | "";
  const pricingSpec = pricingModel && pricingModel !== "other" ? PRICING_MODEL_SPECS[pricingModel] : null;
  const moneyFmt = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: formik.values.currency || "BRL",
  });

  const maskedInput = (
    value: string,
    onChange: (next: string) => void,
    opts: { mask: PricingInputSpec["type"]; placeholder?: string; className?: string },
  ) => (
    <Input
      className={opts.className}
      placeholder={opts.placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputComponent={NumericMaskInput as never}
      inputProps={{
        thousand: separators.thousand,
        decimal: separators.decimal,
        decimalScale: opts.mask === "integer" ? 0 : 2,
        inputMode: opts.mask === "integer" ? "numeric" : "decimal",
      }}
      startAdornment={opts.mask === "money" ? currencySymbol : undefined}
      endAdornment={opts.mask === "percent" ? "%" : undefined}
    />
  );

  const modelChooser = (
    <Box className="flex flex-col gap-1.5">
      <Typography variant="body2" className="text-text-secondary">
        {t("pricing-model-question")}
      </Typography>
      <Box className="flex flex-row flex-wrap gap-1.5">
        {PRICING_MODELS.map((model) => (
          <Chip
            key={model}
            label={t(`model-${model}`)}
            variant={pricingModel === model ? "filled" : "outlined"}
            color="primary"
            className="cursor-pointer"
            onClick={() => formik.setFieldValue("pricingModel", pricingModel === model ? "" : model)}
          />
        ))}
      </Box>
    </Box>
  );

  const rowsSpec = pricingSpec?.rows;
  const primaryIndex = formik.values.plans.findIndex((plan) => plan.isPrimary);
  const plansEditor = rowsSpec ? (
    <Box className="flex flex-col gap-2">
      <ListEditor
        label={t(`rows-${rowsSpec.kind}`)}
        addLabel={t(`rows-add-${rowsSpec.kind}`)}
        removeLabel={t("remove-field")}
        items={formik.values.plans}
        onChange={(next) => formik.setFieldValue("plans", next)}
        render={(row, onChange) => (
          <Box className="flex grow flex-col gap-1 sm:flex-row">
            {rowsSpec.fields.includes("name") && (
              <Input
                className="sm:w-36"
                placeholder={t("plan-name")}
                value={row.name}
                onChange={(event) => onChange({ ...row, name: event.target.value })}
              />
            )}
            {rowsSpec.fields.includes("price") &&
              maskedInput(row.price, (value) => onChange({ ...row, price: value }), {
                mask: "money",
                placeholder: t("plan-price"),
                className: "sm:w-32",
              })}
            {rowsSpec.fields.includes("period") && (
              <Select
                className="sm:w-36"
                value={row.period}
                displayEmpty
                variant="standard"
                IconComponent={NiChevronDownSmall}
                onChange={(event) => onChange({ ...row, period: event.target.value as string })}
                renderValue={(value) => (value ? t(`period-${value as string}`) : t("plan-period"))}
              >
                {BILLING_PERIODS.map((period) => (
                  <MenuItem key={period} value={period}>
                    {t(`period-${period}`)}
                  </MenuItem>
                ))}
              </Select>
            )}
            {rowsSpec.fields.includes("quantity") &&
              maskedInput(row.quantity, (value) => onChange({ ...row, quantity: value }), {
                mask: "integer",
                placeholder: t("plan-quantity"),
                className: "sm:w-28",
              })}
            {rowsSpec.fields.includes("sharePct") &&
              maskedInput(row.sharePct, (value) => onChange({ ...row, sharePct: value }), {
                mask: "percent",
                placeholder: t("plan-share"),
                className: "sm:w-28",
              })}
          </Box>
        )}
        empty={() => ({
          name: "",
          price: "",
          period: rowsSpec.kind === "plans" ? "monthly" : "",
          quantity: "",
          sharePct: "",
          isPrimary: false,
        })}
      />
      {/* Which row the ad anchors on — drives the reference price. */}
      {formik.values.plans.length > 1 && (
        <FormControl className="outlined" variant="standard" size="small" fullWidth>
          <FormLabel component="label">{t("plan-primary")}</FormLabel>
          <Select
            value={primaryIndex >= 0 ? String(primaryIndex) : ""}
            displayEmpty
            variant="standard"
            IconComponent={NiChevronDownSmall}
            renderValue={(value) => {
              const index = Number(value);
              if (value === "" || Number.isNaN(index) || !formik.values.plans[index]) return t("plan-primary-none");
              const row = formik.values.plans[index];
              return row.name || row.price || `#${index + 1}`;
            }}
            onChange={(event) => {
              const index = Number(event.target.value);
              formik.setFieldValue(
                "plans",
                formik.values.plans.map((plan, i) => ({ ...plan, isPrimary: i === index })),
              );
            }}
          >
            {formik.values.plans.map((plan, index) => (
              <MenuItem key={index} value={String(index)}>
                {plan.name || plan.price || `#${index + 1}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Box>
  ) : null;

  const pricingScalarFields: OptionalField[] = (pricingSpec?.inputs ?? []).map((input) => ({
    key: input.key,
    chipLabel: t(`pinput-${input.key}`),
    filled: (formik.values.pricingInputs[input.key] ?? "") !== "",
    node: (
      <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth>
        <FormLabel component="label">{t(`pinput-${input.key}`)}</FormLabel>
        {maskedInput(
          formik.values.pricingInputs[input.key] ?? "",
          (value) => formik.setFieldValue(`pricingInputs.${input.key}`, value),
          { mask: input.type },
        )}
      </FormControl>
    ),
  }));

  // What the engine will actually use — shown with the math, always overridable.
  const derivedEconomics = derivePricing({
    model: pricingModel,
    plans: toPlanRows(formik.values.plans),
    inputs: toPricingInputs(formik.values.pricingInputs),
    marginPct: toNum(formik.values.marginPct) ?? derivedMargin,
    formatMoney: (value) => moneyFmt.format(value),
  });

  const derivedStat = (label: string, value: number | null) =>
    value == null ? null : (
      <Box className="flex flex-col">
        <Typography variant="body2" className="text-text-secondary">
          {label}
        </Typography>
        <Typography variant="subtitle1">{moneyFmt.format(value)}</Typography>
      </Box>
    );

  const derivedSummary =
    derivedEconomics.targetCac != null ? (
      <Card variant="outlined">
        <CardContent className="flex flex-col gap-2">
          <Typography variant="subtitle2">{t("derived-title")}</Typography>
          <Box className="flex flex-row flex-wrap gap-x-6 gap-y-2">
            {derivedStat(t("derived-reference"), derivedEconomics.referencePrice)}
            {derivedStat(t("derived-ticket"), derivedEconomics.avgTicket)}
            {derivedStat(t("derived-ltv"), derivedEconomics.ltv)}
            {derivedStat(t("derived-cac"), derivedEconomics.targetCac)}
            {derivedStat(t("derived-cost-per-lead"), derivedEconomics.maxCostPerLead)}
          </Box>
          {derivedEconomics.paybackMonths != null && (
            <Typography variant="body2" className="text-text-secondary">
              {t("derived-payback", { months: derivedEconomics.paybackMonths })}
            </Typography>
          )}
          <HelpDisclosure label={t("derived-how")} className="mb-0">
            <Box component="ul" className="m-0 flex flex-col gap-1 pl-4">
              {derivedEconomics.explain.map((step, index) => (
                <li key={index}>{t(step.key, step.values)}</li>
              ))}
            </Box>
          </HelpDisclosure>
        </CardContent>
      </Card>
    ) : null;

  const numbersBlock = (
    <Box className="flex flex-col gap-3">
      {modelChooser}
      {currencySelect}
      {plansEditor}
      {pricingScalarFields.length > 0 && (
        <OptionalFieldGroup
          fields={pricingScalarFields}
          onRemove={(key) => formik.setFieldValue(`pricingInputs.${key}`, "")}
          removeLabel={t("remove-field")}
          addHint={t("numbers-add-hint")}
        />
      )}
      {derivedSummary}
      <OptionalFieldGroup
        fields={numberFields}
        onRemove={(key) => formik.setFieldValue(key, "")}
        removeLabel={t("remove-field")}
        addHint={pricingSpec ? t("override-hint") : t("numbers-add-hint")}
      />
      {derivedMargin != null && formik.values.marginPct === "" && (
        <Typography variant="body2" className="text-text-secondary">
          {t("margin-estimated", { pct: derivedMargin })}
        </Typography>
      )}
    </Box>
  );

  const optimizationEventField = (
    <FormControl className="outlined mb-3" variant="standard" size="small" fullWidth>
      <FormLabel component="label">{t("field-optimizationEvent")}</FormLabel>
      <Autocomplete
        freeSolo
        options={META_PIXEL_EVENTS}
        inputValue={formik.values.optimizationEvent}
        onInputChange={(_, value) => formik.setFieldValue("optimizationEvent", value)}
        popupIcon={<NiChevronDownSmall />}
        clearIcon={<NiCross />}
        slotProps={{ popper: { className: "outlined" } }}
        renderInput={(params) => (
          <TextField {...params} name="optimizationEvent" variant="standard" className="outlined" />
        )}
      />
    </FormControl>
  );
  const funnelFields: OptionalField[] = [
    {
      key: "conversionType",
      chipLabel: t("field-conversionType"),
      filled: formik.values.conversionType !== "",
      node: taxSelect("conversionType", t("field-conversionType"), CONVERSION_TYPES, (slug) => t(`conversion-${slug}`)),
    },
    {
      key: "funnelStage",
      chipLabel: t("field-funnelStage"),
      filled: formik.values.funnelStage !== "",
      node: taxSelect("funnelStage", t("field-funnelStage"), CREATIVE_FUNNEL_STAGES, (slug) => tf(`funnel-${slug}`)),
    },
    {
      key: "landingPageUrl",
      chipLabel: t("field-landingPageUrl"),
      filled: formik.values.landingPageUrl !== "",
      node: text("landingPageUrl", t("field-landingPageUrl"), { type: "url", hint: t("hint-landingPageUrl") }),
    },
    {
      key: "landingConversionRate",
      chipLabel: t("field-landingConversionRate"),
      filled: formik.values.landingConversionRate !== "",
      node: text("landingConversionRate", t("field-landingConversionRate"), { mask: "percent" }),
    },
    {
      key: "optimizationEvent",
      chipLabel: t("field-optimizationEvent"),
      filled: formik.values.optimizationEvent !== "",
      node: optimizationEventField,
    },
  ];

  const objectionsEditor = (
    <ListEditor
      label={t("field-objections")}
      addLabel={t("add-objection")}
      removeLabel={t("remove-field")}
      items={formik.values.objections}
      onChange={(next) => formik.setFieldValue("objections", next)}
      render={(value, onChange) => <Input fullWidth value={value} onChange={(e) => onChange(e.target.value)} />}
      empty={() => ""}
    />
  );
  const proofsEditor = (
    <ListEditor
      label={t("field-proofs")}
      addLabel={t("add-proof")}
      removeLabel={t("remove-field")}
      items={formik.values.proofs}
      onChange={(next) => formik.setFieldValue("proofs", next)}
      render={(value, onChange) => (
        <Box className="flex grow flex-col gap-1 sm:flex-row">
          <Input
            className="sm:w-40"
            placeholder={t("field-proof-kind")}
            value={value.kind}
            onChange={(e) => onChange({ ...value, kind: e.target.value })}
          />
          <Input
            fullWidth
            placeholder={t("field-proof-content")}
            value={value.content}
            onChange={(e) => onChange({ ...value, content: e.target.value })}
          />
        </Box>
      )}
      empty={() => ({ kind: "", content: "" })}
    />
  );
  const notesField = text("notes", t("field-notes"), { multiline: true });

  const sellingBlock = (
    <Box className="flex flex-col gap-4">
      <OptionalFieldGroup
        fields={funnelFields}
        onRemove={(key) => formik.setFieldValue(key, "")}
        removeLabel={t("remove-field")}
        addHint={t("funnel-add-hint")}
      />
      {objectionsEditor}
      {proofsEditor}
    </Box>
  );

  const metaField = (
    <FormControl className="outlined" variant="standard" size="small" fullWidth>
      <FormLabel component="label">{t("field-connection")}</FormLabel>
      <Select
        name="connectionId"
        value={formik.values.connectionId}
        variant="standard"
        displayEmpty
        IconComponent={NiChevronDownSmall}
        onChange={formik.handleChange}
      >
        <MenuItem value="">{t("connection-none")}</MenuItem>
        {connections.map((connection) => (
          <MenuItem key={connection.id} value={connection.id}>
            {connection.name}
          </MenuItem>
        ))}
      </Select>
      {connections.length === 0 && (
        <Typography variant="body2" className="text-text-secondary mt-1">
          {t("connection-hint")}
        </Typography>
      )}
    </FormControl>
  );

  /**
   * Free-text extras the creation wizard never asks for. They used to render
   * as permanently blank inputs here, so someone who had just finished the
   * wizard met fields nobody had ever mentioned — reading as work left undone.
   * Behind the same opt-in chips as every other optional field: shown when
   * they hold something, a chip when they don't.
   */
  const extraTextFields: OptionalField[] = [
    {
      key: "description",
      chipLabel: t("field-description"),
      filled: formik.values.description !== "",
      node: descriptionField,
    },
    { key: "notes", chipLabel: t("field-notes"), filled: formik.values.notes !== "", node: notesField },
  ];

  // Edit view shows everything at once (grouped), decluttered by the same opt-in
  // chips: filled fields render, empty optional ones stay behind "add" chips.
  const sectionCards = [
    {
      key: "identity",
      title: t("section-identity"),
      content: (
        <>
          {nameField}
          {statusField}
          <OptionalFieldGroup
            fields={extraTextFields}
            onRemove={(key) => formik.setFieldValue(key, "")}
            removeLabel={t("remove-field")}
            addHint={t("extras-add-hint")}
          />
        </>
      ),
    },
    {
      key: "offer",
      title: t("section-positioning"),
      content: (
        <>
          {promiseField}
          {audienceField}
        </>
      ),
    },
    { key: "economics", title: t("section-economics"), content: numbersBlock },
    { key: "funnel", title: t("section-funnel"), content: sellingBlock },
    // Only when there is something to actually pick (or something already
    // picked). With no Meta connection on the org this section was a dead
    // control plus a hint pointing elsewhere — and the maturity-spectrum
    // invariant (docs/PRODUCT.md #6) says the Meta connection must never be
    // staged as a prerequisite. Connecting lives in Settings › Connections.
    ...(connections.length > 0 || formik.values.connectionId
      ? [{ key: "meta", title: t("section-meta"), content: metaField }]
      : []),
  ];

  // An error the reader never sees is the same as no error at all: in the
  // wizard this alert sits above a tall form, and the submit button is at the
  // bottom — so bring it into view when it appears.
  const errorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  const errorAlert = error && (
    <Alert ref={errorRef} severity="error" className="neutral bg-background-paper/60! mb-4">
      {error}
    </Alert>
  );

  /**
   * Restoring is ANNOUNCED and UNDOABLE. Silently repopulating a form the user
   * had abandoned is a small betrayal — they asked for a blank page and got
   * someone else's leftovers — so say what happened and offer the way back.
   */
  const draftAlert = restoredAt != null && !draftDismissed && (
    <Alert
      severity="info"
      className="neutral bg-background-paper/60! mb-4"
      action={
        <Button
          color="grey"
          size="small"
          onClick={() => {
            clearDraft(window.localStorage, orgId);
            formik.resetForm({ values: initialValues() });
            setDraftDismissed(true);
            setRestoredAt(null);
          }}
        >
          {t("draft-discard")}
        </Button>
      }
    >
      {t("draft-restored", { when: new Date(restoredAt).toLocaleString() })}
    </Alert>
  );

  // ---- Wizard: minimal required path, everything else opt-in ----
  // Step 1 (name + promise + audience) is all a beginner needs; steps 2–3 are
  // optional and "Concluir agora" lets them finish without touching numbers.
  if (variant === "wizard") {
    const nameValid = formik.values.name.trim().length > 0;
    const steps: WizardStep[] = [
      {
        title: t("step-offer-title"),
        hint: t("step-offer-hint"),
        content: (
          <>
            {/* Resolve the recurring "is each plan a product?" doubt in place. */}
            <HelpDisclosure label={t("help-plans-title")}>{t("help-plans-body")}</HelpDisclosure>
            {nameField}
            {promiseField}
            {audienceField}
          </>
        ),
        canAdvance: nameValid,
      },
      { title: t("step-numbers-title"), hint: t("step-numbers-hint"), content: numbersBlock },
      { title: t("step-selling-title"), hint: t("step-selling-hint"), content: sellingBlock },
    ];

    return (
      <FormikProvider value={formik}>
        {draftAlert}
        {errorAlert}
        <SetupWizard
          steps={steps}
          onComplete={() => formik.submitForm()}
          onFinishEarly={() => formik.submitForm()}
          finishEarlyLabel={t("wizard-finish-now")}
          completeLabel={formik.isSubmitting ? t("saving") : t("wizard-finish")}
          backLabel={t("wizard-back")}
          continueLabel={t("wizard-continue")}
          stepLabel={(current, total) => t("wizard-step", { current, total })}
        />
      </FormikProvider>
    );
  }

  // ---- Sections: compact accordion overview + completeness (competence feedback) ----
  return (
    <FormikProvider value={formik}>
      <Box component="form" onSubmit={formik.handleSubmit} className="flex flex-col">
        <Card className="mb-5">
          <CardContent className="flex flex-col gap-2">
            <Box className="flex flex-row items-center gap-3">
              <Typography variant="subtitle2" className="grow">
                {t("completeness-title")}
              </Typography>
              <Typography variant="subtitle2" className="text-primary">
                {completeness.score}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={completeness.score} />
            {/* Every missing field, each one a door: click → the section holding
                it opens and scrolls into view. "próximo: X" as inert text made
                the user hunt for where X even lives (several fields sit behind
                opt-in "add" chips). */}
            {completeness.missing.length > 0 ? (
              <Box className="flex flex-col gap-1.5">
                <Typography variant="body2" className="text-text-secondary">
                  {t("completeness-jump-hint")}
                </Typography>
                <Box className="flex flex-row flex-wrap gap-1.5">
                  {completeness.missing.map((field) => (
                    <Chip
                      key={field}
                      label={t(`field-${field}`)}
                      icon={<NiPlus size="small" />}
                      size="small"
                      variant="outlined"
                      color="primary"
                      className="cursor-pointer"
                      onClick={() => openSection(SECTION_BY_FIELD[field])}
                    />
                  ))}
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" className="text-text-secondary">
                {t("completeness-full")}
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Collapsed by default: the summary row carries each section's own
            fill state, so the gap map stays visible with zero scrolling — and
            nothing here is hidden knowledge, just folded. Card-in-summary is
            the template's own accordion language (see the FAQ pages): each
            section reads as an elevated white card, not a bare divider row. */}
        <Box className="mb-5 flex flex-col">
          {sectionCards.map((card) => {
            const fill = (["identity", "offer", "economics", "funnel"] as ContextSection[]).includes(
              card.key as ContextSection,
            )
              ? sectionCompleteness(toInput(formik.values, orgId, product?.id), card.key as ContextSection)
              : null;
            return (
              <Box key={card.key} className="mb-2.5 rounded-xl shadow-sm">
                <Accordion
                  id={`context-section-${card.key}`}
                  expanded={expandedSections.has(card.key)}
                  onChange={() => toggleSection(card.key)}
                >
                  <AccordionSummary className="group">
                    <Card className="w-full shadow-none! group-aria-expanded:rounded-b-none">
                      <CardContent className="flex flex-row items-center justify-between gap-2">
                        <Typography variant="h6" component="h2" className="mb-0">
                          {card.title}
                        </Typography>
                        <Box className="flex flex-none flex-row items-center gap-2">
                          {fill && (
                            <Chip
                              icon={fill.filled === fill.total ? <NiCheck size="small" /> : undefined}
                              label={`${fill.filled}/${fill.total}`}
                              size="small"
                              variant="outlined"
                              color={fill.filled === fill.total ? "success" : "grey"}
                            />
                          )}
                          <NiChevronRightSmall size={20} className="accordion-rotate" />
                        </Box>
                      </CardContent>
                    </Card>
                  </AccordionSummary>
                  <AccordionDetails className="bg-background-paper rounded-b-xl px-7 py-6 pt-0">
                    {card.content}
                  </AccordionDetails>
                </Accordion>
              </Box>
            );
          })}
        </Box>

        {errorAlert}

        <Box className="flex flex-row gap-2">
          <Button type="submit" variant="contained" disabled={formik.isSubmitting}>
            {formik.isSubmitting ? t("saving") : t("save")}
          </Button>
          <Button variant="text" color="grey" onClick={() => router.push("/products")}>
            {t("cancel")}
          </Button>
        </Box>
      </Box>
    </FormikProvider>
  );
}

/** Small repeatable-list editor used for objections and proofs. */
function ListEditor<T>({
  label,
  addLabel,
  removeLabel,
  items,
  onChange,
  render,
  empty,
}: {
  label: string;
  addLabel: string;
  /** Accessible name for each row's remove button. */
  removeLabel: string;
  items: T[];
  onChange: (next: T[]) => void;
  render: (value: T, onChange: (next: T) => void) => React.ReactNode;
  empty: () => T;
}) {
  return (
    <FormControl className="outlined" variant="standard" size="small" fullWidth>
      <FormLabel component="label">{label}</FormLabel>
      <Box className="flex flex-col gap-2">
        {items.map((item, index) => (
          <Box key={index} className="flex flex-row items-start gap-2">
            {render(item, (next) => onChange(items.map((current, i) => (i === index ? next : current))))}
            <Button
              className="icon-only shrink-0"
              size="small"
              color="grey"
              variant="text"
              aria-label={removeLabel}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <NiBinEmpty size="medium" />
            </Button>
          </Box>
        ))}
        <Button
          size="small"
          color="grey"
          variant="outlined"
          className="self-start"
          startIcon={<NiPlus size="small" />}
          onClick={() => onChange([...items, empty()])}
        >
          {addLabel}
        </Button>
      </Box>
    </FormControl>
  );
}
