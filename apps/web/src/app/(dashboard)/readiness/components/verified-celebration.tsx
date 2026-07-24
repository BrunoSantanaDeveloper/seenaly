"use client";

import { useTranslations } from "next-intl";

import { Alert, Fade, Grow, Snackbar, Typography, useMediaQuery } from "@mui/material";

import NiSparkle from "@/icons/nexture/ni-sparkle";
import type { ReadinessItemKey } from "@/lib/readiness/checklist";

/**
 * The micro-celebration for the instant the page scan PROVES a fix.
 *
 * It fires only from `evaluation.verified` growing — i.e. the scanner just saw
 * something on the page that was not there before — so it is competence
 * feedback that cannot be faked by ticking a box (the amended engagement rule in
 * .claude/rules/app-ux.md permits celebration exactly when it is machine
 * verified). It names WHAT was proved, so the reward is tied to the real thing,
 * not to a number.
 *
 * Non-blocking (a Snackbar, never a modal), honours prefers-reduced-motion, and
 * auto-dismisses — a reward, not an interruption.
 */
export default function VerifiedCelebration({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: ReadinessItemKey[];
  onClose: () => void;
}) {
  const t = useTranslations("readiness");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const names = items.map((key) => t(`item-${key}`)).join(", ");

  return (
    <Snackbar
      open={open}
      autoHideDuration={5000}
      onClose={(_event, reason) => {
        // A stray click elsewhere should not rob the user of the reward — only
        // the timeout and an explicit dismiss close it.
        if (reason !== "clickaway") onClose();
      }}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      slots={{ transition: reduceMotion ? Fade : Grow }}
    >
      <Alert
        severity="success"
        variant="filled"
        icon={<NiSparkle size="small" />}
        onClose={onClose}
        closeText={t("celebrate-close")}
        className="shadow-darker-sm! max-w-md"
      >
        <Typography variant="subtitle2" className="mb-0">
          {t("celebrate-title")}
        </Typography>
        <Typography variant="body2">{t("celebrate-body", { items: names })}</Typography>
      </Alert>
    </Snackbar>
  );
}
