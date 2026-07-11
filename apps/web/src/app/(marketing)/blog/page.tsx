import { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import Cta from "@/components/marketing/cta";
import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import { TONE, toneAt } from "@/components/marketing/tone";
import { listBlogPosts } from "@/lib/public-content";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing");
  return { title: t("blog-meta-title"), description: t("blog-meta-description") };
}

/**
 * Blog index over the DB-managed posts (/admin/blog). The newest post
 * leads full-width; covers are optional — postless and coverless states
 * both stay on the committed direction (token gradients, tone hues).
 */
export default async function BlogPage() {
  const t = await getTranslations("marketing");
  const locale = await getLocale();
  const posts = await listBlogPosts(locale);

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <>
      <Section decor="glow">
        <SectionHeader as="h1" eyebrow={t("blog-eyebrow")} title={t("blog-title")} subtitle={t("blog-subtitle")} />
      </Section>

      {posts.length > 0 ? (
        <Section decor="gradient-edge">
          <Reveal stagger={0.08} className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {posts.map((post, index) => {
              const tone = TONE[toneAt(index)];
              const featured = index === 0;
              return (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className={cn(
                    "group border-grey-100 bg-background-paper flex flex-col overflow-hidden rounded-4xl border",
                    featured && "md:col-span-2",
                  )}
                >
                  {post.coverUrl ? (
                    // Cover URLs are DB-managed (arbitrary hosts), so next/image
                    // remote config cannot know them ahead of time.

                    <img
                      src={post.coverUrl}
                      alt={post.title}
                      className={cn("w-full object-cover", featured ? "max-h-80" : "max-h-52")}
                    />
                  ) : (
                    <div
                      aria-hidden
                      className={cn("w-full", featured ? "h-40" : "h-24")}
                      style={{
                        background: `linear-gradient(120deg, hsl(var(${tone.cssVar}) / 0.18), hsl(var(${tone.cssVar}) / 0.04))`,
                      }}
                    />
                  )}
                  <div className="flex flex-col gap-3 p-6 md:p-8">
                    <p className="text-text-secondary text-sm">
                      {formatDate(post.publishedAt)}
                      {post.authorName ? ` · ${post.authorName}` : ""}
                    </p>
                    <h2
                      className={cn(
                        "font-display text-text-primary group-hover:text-primary font-bold transition-colors",
                        featured ? "text-display-md" : "text-xl",
                      )}
                    >
                      {post.title}
                    </h2>
                    {post.excerpt && <p className="text-text-secondary text-base leading-6">{post.excerpt}</p>}
                    {post.tags.length > 0 && (
                      <div className="flex flex-row flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`${tone.softBg} ${tone.text} rounded-full px-3 py-1 text-xs font-medium`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </Reveal>
        </Section>
      ) : (
        <Section>
          <Reveal>
            <div className="border-grey-100 mx-auto flex max-w-xl flex-col items-center gap-3 rounded-4xl border border-dashed px-6 py-14 text-center">
              <h2 className="font-display text-text-primary text-xl font-bold">{t("blog-empty-title")}</h2>
              <p className="text-text-secondary text-base leading-6">{t("blog-empty-hint")}</p>
            </div>
          </Reveal>
        </Section>
      )}

      <Cta
        title={t("cta-title")}
        subtitle={t("cta-subtitle")}
        cta={{ label: t("cta-primary"), href: "/auth/sign-up" }}
      />
    </>
  );
}
