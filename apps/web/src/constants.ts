export const LOCALES = ["de", "en", "fr", "es", "pt-BR"] as const;
export type LocaleOption = (typeof LOCALES)[number];

export const THEME_OPTIONS = {
  ORANGE: "theme-orange",
} as const;

export type ThemeVariant = (typeof THEME_OPTIONS)[keyof typeof THEME_OPTIONS];

export type ModeVariant = (typeof THEME_MODE_OPTIONS)[number];
export const THEME_MODE_OPTIONS = ["light", "dark", "system"] as const;

const storagePrefix = process.env.NEXT_PUBLIC_STORAGE_PREFIX || "";
export const COOKIE_KEYS = { locale: `${storagePrefix}-locale` };

export const LOCAL_STORAGE_KEYS = {
  themeColor: `${storagePrefix}-theme-color`,
  themeMode: `${storagePrefix}-theme-mode`,
  leftMenuType: `${storagePrefix}-left-menu-type`,
  contentType: `${storagePrefix}-content-type`,
};
