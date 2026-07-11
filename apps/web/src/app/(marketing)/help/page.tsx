import HelpSearch from "./help-search";
import { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import Cta from "@/components/marketing/cta";
import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import { TONE, toneAt } from "@/components/marketing/tone";
import NiBookmark from "@/icons/nexture/ni-bookmark";
import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";
import { listHelpContent } from "@/lib/public-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing");
  return { title: t("help-meta-title"), description: t("help-meta-description") };
}

/**
 * Public help center over the DB-managed articles (/admin/help). Content
 * follows the visitor's locale with an English fallback; without Supabase
 * env (fresh clone) the page renders the honest empty state.
 */
export default async function HelpPage() {
  const t = await getTranslations("marketing");
  const locale = await getLocale();
  const categories = await listHelpContent(locale);
  const searchable = categories.flatMap((category) =>
    category.articles.map((article) => ({ ...article, category: category.name })),
  );

  return (
    <>
      <Section decor="glow">
        <SectionHeader as="h1" eyebrow={t("help-eyebrow")} title={t("help-title")} subtitle={t("help-subtitle")} />
        <HelpSearch
          articles={searchable}
          placeholder={t("help-search-placeholder")}
          emptyLabel={t("help-search-empty")}
        />
      </Section>

      {categories.length > 0 ? (
        <Section decor="gradient-edge">
          <Reveal stagger={0.08} className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {categories.map((category, index) => {
              const tone = TONE[toneAt(index)];
              return (
                <article
                  key={category.id}
                  className="border-grey-100 bg-background-paper flex flex-col gap-4 rounded-4xl border p-6 md:p-8"
                >
                  <div className="flex flex-row items-center gap-3">
                    <span
                      className={`${tone.softBg} ${tone.text} flex h-11 w-11 items-center justify-center rounded-2xl [&_svg]:h-6 [&_svg]:w-6`}
                    >
                      <NiBookmark size="medium" />
                    </span>
                    <h2 className="font-display text-text-primary text-xl font-bold">{category.name}</h2>
                  </div>
                  {category.description && (
                    <p className="text-text-secondary -mt-2 text-base leading-6">{category.description}</p>
                  )}
                  <ul className="flex flex-col">
                    {category.articles.map((article) => (
                      <li key={article.slug}>
                        <Link
                          href={`/help/${article.slug}`}
                          className="group border-grey-50 flex flex-row items-center justify-between gap-2 border-b py-2.5 last:border-b-0"
                        >
                          <span className="text-text-primary group-hover:text-primary font-medium transition-colors">
                            {article.title}
                          </span>
                          <NiChevronRightSmall
                            size="small"
                            className="text-text-secondary group-hover:text-primary shrink-0 transition-colors"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </Reveal>
        </Section>
      ) : (
        <Section>
          <Reveal>
            <div className="border-grey-100 mx-auto flex max-w-xl flex-col items-center gap-3 rounded-4xl border border-dashed px-6 py-14 text-center">
              <h2 className="font-display text-text-primary text-xl font-bold">{t("help-empty-title")}</h2>
              <p className="text-text-secondary text-base leading-6">{t("help-empty-hint")}</p>
            </div>
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
