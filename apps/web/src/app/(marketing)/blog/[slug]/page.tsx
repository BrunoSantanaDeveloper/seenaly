import BlogComments from "./comments";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import Cta from "@/components/marketing/cta";
import JsonLd from "@/components/marketing/json-ld";
import MarkdownProse from "@/components/marketing/markdown-prose";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import NiChevronLeftSmall from "@/icons/nexture/ni-chevron-left-small";
import { getBlogPost } from "@/lib/public-content";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const [t, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  const post = await getBlogPost(locale, slug);
  if (!post) return { title: t("blog-meta-title"), description: t("blog-meta-description") };
  return { title: post.title, description: post.excerpt ?? t("blog-meta-description") };
}

/** One blog post: Markdown body, byline and the moderated comment thread. */
export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const t = await getTranslations("marketing");
  const locale = await getLocale();
  const post = await getBlogPost(locale, slug);
  if (!post) notFound();

  const published = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.excerpt ?? undefined,
          datePublished: post.publishedAt ?? undefined,
          dateModified: post.updatedAt,
          author: post.authorName ? { "@type": "Person", name: post.authorName } : undefined,
        }}
      />

      <Section decor="glow">
        <div className="mx-auto w-full max-w-prose">
          <Link
            href="/blog"
            className="text-text-secondary hover:text-primary mb-6 inline-flex flex-row items-center gap-1 text-sm font-medium transition-colors"
          >
            <NiChevronLeftSmall size="small" />
            {t("blog-article-back")}
          </Link>
          <SectionHeader
            as="h1"
            align="start"
            eyebrow={t("blog-eyebrow")}
            title={post.title}
            subtitle={post.excerpt ?? undefined}
            className="mb-6 md:mb-8"
          />
          <p className="text-text-secondary mb-8 text-sm">
            {t("blog-published", { date: published })}
            {post.authorName ? ` · ${post.authorName}` : ""}
          </p>
          {post.coverUrl && (
            // Cover URLs are DB-managed (arbitrary hosts), so next/image
            // remote config cannot know them ahead of time.

            <img src={post.coverUrl} alt={post.title} className="mb-8 w-full rounded-3xl object-cover" />
          )}
        </div>
        <MarkdownProse>{post.bodyMd}</MarkdownProse>
      </Section>

      <Section background="paper">
        <BlogComments postId={post.id} />
      </Section>

      <Cta
        title={t("cta-title")}
        subtitle={t("cta-subtitle")}
        cta={{ label: t("cta-primary"), href: "/auth/sign-up" }}
      />
    </>
  );
}
