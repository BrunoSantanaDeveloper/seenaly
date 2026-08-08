"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Box, Button, Card, CardContent, Typography } from "@mui/material";

import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiCheck from "@/icons/nexture/ni-check";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";

/**
 * Who is here: someone who just saved their FIRST product and is asking "and
 * now?". Until now the app answered by dropping them, unannounced, into a
 * nine-step readiness wizard — which a real user (2026-08-07) read as being
 * shoved somewhere they had not chosen to go.
 *
 * The job of this card is one honest handoff: confirm what was just created,
 * name the single next step, and say what it costs in time before they commit.
 * Success is entering readiness by decision rather than by inertia.
 *
 * Deliberately ONE primary action and no second competing button — the whole
 * point is removing the ambush, not replacing it with a menu. It renders only
 * for the first product; returning users keep the direct route.
 */
export default function StartHereCard({ readinessHref }: { readinessHref: string }) {
  const t = useTranslations("products");

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-4">
        <Box className="flex flex-row items-center gap-2">
          <span className="bg-success/10 text-success flex h-7 w-7 flex-none items-center justify-center rounded-lg">
            <NiCheck size="small" aria-hidden />
          </span>
          <Typography variant="body2" className="text-text-secondary mb-0">
            {t("start-here-created")}
          </Typography>
        </Box>

        <Box className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Box className="flex min-w-0 flex-row items-center gap-3">
            <span className="bg-accent-4/10 text-accent-4 flex h-11 w-11 flex-none items-center justify-center rounded-2xl">
              <NiShieldCheck size="medium" aria-hidden />
            </span>
            <Box className="min-w-0">
              <Typography variant="h5" component="h2" className="card-title mb-0">
                {t("start-here-title")}
              </Typography>
              <Typography variant="body2" className="text-text-secondary">
                {t("start-here-body")}
              </Typography>
            </Box>
          </Box>
          <Button
            component={Link}
            href={readinessHref}
            variant="contained"
            className="min-h-11! flex-none"
            endIcon={<NiArrowRight size="small" />}
          >
            {t("start-here-cta")}
          </Button>
        </Box>

        {/* Cost and shape declared BEFORE the click — the ambush was not the
            wizard's length, it was arriving in it without being told. */}
        <Typography variant="body2" className="text-text-secondary">
          {t("start-here-meta")}
        </Typography>
      </CardContent>
    </Card>
  );
}
