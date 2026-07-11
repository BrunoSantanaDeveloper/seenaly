import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Anonymous Supabase client for PUBLIC content (help center, blog) —
 * usable from pages, generateMetadata and sitemap.ts, none of which have
 * a user session. RLS only exposes published rows to anon. Returns null
 * when Supabase is not configured so every caller degrades gracefully.
 */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type HelpArticleSummary = {
  slug: string;
  title: string;
  excerpt: string | null;
};

export type HelpCategoryWithArticles = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  articles: HelpArticleSummary[];
};

export type HelpArticleFull = {
  slug: string;
  title: string;
  excerpt: string | null;
  bodyMd: string;
  publishedAt: string | null;
  updatedAt: string;
  categoryName: string;
  related: HelpArticleSummary[];
};

/** Published help content for a locale, falling back to 'en' when empty. */
export async function listHelpContent(locale: string): Promise<HelpCategoryWithArticles[]> {
  const supabase = createAnonClient();
  if (!supabase) return [];

  const fetchFor = async (target: string) => {
    const { data } = await supabase
      .from("help_categories")
      .select("id, slug, name, description, sort, help_articles(slug, title, excerpt, sort, is_published)")
      .eq("locale", target)
      .eq("is_published", true)
      .order("sort");
    return data ?? [];
  };

  let rows = await fetchFor(locale);
  if (rows.length === 0 && locale !== "en") rows = await fetchFor("en");

  return rows
    .map((row) => ({
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      description: row.description as string | null,
      articles: (
        (row.help_articles as {
          slug: string;
          title: string;
          excerpt: string | null;
          sort: number;
          is_published: boolean;
        }[]) ?? []
      )
        .filter((article) => article.is_published)
        .sort((a, b) => a.sort - b.sort)
        .map(({ slug, title, excerpt }) => ({ slug, title, excerpt })),
    }))
    .filter((category) => category.articles.length > 0);
}

/** One published article (locale falls back to 'en') with its siblings. */
export async function getHelpArticle(locale: string, slug: string): Promise<HelpArticleFull | null> {
  const supabase = createAnonClient();
  if (!supabase) return null;

  const fetchFor = async (target: string) => {
    const { data } = await supabase
      .from("help_articles")
      .select("slug, title, excerpt, body_md, published_at, updated_at, category_id, help_categories(name)")
      .eq("locale", target)
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    return data;
  };

  let row = await fetchFor(locale);
  let usedLocale = locale;
  if (!row && locale !== "en") {
    row = await fetchFor("en");
    usedLocale = "en";
  }
  if (!row) return null;

  const { data: siblings } = await supabase
    .from("help_articles")
    .select("slug, title, excerpt")
    .eq("category_id", row.category_id)
    .eq("locale", usedLocale)
    .eq("is_published", true)
    .neq("slug", slug)
    .order("sort")
    .limit(4);

  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    bodyMd: row.body_md,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    categoryName: (row.help_categories as unknown as { name: string } | null)?.name ?? "",
    related: siblings ?? [],
  };
}

/** Published article slugs for the default locale — sitemap entries. */
export async function listHelpSlugs(locale: string): Promise<string[]> {
  const supabase = createAnonClient();
  if (!supabase) return [];
  const { data } = await supabase.from("help_articles").select("slug").eq("locale", locale).eq("is_published", true);
  return (data ?? []).map((row) => row.slug);
}

export type BlogPostSummary = {
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  authorName: string | null;
  tags: string[];
  publishedAt: string | null;
};

export type BlogPostFull = BlogPostSummary & {
  bodyMd: string;
  updatedAt: string;
};

/** Published blog posts for a locale (newest first), 'en' fallback. */
export async function listBlogPosts(locale: string): Promise<BlogPostSummary[]> {
  const supabase = createAnonClient();
  if (!supabase) return [];

  const fetchFor = async (target: string) => {
    const { data } = await supabase
      .from("blog_posts")
      .select("slug, title, excerpt, cover_url, author_name, tags, published_at")
      .eq("locale", target)
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(50);
    return data ?? [];
  };

  let rows = await fetchFor(locale);
  if (rows.length === 0 && locale !== "en") rows = await fetchFor("en");

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverUrl: row.cover_url,
    authorName: row.author_name,
    tags: row.tags ?? [],
    publishedAt: row.published_at,
  }));
}

/** One published blog post (locale falls back to 'en'). */
export async function getBlogPost(locale: string, slug: string): Promise<(BlogPostFull & { id: string }) | null> {
  const supabase = createAnonClient();
  if (!supabase) return null;

  const fetchFor = async (target: string) => {
    const { data } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, body_md, cover_url, author_name, tags, published_at, updated_at")
      .eq("locale", target)
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    return data;
  };

  let row = await fetchFor(locale);
  if (!row && locale !== "en") row = await fetchFor("en");
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    bodyMd: row.body_md,
    coverUrl: row.cover_url,
    authorName: row.author_name,
    tags: row.tags ?? [],
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

/** Published post slugs for the default locale — sitemap entries. */
export async function listBlogSlugs(locale: string): Promise<string[]> {
  const supabase = createAnonClient();
  if (!supabase) return [];
  const { data } = await supabase.from("blog_posts").select("slug").eq("locale", locale).eq("is_published", true);
  return (data ?? []).map((row) => row.slug);
}
