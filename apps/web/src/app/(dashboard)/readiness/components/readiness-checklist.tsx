"use client";

import type { AssistOffering } from "../actions";
import AssistOffer from "./assist-offer";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import NiBook from "@/icons/nexture/ni-book";
import NiChartFunnel from "@/icons/nexture/ni-chart-funnel";
import NiCheck from "@/icons/nexture/ni-check";
import NiChevronDown from "@/icons/nexture/ni-chevron-down";
import NiClipboard from "@/icons/nexture/ni-clipboard";
import NiCreditCard from "@/icons/nexture/ni-credit-card";
import NiExternal from "@/icons/nexture/ni-external";
import NiFlask from "@/icons/nexture/ni-flask";
import NiListCheck from "@/icons/nexture/ni-list-check";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiQuestionHexagon from "@/icons/nexture/ni-question-hexagon";
import NiScreen from "@/icons/nexture/ni-screen";
import NiSearch from "@/icons/nexture/ni-search";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiSlider from "@/icons/nexture/ni-slider";
import { type AssistReason, assistReason } from "@/lib/readiness/assist";
import {
  CHECKOUT_TYPES,
  type CheckoutType,
  groupsForModel,
  notApplicableReason,
  observeItem,
  READINESS_ITEM_BY_KEY,
  type ReadinessEvaluation,
  type ReadinessGroup,
  type ReadinessGroupKey,
  type ReadinessItemKey,
  type ReadinessProfile,
} from "@/lib/readiness/checklist";
import type { ScanSignals } from "@/lib/readiness/scan-analyze";
import { cn } from "@/lib/utils";

const GROUP_ICON: Record<ReadinessGroupKey, React.ReactNode> = {
  mensuracao: <NiPulse size="medium" />,
  pagina: <NiScreen size="medium" />,
  checkout: <NiCreditCard size="medium" />,
  ativacao: <NiFlask size="medium" />,
  descoberta: <NiSearch size="medium" />,
  funil: <NiChartFunnel size="medium" />,
};

/**
 * The readiness intake — and the place the whole product is decided.
 *
 * Two failures shaped this component:
 *
 * 1. A beginner (the framed-art merchant) hit "Pixel da Meta instalado" on step
 *    one and had no idea what it meant, so he could not answer honestly and was
 *    about to leave. Hence: every item carries a plain-language explanation, a
 *    difficulty badge, and — when it needs a professional — the exact scope to
 *    hand them, so he becomes an INFORMED buyer instead of a burned one.
 *
 * 2. A self-declared checklist feeding an AI verdict is garbage-in-garbage-out:
 *    ticking "pixel installed" when it is not produces a confidently WRONG
 *    verdict, which is worse than none. Hence: claims we can disprove are
 *    REFUSED at the moment of ticking, with the evidence shown.
 *
 * The refusal is never a dead end — it always offers do-it / delegate / skip.
 * And we only refuse with proof: no scan, or a client-rendered page, means we
 * cannot tell, so we trust the user (see `observeItem`).
 */
export default function ReadinessChecklist({
  profile,
  evaluation,
  onChange,
  disabled,
  groupKeys,
  bare = false,
  signals = null,
  scanUrl = null,
  hasLandingPage = false,
  onVerifyNow,
  scanning = false,
  assistOffering = null,
  assistOpenItems = [],
  scanAttempts = 0,
  creditBalance = null,
  onRequestAssist,
}: {
  profile: ReadinessProfile;
  evaluation: ReadinessEvaluation;
  onChange: (next: ReadinessProfile) => void;
  disabled?: boolean;
  /** Render only these groups (defaults to all). */
  groupKeys?: ReadinessGroupKey[];
  /** Drop the outer Card + intro + per-group header (for a wizard step). */
  bare?: boolean;
  /** Latest scan — the evidence that makes refusal possible. */
  signals?: ScanSignals | null;
  /** The page we actually read, quoted back in the refusal. */
  scanUrl?: string | null;
  hasLandingPage?: boolean;
  /** Re-read the page so a fix can be proved in seconds. */
  onVerifyNow?: () => void;
  scanning?: boolean;
  /** The concierge catalog entry; null when the service is switched off. */
  assistOffering?: AssistOffering | null;
  /** Items with a request already in the queue — never sell the same one twice. */
  assistOpenItems?: string[];
  /** How many times the page has been scanned — part of the resistance signal. */
  scanAttempts?: number;
  creditBalance?: number | null;
  onRequestAssist?: (key: ReadinessItemKey, reason: AssistReason, note: string) => Promise<boolean>;
}) {
  const t = useTranslations("readiness");
  const [openHelp, setOpenHelp] = useState<Set<ReadinessItemKey>>(new Set());
  const [refused, setRefused] = useState<Set<ReadinessItemKey>>(new Set());
  const [copied, setCopied] = useState<ReadinessItemKey | null>(null);
  // Explicitly giving up on an item is the clearest "I can't do this" we ever
  // get — it is what earns the concierge offer (see lib/readiness/assist.ts).
  const [skipped, setSkipped] = useState<Set<ReadinessItemKey>>(new Set());

  const toggleSet = (
    setter: React.Dispatch<React.SetStateAction<Set<ReadinessItemKey>>>,
    key: ReadinessItemKey,
    force?: boolean,
  ) =>
    setter((prev) => {
      const next = new Set(prev);
      const shouldHave = force ?? !next.has(key);
      if (shouldHave) next.add(key);
      else next.delete(key);
      return next;
    });

  const set = <K extends keyof ReadinessProfile>(key: K, value: ReadinessProfile[K]) =>
    onChange({ ...profile, [key]: value });

  /**
   * Ticking an item. A claim the evidence disproves is refused — the box stays
   * unticked and the user gets the proof plus three ways forward.
   */
  const claim = (key: ReadinessItemKey, checked: boolean) => {
    if (checked && observeItem(key, signals) === false) {
      toggleSet(setRefused, key, true);
      toggleSet(setOpenHelp, key, false);
      return;
    }
    toggleSet(setRefused, key, false);
    set(key, checked);
  };

  const copySpec = async (key: ReadinessItemKey, spec: string) => {
    try {
      await navigator.clipboard.writeText(spec);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
    } catch {
      // Clipboard blocked (permissions, insecure context): the text is on
      // screen and selectable, so this is a silent degradation, not a failure.
    }
  };

  // Never offer a group this funnel model does not have — activation items only
  // mean something when there is a trial to activate.
  const modelGroups = groupsForModel(profile.funnelModel);
  const groups = groupKeys ? modelGroups.filter((group) => groupKeys.includes(group.key)) : modelGroups;

  const itemRow = (key: ReadinessItemKey) => {
    const meta = READINESS_ITEM_BY_KEY[key];
    const naReason = notApplicableReason(key, profile, { hasLandingPage });
    const isVerified = evaluation.verified.includes(key);
    const helpOpen = openHelp.has(key);
    // A claim ticked BEFORE the evidence existed must not survive it. Guarding
    // only the moment of ticking would let anyone tick everything first and
    // scan later, keeping every false claim — so a standing claim the scan
    // disproves shows the same refusal, permanently, until it is resolved.
    const isContradicted = evaluation.contradicted.includes(key);
    const wasRefused = refused.has(key) || isContradicted;
    const hireSpec = meta.difficulty === "specialist" ? t(`item-hire-${key}`) : null;
    // The official flow this item links out to (e.g. Meta's own CAPI setup)
    // asks the user to pick from a menu of platform events with no guidance —
    // a generic doc link does not answer "which one is mine".
    const eventsTip = meta.recommendedEvents ? t(`item-events-${key}`) : null;
    // The step right after: a dense checkbox grid of "which fields to send",
    // no priority order given — same failure, one screen later.
    const parametersTip = meta.recommendedParameters ? t(`item-parameters-${key}`) : null;

    // The concierge is EARNED: it appears only after this specific item has
    // shown real resistance, and never for something already proved, already
    // requested, or that this business cannot do anyway.
    const offer =
      assistOffering && onRequestAssist
        ? assistReason(key, {
            contradicted: isContradicted,
            skipped: skipped.has(key),
            openedHelp: helpOpen,
            scanAttempts,
            resolved: isVerified,
            notApplicable: Boolean(naReason),
          })
        : null;

    return (
      <Box key={key} className={cn("flex flex-col py-0.5", naReason && "opacity-60")}>
        <Box className="flex flex-row flex-wrap items-center gap-x-2">
          {/* A proved item is settled by evidence, not opinion — so its box is
              read-only. Leaving it editable would re-open the very gap the
              early scan closes: un-ticking something we can literally see. */}
          <FormControlLabel
            className="m-0"
            control={
              <Checkbox
                checked={profile[key]}
                disabled={disabled || isVerified}
                onChange={(e) => claim(key, e.target.checked)}
              />
            }
            label={
              <Typography variant="body2" component="span">
                {t(`item-${key}`)}
              </Typography>
            }
          />
          {isVerified && (
            <Chip
              icon={<NiCheck size="small" />}
              label={t("badge-verified")}
              size="small"
              variant="outlined"
              color="success"
              className="flex-none"
            />
          )}
          {isContradicted && (
            <Chip
              label={t("badge-contradicted")}
              size="small"
              variant="outlined"
              color="warning"
              className="flex-none"
            />
          )}
          {naReason && (
            <Chip
              label={t("badge-not-applicable")}
              size="small"
              variant="outlined"
              color="grey"
              className="flex-none"
            />
          )}
          {/* Styled as a link (primary text + icon + rotating chevron), not
              plain gray text — it has to READ as clickable, not just be
              clickable. Same disclosure language as readiness-verdict.tsx. */}
          <Button
            variant="text"
            color="primary"
            size="small"
            className="min-w-0"
            startIcon={<NiQuestionHexagon size="small" />}
            endIcon={<NiChevronDown size="small" className={cn("transition-transform", helpOpen && "rotate-180")} />}
            onClick={() => toggleSet(setOpenHelp, key)}
            aria-expanded={helpOpen}
          >
            {helpOpen ? t("hide-explanation") : t("dont-know")}
          </Button>
        </Box>

        {/* Refusal: the box stayed unticked, and here is the proof + a way out. */}
        <Collapse in={wasRefused} unmountOnExit>
          <Alert severity="warning" className="neutral bg-background-paper/60! mb-2 ml-8">
            <Typography variant="subtitle2">{t("refused-title")}</Typography>
            <Typography variant="body2">{t("refused-body", { item: t(`item-${key}`), url: scanUrl ?? "" })}</Typography>
            <Box className="mt-2 flex flex-row flex-wrap gap-1">
              <Button size="small" variant="outlined" color="grey" onClick={() => toggleSet(setOpenHelp, key, true)}>
                {t("refused-do-it")}
              </Button>
              {hireSpec && (
                <Button
                  size="small"
                  variant="outlined"
                  color="grey"
                  onClick={() => {
                    toggleSet(setOpenHelp, key, true);
                    copySpec(key, hireSpec);
                  }}
                >
                  {copied === key ? t("copied") : t("refused-delegate")}
                </Button>
              )}
              <Button
                size="small"
                variant="text"
                color="grey"
                onClick={() => {
                  toggleSet(setRefused, key, false);
                  toggleSet(setSkipped, key, true);
                }}
              >
                {t("refused-skip")}
              </Button>
            </Box>
            <Typography variant="body2" className="text-text-secondary mt-1">
              {t("skip-cost")}
            </Typography>
          </Alert>
        </Collapse>

        {/* The fourth exit, once this item has actually proved hard. It sits
            outside both collapses so giving up does not make everything vanish
            — the way out stays on screen. */}
        <Collapse in={Boolean(offer)} unmountOnExit>
          <Box className="mb-2 ml-8">
            {offer && assistOffering && onRequestAssist && (
              <AssistOffer
                reason={offer}
                offering={assistOffering}
                itemLabel={t(`item-${key}`)}
                alreadyOpen={assistOpenItems.includes(key)}
                balance={creditBalance}
                onRequest={(note) => onRequestAssist(key, offer, note)}
              />
            )}
          </Box>
        </Collapse>

        {/* The teaching, at the moment of the question. */}
        <Collapse in={helpOpen} unmountOnExit>
          <Box className="bg-grey-25/60 mb-2 ml-8 flex flex-col gap-2 rounded-2xl p-3">
            <Box className="flex flex-row flex-wrap items-center gap-2">
              <Chip
                label={meta.difficulty === "diy" ? t("difficulty-diy") : t("difficulty-specialist")}
                size="small"
                variant="outlined"
                color={meta.difficulty === "diy" ? "success" : "grey"}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" className="text-text-secondary uppercase">
                {t("what-is")}
              </Typography>
              <Typography variant="body2" className="leading-6">
                {t(`item-what-${key}`)}
              </Typography>
            </Box>

            {/* The official flow this item links out to hands the user a menu
                of ~12 generic platform events with zero guidance — this is
                the answer to "which one is mine", scoped to what THIS product
                sells (digital products / self-service offers). Boxed and
                icon-led so it reads as an instruction to follow, not prose to
                skim past. */}
            {eventsTip && (
              <Box className="bg-primary/5 flex flex-row items-start gap-2 rounded-2xl p-3">
                <span className="text-primary mt-0.5 flex-none">
                  <NiListCheck size="small" />
                </span>
                <Box>
                  <Typography variant="subtitle2" className="text-text-secondary mb-0 uppercase">
                    {t("events-tip-title")}
                  </Typography>
                  <Typography variant="body2" className="leading-6">
                    {eventsTip}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* One screen later in the same official flow: a dense grid of
                "which fields to send" with the truly required ones already
                locked (greyed out) — the decision is only in the optional
                ones, and nothing there says which optional field is worth
                checking. */}
            {parametersTip && (
              <Box className="bg-primary/5 flex flex-row items-start gap-2 rounded-2xl p-3">
                <span className="text-primary mt-0.5 flex-none">
                  <NiSlider size="small" />
                </span>
                <Box>
                  <Typography variant="subtitle2" className="text-text-secondary mb-0 uppercase">
                    {t("parameters-tip-title")}
                  </Typography>
                  <Typography variant="body2" className="leading-6">
                    {parametersTip}
                  </Typography>
                </Box>
              </Box>
            )}

            {naReason && (
              <Typography variant="body2" className="text-text-secondary">
                {t(`na-reason-${naReason}`)}
              </Typography>
            )}

            {hireSpec && (
              <Box className="flex flex-col gap-1">
                <Typography variant="subtitle2" className="text-text-secondary uppercase">
                  {t("hire-title")}
                </Typography>
                <Typography variant="body2" className="leading-6 italic">
                  “{hireSpec}”
                </Typography>
              </Box>
            )}

            {/* One action row, not stacked buttons: each carries its own icon
                and weight, so the eye reads them as distinct choices rather
                than a repeated shape. Reading order matches the journey: try
                it yourself from the source → prove it → if that fails,
                delegate. "Verificar agora" is the try → prove → celebrate
                loop — the one that matters most here — so it gets the tinted
                "pastel" treatment; the rest stay outlined/text. */}
            {(meta.officialDocUrl ||
              hireSpec ||
              (meta.verification === "proved" && onVerifyNow && hasLandingPage) ||
              meta.helpSlug) && (
              <Box className="flex flex-row flex-wrap items-center gap-2">
                {meta.officialDocUrl && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="grey"
                    startIcon={<NiExternal size="small" />}
                    href={meta.officialDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("official-doc")}
                  </Button>
                )}

                {hireSpec && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="grey"
                    startIcon={copied === key ? <NiCheck size="small" /> : <NiClipboard size="small" />}
                    onClick={() => copySpec(key, hireSpec)}
                  >
                    {copied === key ? t("copied") : t("copy-spec")}
                  </Button>
                )}

                {meta.verification === "proved" && onVerifyNow && hasLandingPage && (
                  <Button
                    size="small"
                    variant="pastel"
                    color="primary"
                    startIcon={<NiShieldCheck size="small" />}
                    onClick={onVerifyNow}
                    disabled={scanning}
                  >
                    {scanning ? t("verifying-now") : t("verify-now")}
                  </Button>
                )}

                {meta.helpSlug && (
                  <Button
                    size="small"
                    variant="text"
                    color="grey"
                    startIcon={<NiBook size="small" />}
                    href={`/help/${meta.helpSlug}`}
                    target="_blank"
                  >
                    {t("full-guide")}
                  </Button>
                )}
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>
    );
  };

  const items = (group: ReadinessGroup) => (
    <Box className="flex flex-col pl-1">
      {group.items.map((item) => itemRow(item.key))}

      {/* Where the money is actually taken — a select, because "none" is a real
          and blocking answer, not an unchecked box. */}
      {group.key === "checkout" && (
        <Box className="mt-2 flex flex-row flex-wrap gap-3">
          <TextField
            select
            size="small"
            label={t("checkout-type")}
            value={profile.checkoutType ?? ""}
            disabled={disabled}
            onChange={(event) => set("checkoutType", (event.target.value || null) as CheckoutType | null)}
            className="min-w-56"
          >
            <MenuItem value="">{t("checkout-type-unset")}</MenuItem>
            {CHECKOUT_TYPES.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`checkout-type-${value}`)}
              </MenuItem>
            ))}
          </TextField>

          {profile.hasGuarantee && (
            <TextField
              type="number"
              size="small"
              label={t("guarantee-days")}
              value={profile.guaranteeDays ?? ""}
              disabled={disabled}
              onChange={(event) => set("guaranteeDays", event.target.value === "" ? null : Number(event.target.value))}
              slotProps={{ htmlInput: { min: 1, max: 365 } }}
              className="w-40"
            />
          )}
        </Box>
      )}
    </Box>
  );

  /** Nobody should feel stupid for not knowing — say it out loud. */
  const reassurance = (
    <Typography variant="body2" className="text-text-secondary">
      {t("intake-reassure")}
    </Typography>
  );

  // Bare: only the controls (the wizard step owns the title + why + progress).
  if (bare) {
    return (
      <Box className="flex flex-col gap-3">
        {reassurance}
        {groups.map((group) => (
          <Box key={group.key}>{items(group)}</Box>
        ))}
      </Box>
    );
  }

  const groupBlock = (group: ReadinessGroup) => {
    const progress = evaluation.byGroup.find((entry) => entry.key === group.key);
    return (
      <Box key={group.key} className="flex flex-col gap-2">
        <Divider />
        <Box className="flex flex-row items-center gap-3">
          <span className="bg-primary/10 text-primary flex h-9 w-9 flex-none items-center justify-center rounded-2xl">
            {GROUP_ICON[group.key]}
          </span>
          <Box className="grow">
            <Typography variant="subtitle1" component="h3" className="mb-0">
              {t(`group-${group.key}`)}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t(`group-why-${group.key}`)}
            </Typography>
          </Box>
          {progress && (
            <Chip
              label={t("group-progress", { confirmed: progress.confirmed, total: progress.total })}
              size="small"
              variant="outlined"
              color={progress.confirmed === progress.total ? "success" : "grey"}
              className="flex-none"
            />
          )}
        </Box>
        {items(group)}
      </Box>
    );
  };

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-5">
        <Box className="flex flex-col gap-1">
          <Typography variant="h5" component="h2" className="card-title mb-0">
            {t("checklist-title")}
          </Typography>
          <Typography variant="body2" className="text-text-secondary">
            {t("checklist-body")}
          </Typography>
          {reassurance}
        </Box>
        {groups.map(groupBlock)}
      </CardContent>
    </Card>
  );
}
