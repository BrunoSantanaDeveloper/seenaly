/**
 * Single source for site identity. A rebrand edits THIS file plus the assets it points to:
 * - name/tagline/description → web metadata, marketing pages, OG image
 * - siteUrl → metadataBase, sitemap.ts, robots.ts (reads NEXT_PUBLIC_SITE_URL)
 * - favicons → apps/web/public/favicon/{light,dark}.png (web asset paths)
 * - logo SVGs → apps/web/src/components/logo/logo.tsx and apps/web/public/images/email/logo.svg
 */
export const BRAND = {
  name: "Seenaly",
  tagline: "Copiloto de Growth para Meta Ads, criativos e funis",
  description: "AI Growth Intelligence Platform para tráfego pago e funis de venda.",
  /** Canonical site URL — set NEXT_PUBLIC_SITE_URL in production (no trailing slash). */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  favicon: {
    light: "/favicon/light.png",
    dark: "/favicon/dark.png",
  },
  /**
   * Quick-support channels for the floating widget (web marketing +
   * dashboard). Leave a channel empty ("") to hide it; leave all empty
   * and the widget renders nothing. whatsapp is digits only, with the
   * country code (e.g. "5511999999999" → wa.me deep link).
   */
  support: {
    whatsapp: "",
    email: "",
    helpCenter: "/help",
  },
} as const;
