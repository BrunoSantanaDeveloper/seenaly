import type { MetadataRoute } from "next";

import { BRAND } from "@/brand";
import { DEFAULTS } from "@/config";
import { listBlogSlugs, listHelpSlugs } from "@/lib/public-content";

/** Public marketing routes only — the authenticated app must stay out. */
const MARKETING_ROUTES = ["/", "/pricing", "/about", "/contact", "/help", "/blog", "/legal/terms", "/legal/privacy"];

/**
 * Static marketing routes plus the DB-managed public content (help center
 * articles) in the default locale — crawlers see the default locale only
 * (cookie-based i18n). Degrades to the static list without Supabase env.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = MARKETING_ROUTES.map((route) => ({
    url: `${BRAND.siteUrl}${route === "/" ? "" : route}`,
    changeFrequency: "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));

  const [helpSlugs, blogSlugs] = await Promise.all([listHelpSlugs(DEFAULTS.locale), listBlogSlugs(DEFAULTS.locale)]);
  const helpEntries: MetadataRoute.Sitemap = helpSlugs.map((slug) => ({
    url: `${BRAND.siteUrl}/help/${slug}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));
  const blogEntries: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${BRAND.siteUrl}/blog/${slug}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticEntries, ...helpEntries, ...blogEntries];
}
