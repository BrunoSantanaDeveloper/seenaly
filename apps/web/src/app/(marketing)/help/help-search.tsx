"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { FormControl, Input } from "@mui/material";

import NiSearch from "@/icons/nexture/ni-search";

export type SearchableArticle = {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string;
};

/**
 * Client-side help search over the published articles the server already
 * fetched — instant, no extra API. Results replace nothing: the category
 * grid below stays put, this only overlays matches while typing.
 */
export default function HelpSearch({
  articles,
  placeholder,
  emptyLabel,
}: {
  articles: SearchableArticle[];
  placeholder: string;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return articles
      .filter(
        (article) =>
          article.title.toLowerCase().includes(q) ||
          (article.excerpt ?? "").toLowerCase().includes(q) ||
          article.category.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [articles, query]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <FormControl className="outlined" variant="standard" size="medium" fullWidth>
        <Input
          startAdornment={<NiSearch size="medium" className="text-text-secondary mr-2" />}
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </FormControl>

      {query.trim() && (
        <div className="border-grey-100 bg-background-paper flex flex-col overflow-hidden rounded-2xl border">
          {results.map((article) => (
            <Link
              key={article.slug}
              href={`/help/${article.slug}`}
              className="hover:bg-primary/5 border-grey-50 flex flex-col gap-0.5 border-b px-4 py-3 last:border-b-0"
            >
              <span className="text-text-primary font-medium">{article.title}</span>
              <span className="text-text-secondary text-sm">
                {article.category}
                {article.excerpt ? ` — ${article.excerpt}` : ""}
              </span>
            </Link>
          ))}
          {results.length === 0 && <p className="text-text-secondary px-4 py-3 text-sm">{emptyLabel}</p>}
        </div>
      )}
    </div>
  );
}
