import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import Cta from "@/components/marketing/cta";
import JsonLd from "@/components/marketing/json-ld";
import MarkdownProse from "@/components/marketing/markdown-prose";
import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import NiChevronLeftSmall from "@/icons/nexture/ni-chevron-left-small";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";
import { getHelpArticle } from "@/lib/public-content";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const [t, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  const article = await getHelpArticle(locale, slug);
  if (!article) return { title: t("help-meta-title"), description: t("help-meta-description") };
  return { title: article.title, description: article.excerpt ?? t("help-meta-description") };
}

/** One help article: Markdown body, freshness date and sibling articles. */
export default async function HelpArticlePage({ params }: Params) {
  const { slug } = await params;
  const t = await getTranslations("marketing");
  const locale = await getLocale();
  const article = await getHelpArticle(locale, slug);
  if (!article) notFound();

  const updated = new Date(article.updatedAt).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: article.title,
          description: article.excerpt ?? undefined,
          datePublished: article.publishedAt ?? undefined,
          dateModified: article.updatedAt,
        }}
      />

      <Section decor="glow">
        <div className="mx-auto w-full max-w-prose">
          <Link
            href="/help"
            className="text-text-secondary hover:text-primary mb-6 inline-flex flex-row items-center gap-1 text-sm font-medium transition-colors"
          >
            <NiChevronLeftSmall size="small" />
            {t("help-article-back")}
          </Link>
          <SectionHeader
            as="h1"
            align="start"
            eyebrow={article.categoryName}
            title={article.title}
            subtitle={article.excerpt ?? undefined}
            className="mb-6 md:mb-8"
          />
          <p className="text-text-secondary mb-8 text-sm">{t("help-article-updated", { date: updated })}</p>
        </div>
        <MarkdownProse>{article.bodyMd}</MarkdownProse>
      </Section>

      {article.related.length > 0 && (
        <Section background="paper">
          <SectionHeader title={t("help-related-title")} />
          <Reveal stagger={0.08} className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
            {article.related.map((related) => (
              <Link
                key={related.slug}
                href={`/help/${related.slug}`}
                className="group border-grey-100 bg-background-paper flex flex-row items-center justify-between gap-3 rounded-2xl border p-5"
              >
                <span className="flex flex-col gap-1">
                  <span className="text-text-primary group-hover:text-primary font-medium transition-colors">
                    {related.title}
                  </span>
                  {related.excerpt && <span className="text-text-secondary text-sm">{related.excerpt}</span>}
                </span>
                <NiChevronRightSmall
                  size="small"
                  className="text-text-secondary group-hover:text-primary shrink-0 transition-colors"
                />
              </Link>
            ))}
          </Reveal>
        </Section>
      )}

      <Cta
        title={t("help-contact-title")}
        subtitle={t("help-contact-subtitle")}
        cta={{ label: t("help-contact-cta"), href: "/contact" }}
      />
    </>
  );
}
