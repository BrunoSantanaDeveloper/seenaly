"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";

import { Box, Button, Card, Slide, Typography } from "@mui/material";

import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import { ANALYTICS_PROVIDER, getStoredConsent, initAnalyticsIfConsented, storeConsent } from "@/lib/analytics";

/**
 * Cookie-consent banner (marketing site + dashboard). Renders ONLY when an
 * analytics provider is registered in lib/analytics.ts AND the user has not
 * answered for the current CONSENT_VERSION — with no analytics there is
 * nothing to consent to (essential cookies are exempt) and a banner would be
 * pure theater. Accepting boots the provider immediately; rejecting keeps
 * analytics off for good. Essential cookies (sign-in, locale) are never
 * blocked and the copy says so honestly.
 *
 * Not a modal on purpose: it must not trap focus or block the page —
 * ignoring it is a valid answer (analytics stays off until granted).
 */
export default function CookieConsent() {
  const t = useTranslations("marketing");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ANALYTICS_PROVIDER) return;
    const consent = getStoredConsent();
    if (consent) initAnalyticsIfConsented(consent);
    else setOpen(true);
  }, []);

  if (!ANALYTICS_PROVIDER || !open) return null;

  const answer = (analytics: boolean) => {
    const state = storeConsent(analytics);
    initAnalyticsIfConsented(state);
    setOpen(false);
  };

  return (
    <Slide direction="up" in={open}>
      <Card
        component="section"
        aria-label={t("cookie-consent-title")}
        className="shadow-darker-sm! fixed bottom-5 left-5 z-50 flex max-w-md flex-col gap-4 p-5 max-sm:right-5 max-sm:max-w-none"
      >
        <Box className="flex items-start gap-3">
          <Box className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <NiShieldCheck size="medium" />
          </Box>
          <Box className="flex flex-col gap-1">
            <Typography variant="h6" component="h2">
              {t("cookie-consent-title")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("cookie-consent-description")}{" "}
              <Link href="/legal/privacy" className="text-primary underline">
                {t("cookie-consent-privacy")}
              </Link>
            </Typography>
          </Box>
        </Box>
        <Box className="flex gap-2 max-sm:flex-col">
          <Button variant="contained" color="primary" className="flex-1" onClick={() => answer(true)}>
            {t("cookie-consent-accept")}
          </Button>
          <Button variant="outlined" color="grey" className="flex-1" onClick={() => answer(false)}>
            {t("cookie-consent-reject")}
          </Button>
        </Box>
      </Card>
    </Slide>
  );
}
