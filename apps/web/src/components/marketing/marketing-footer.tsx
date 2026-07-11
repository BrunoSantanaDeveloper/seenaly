import Link from "next/link";
import { useTranslations } from "next-intl";

import { BRAND } from "@/brand";
import Logo from "@/components/logo/logo";
import Container from "@/components/marketing/container";

const COLUMNS = [
  {
    titleKey: "footer-product",
    links: [
      { key: "nav-pricing", href: "/pricing" },
      { key: "nav-sign-in", href: "/auth/sign-in" },
      { key: "cta-primary", href: "/auth/sign-up" },
    ],
  },
  {
    titleKey: "footer-company",
    links: [
      { key: "nav-about", href: "/about" },
      { key: "nav-contact", href: "/contact" },
      { key: "footer-help", href: "/help" },
      { key: "footer-blog", href: "/blog" },
    ],
  },
  {
    titleKey: "footer-legal",
    links: [
      { key: "footer-terms", href: "/legal/terms" },
      { key: "footer-privacy", href: "/legal/privacy" },
    ],
  },
] as const;

export default function MarketingFooter() {
  const t = useTranslations("marketing");

  return (
    <footer className="border-grey-100 w-full border-t">
      <Container className="flex flex-col gap-10 py-12 md:py-16">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="flex max-w-xs flex-col gap-3">
            <Link href="/" aria-label={t("nav-home")} className="flex items-center">
              <Logo classNameFull="block" />
            </Link>
            <p className="text-text-secondary text-base leading-5">{t("footer-tagline")}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.titleKey} className="flex flex-col gap-2">
                <p className="text-text-primary text-sm font-semibold tracking-wide uppercase">{t(column.titleKey)}</p>
                {column.links.map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    className="text-text-secondary hover:text-primary text-base leading-6 transition-colors"
                  >
                    {t(link.key)}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <p className="text-text-secondary border-grey-100 border-t pt-6 text-sm">
          © {new Date().getFullYear()} {BRAND.name}. {t("footer-rights")}
        </p>
      </Container>
    </footer>
  );
}
