import { getRequestConfig } from "next-intl/server";

import { DEFAULTS } from "@/config";
import { LocaleOption, LOCALES } from "@/constants";
import { getClientLocale } from "@/i18n/locale";

// Message catalogs live in @flyee/content.
// Static map instead of a template-string import so the bundler can
// resolve each catalog.
const MESSAGES: Record<LocaleOption, () => Promise<{ default: Record<string, unknown> }>> = {
  de: () => import("@flyee/content/messages/de.json"),
  en: () => import("@flyee/content/messages/en.json"),
  es: () => import("@flyee/content/messages/es.json"),
  fr: () => import("@flyee/content/messages/fr.json"),
  "pt-BR": () => import("@flyee/content/messages/pt-BR.json"),
};

export default getRequestConfig(async () => {
  try {
    const localeCookie = await getClientLocale();
    const locale = (LOCALES as readonly string[]).includes(localeCookie)
      ? (localeCookie as LocaleOption)
      : (DEFAULTS.locale as LocaleOption);

    return {
      locale,
      messages: (await MESSAGES[locale]()).default,
      timeZone: "UTC",
    };
  } catch (error: any) {
    if (
      error.digest === "DYNAMIC_SERVER_USAGE" ||
      error.message?.includes("DynamicServerError") ||
      error.name === "DynamicServerError"
    ) {
      throw error;
    }
    // Fallback to default locale if there's an error
    return {
      locale: DEFAULTS.locale,
      messages: (await MESSAGES[DEFAULTS.locale as LocaleOption]()).default,
      timeZone: "UTC",
    };
  }
});
