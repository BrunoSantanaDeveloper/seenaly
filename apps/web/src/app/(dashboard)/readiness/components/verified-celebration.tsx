"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  Fade,
  Grow,
  IconButton,
  Snackbar,
  Typography,
  useMediaQuery,
} from "@mui/material";

import NiBadgeCheck from "@/icons/nexture/ni-badge-check";
import NiBraces from "@/icons/nexture/ni-braces";
import NiChartLine from "@/icons/nexture/ni-chart-line";
import NiCheck from "@/icons/nexture/ni-check";
import NiCross from "@/icons/nexture/ni-cross";
import NiEyeOpen from "@/icons/nexture/ni-eye-open";
import NiFlash from "@/icons/nexture/ni-flash";
import NiMap from "@/icons/nexture/ni-map";
import NiPulse from "@/icons/nexture/ni-pulse";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiTag from "@/icons/nexture/ni-tag";
import type { ReadinessItemKey } from "@/lib/readiness/checklist";

/**
 * Where the reward is allowed to land.
 *
 * - `modal` — the proof came from a read the user just asked for and waited
 *   through the overlay for. The celebration IS the result of that action, so
 *   owning the screen is honest, not an interruption.
 * - `toast` — the proof arrived on its own (the delayed PageSpeed refetch lands
 *   ~25s after the scan, while the user is already typing somewhere else).
 *   Background work never seizes the screen (.claude/rules/app-ux.md).
 */
export type CelebrationSurface = "modal" | "toast";

/**
 * One icon per PROVED claim, so the list reads as evidence rather than as a
 * uniform wall of green ticks.
 *
 * Only `verification: "proved"` items can ever reach here — `verifyItem`
 * returns "unverifiable" for every other tier, so `evaluation.verified` is
 * exactly this key set. The `NiCheck` fallback exists for the day a new provable
 * item is added and this map is not yet updated: an unmapped item still renders.
 */
const ITEM_ICON: Partial<Record<ReadinessItemKey, ReactNode>> = {
  pixelInstalled: <NiPulse size="small" />,
  analyticsInstalled: <NiChartLine size="small" />,
  pageFast: <NiFlash size="small" />,
  // The page's own metadata — literally meta TAGS.
  seoBasics: <NiTag size="small" />,
  // Nothing blocks Google from seeing it.
  indexable: <NiEyeOpen size="small" />,
  sitemapRobots: <NiMap size="small" />,
  // schema.org ships as JSON-LD.
  structuredData: <NiBraces size="small" />,
};

/**
 * The micro-celebration for the instant the page scan PROVES a fix.
 *
 * It fires only from `evaluation.verified` growing — i.e. the scanner just saw
 * something on the page that was not there before — so it is competence
 * feedback that cannot be faked by ticking a box (the amended engagement rule in
 * .claude/rules/app-ux.md permits celebration exactly when it is machine
 * verified).
 *
 * The first shape of this was a 5s snackbar whose body joined every proved item
 * into one comma-run-on sentence: six proofs arrived as an unreadable paragraph
 * that timed out before it could be read, over a stepper it covered. In a
 * product whose whole premise is EVIDENCE, the evidence has to be legible — so
 * each proof now gets its own row, its own icon and its own line saying what the
 * reader actually saw, revealed one after the other.
 *
 * Both surfaces honour prefers-reduced-motion (no stagger, plain fade).
 */
export default function VerifiedCelebration({
  open,
  items,
  surface = "modal",
  onClose,
}: {
  open: boolean;
  items: ReadinessItemKey[];
  surface?: CelebrationSurface;
  onClose: () => void;
}) {
  const t = useTranslations("readiness");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Top-center sits UNDER the fixed app header on small screens; bottom is
  // transient and clears the sticky action bar's z-order (U8).
  const mobile = useMediaQuery("(max-width:640px)");

  const rows = items.map((key) => ({
    key,
    icon: ITEM_ICON[key] ?? <NiCheck size="small" />,
    label: t(`item-${key}`),
    // What the reader actually observed for this claim. Guarded because a newly
    // added provable item must degrade to "no proof line", never to a thrown
    // missing-message error mid-celebration.
    proof: t.has(`celebrate-proof-${key}`) ? t(`celebrate-proof-${key}`) : null,
  }));

  /** Reveal one row after the other; reduced motion collapses the stagger to 0. */
  const delayFor = (index: number) => (reduceMotion ? "0ms" : `${160 + index * 110}ms`);

  if (surface === "toast") {
    return (
      <Snackbar
        open={open}
        // A fixed 5s could not be read once more than two items landed. Scales
        // with what there is to read, capped so it never becomes furniture.
        autoHideDuration={Math.min(12_000, 4000 + items.length * 1500)}
        onClose={(_event, reason) => {
          // A stray click elsewhere should not rob the user of the reward — only
          // the timeout and an explicit dismiss close it.
          if (reason !== "clickaway") onClose();
        }}
        anchorOrigin={{ vertical: mobile ? "bottom" : "top", horizontal: "center" }}
        slots={{ transition: reduceMotion ? Fade : Grow }}
      >
        <Alert
          severity="success"
          variant="outlined"
          icon={<NiBadgeCheck size="medium" />}
          onClose={onClose}
          closeText={t("celebrate-close")}
          className="bg-background-paper shadow-darker-sm! max-w-md"
        >
          <Typography variant="subtitle1" className="mb-0">
            {t("celebrate-title")}
          </Typography>
          <Typography variant="body2" className="text-text-secondary">
            {t("celebrate-headline", { count: items.length })}
          </Typography>
          <Box className="mt-2 flex flex-col gap-1.5">
            {rows.map((row, index) => (
              <Fade
                key={row.key}
                in
                appear
                timeout={reduceMotion ? 0 : 320}
                style={{ transitionDelay: delayFor(index) }}
              >
                <Box className="flex flex-row items-center gap-2">
                  <span className="text-success flex-none">{row.icon}</span>
                  <Typography variant="body2">{row.label}</Typography>
                </Box>
              </Fade>
            ))}
          </Box>
        </Alert>
      </Snackbar>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      scroll="paper"
      aria-labelledby="readiness-celebrate-title"
      slots={{ transition: reduceMotion ? Fade : Grow }}
    >
      <DialogContent className="relative flex flex-col gap-5">
        <IconButton aria-label={t("celebrate-close")} onClick={onClose} className="absolute top-2 right-2" size="small">
          <NiCross size="small" />
        </IconButton>

        {/* The proof badge leads: it is the one thing that says "a machine saw
            this", which is the whole reason this moment is allowed to exist. */}
        <Box className="flex flex-col items-center gap-2 pt-2 text-center">
          <Grow in appear timeout={reduceMotion ? 0 : 520}>
            <span className="bg-success/10 text-success flex h-16 w-16 items-center justify-center rounded-3xl">
              <NiBadgeCheck size="large" />
            </span>
          </Grow>
          <Typography id="readiness-celebrate-title" variant="h4" component="h2" className="mb-0">
            {t("celebrate-title")}
          </Typography>
          <Typography variant="body2" className="text-text-secondary">
            {t("celebrate-headline", { count: items.length })}
          </Typography>
        </Box>

        <Box className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <Grow
              key={row.key}
              in
              appear
              timeout={reduceMotion ? 0 : 420}
              style={{ transitionDelay: delayFor(index), transformOrigin: "0 50%" }}
            >
              <Box className="border-grey-100 flex flex-row items-start gap-3 rounded-2xl border border-solid p-3">
                <span className="bg-success/10 text-success flex h-9 w-9 flex-none items-center justify-center rounded-xl">
                  {row.icon}
                </span>
                <Box className="min-w-0 grow">
                  <Typography variant="subtitle2" className="mb-0">
                    {row.label}
                  </Typography>
                  {row.proof && (
                    <Typography variant="caption" className="text-text-secondary block">
                      {row.proof}
                    </Typography>
                  )}
                </Box>
                <NiCheck size="small" className="text-success mt-0.5 flex-none" />
              </Box>
            </Grow>
          ))}
        </Box>

        <Fade in appear timeout={reduceMotion ? 0 : 320} style={{ transitionDelay: delayFor(rows.length) }}>
          <Box className="flex flex-col gap-3">
            <Box className="flex flex-row items-start gap-2">
              <NiShieldCheck size="small" className="text-success mt-0.5 flex-none" />
              <Typography variant="caption" className="text-text-secondary">
                {t("celebrate-note")}
              </Typography>
            </Box>
            <Button variant="contained" onClick={onClose} className="w-full">
              {t("celebrate-continue")}
            </Button>
          </Box>
        </Fade>
      </DialogContent>
    </Dialog>
  );
}
