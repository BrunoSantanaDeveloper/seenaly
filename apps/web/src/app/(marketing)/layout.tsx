import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BRAND } from "@/brand";
import JsonLd from "@/components/marketing/json-ld";
import MarketingFooter from "@/components/marketing/marketing-footer";
import MarketingHeader from "@/components/marketing/marketing-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing");
  return {
    description: t("home-meta-description"),
    openGraph: {
      siteName: BRAND.name,
      type: "website",
      url: BRAND.siteUrl,
    },
  };
}

/**
 * Public site chrome: no admin layout, no auth required. Every route in this
 * group must be listed as public in src/middleware.ts (PUBLIC_PREFIXES).
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-[100dvh] flex-col">
      {/* Site-wide identity for search + AI engines; rebrands with @flyee/content. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${BRAND.siteUrl}/#organization`,
              name: BRAND.name,
              url: BRAND.siteUrl,
              logo: `${BRAND.siteUrl}${BRAND.favicon.light}`,
              description: BRAND.description,
            },
            {
              "@type": "WebSite",
              "@id": `${BRAND.siteUrl}/#website`,
              name: BRAND.name,
              url: BRAND.siteUrl,
              publisher: { "@id": `${BRAND.siteUrl}/#organization` },
            },
          ],
        }}
      />
      <MarketingHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <MarketingFooter />
    </div>
  );
}
