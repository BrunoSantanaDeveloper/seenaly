"use client";

import { slugify } from "./help-categories-admin";
import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Chip, FormControl, FormLabel, Input, Switch, Tooltip, Typography } from "@mui/material";

import { Field, RowLine, RowText, SelectField } from "@/app/(dashboard)/admin/billing/components/catalog-shared";
import EmptyState from "@/components/product/empty-state";
import { LOCALES } from "@/constants";
import NiDocumentFull from "@/icons/nexture/ni-document-full";
import { createClient } from "@flyee/auth/client";

type CategoryOption = { id: string; locale: string; name: string };

type ArticleRow = {
  id: string;
  categoryId: string;
  locale: string;
  slug: string;
  title: string;
  excerpt: string | null;
  bodyMd: string;
  sort: number;
  isPublished: boolean;
  updatedAt: string;
};

type FormState = {
  id: string | null;
  categoryId: string;
  locale: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  sort: number;
  isPublished: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  categoryId: "",
  locale: "en",
  slug: "",
  title: "",
  excerpt: "",
  bodyMd: "",
  sort: 0,
  isPublished: false,
};

/**
 * Help articles: written in Markdown per locale, published with a switch —
 * the public /help page updates without a deploy.
 */
export default function HelpArticlesAdmin() {
  const [rows, setRows] = useState<ArticleRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [{ data: articles, error: readError }, { data: cats }] = await Promise.all([
      supabase
        .from("help_articles")
        .select("id, category_id, locale, slug, title, excerpt, body_md, sort, is_published, updated_at")
        .order("locale")
        .order("sort"),
      supabase.from("help_categories").select("id, locale, name").order("locale").order("sort"),
    ]);
    if (readError) {
      setError(readError.message);
      setLoaded(true);
      return;
    }
    setRows(
      (articles ?? []).map((row) => ({
        id: row.id,
        categoryId: row.category_id,
        locale: row.locale,
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt,
        bodyMd: row.body_md,
        sort: row.sort,
        isPublished: row.is_published,
        updatedAt: row.updated_at,
      })),
    );
    setCategories((cats ?? []).map((cat) => ({ id: cat.id, locale: cat.locale, name: cat.name })));
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async () => {
    if (!form || !form.title.trim() || !form.categoryId) return;
    setError(null);
    const supabase = createClient();
    const payload = {
      category_id: form.categoryId,
      locale: form.locale,
      slug: form.slug.trim() || slugify(form.title),
      title: form.title.trim(),
      excerpt: form.excerpt.trim() || null,
      body_md: form.bodyMd,
      sort: Number(form.sort) || 0,
      is_published: form.isPublished,
    };
    const query = form.id
      ? supabase.from("help_articles").update(payload).eq("id", form.id)
      : supabase.from("help_articles").insert(payload);
    const { error: writeError } = await query;
    if (writeError) {
      setError(writeError.message);
      return;
    }
    setForm(null);
    refresh();
  };

  const remove = async (id: string) => {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("help_articles").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setForm(null);
    refresh();
  };

  const togglePublished = async (row: ArticleRow) => {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("help_articles")
      .update({ is_published: !row.isPublished })
      .eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    refresh();
  };

  const categoryName = (id: string) => categories.find((cat) => cat.id === id)?.name ?? "?";
  const formCategories = form ? categories.filter((cat) => cat.locale === form.locale) : [];

  const visible = rows.filter(
    (row) =>
      !filter ||
      row.title.toLowerCase().includes(filter.toLowerCase()) ||
      row.slug.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <Box className="flex flex-col gap-3">
      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60!">
          {error}
        </Alert>
      )}

      {!form && (
        <Box className="flex flex-row items-center gap-3">
          <Button variant="outlined" size="small" onClick={() => setForm(EMPTY_FORM)}>
            New article
          </Button>
          <FormControl className="outlined w-72" variant="standard" size="small">
            <Input placeholder="Filter by title or slug" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </FormControl>
        </Box>
      )}

      {form && (
        <Box className="border-grey-100 flex flex-col gap-3 rounded-2xl border p-4">
          <Box className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SelectField
              label="Locale"
              value={form.locale}
              options={LOCALES.map((locale) => ({ value: locale, label: locale }))}
              onChange={(value) => setForm({ ...form, locale: value, categoryId: "" })}
            />
            <SelectField
              label="Category (same locale)"
              value={form.categoryId}
              options={formCategories.map((cat) => ({ value: cat.id, label: cat.name }))}
              onChange={(value) => setForm({ ...form, categoryId: value })}
            />
            <Field
              label="Slug (empty = from title)"
              value={form.slug}
              onChange={(value) => setForm({ ...form, slug: value })}
            />
          </Box>
          {formCategories.length === 0 && (
            <Alert severity="info" className="neutral bg-background-paper/60!">
              No category exists for this locale yet — create one in the Categories tab first.
            </Alert>
          )}
          <Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          <Field
            label="Excerpt (shown in the article list)"
            value={form.excerpt}
            onChange={(value) => setForm({ ...form, excerpt: value })}
          />
          <FormControl className="outlined" variant="standard" size="small" fullWidth>
            <FormLabel component="label">Body (Markdown)</FormLabel>
            <Input
              multiline
              minRows={10}
              value={form.bodyMd}
              onChange={(e) => setForm({ ...form, bodyMd: e.target.value })}
              className="font-mono"
            />
          </FormControl>
          <Box className="flex flex-row items-center gap-4">
            <Field
              label="Sort"
              type="number"
              className="w-24"
              value={form.sort}
              onChange={(value) => setForm({ ...form, sort: Number(value) })}
            />
            <Box className="flex flex-row items-center gap-2">
              <Switch
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                size="small"
              />
              <Typography variant="body2">Published</Typography>
            </Box>
          </Box>
          <Box className="flex flex-row gap-2">
            <Button variant="contained" size="small" onClick={save} disabled={!form.title.trim() || !form.categoryId}>
              {form.id ? "Save changes" : "Create article"}
            </Button>
            <Button variant="text" color="grey" size="small" onClick={() => setForm(null)}>
              Cancel
            </Button>
            {form.id && (
              <Button variant="text" color="error" size="small" onClick={() => remove(form.id!)}>
                Delete article
              </Button>
            )}
          </Box>
        </Box>
      )}

      {loaded && rows.length === 0 && !form && (
        <EmptyState
          icon={<NiDocumentFull size="medium" />}
          title="No help articles yet"
          description="Write the first article customers will find at /help — start with the question your support inbox answers most often."
          action={{ label: "New article", onClick: () => setForm(EMPTY_FORM) }}
        />
      )}

      {visible.map((row) => (
        <RowLine key={row.id}>
          <RowText
            primary={row.title}
            secondary={`${categoryName(row.categoryId)} · /help/${row.slug} · updated ${new Date(row.updatedAt).toLocaleDateString()}`}
          />
          <Chip label={row.locale} size="small" variant="outlined" />
          <Chip
            label={row.isPublished ? "published" : "draft"}
            size="small"
            color={row.isPublished ? "success" : "default"}
            variant="outlined"
          />
          <Tooltip title={row.isPublished ? "Unpublish" : "Publish"}>
            <Switch checked={row.isPublished} onChange={() => togglePublished(row)} size="small" />
          </Tooltip>
          <Button
            size="small"
            variant="text"
            color="grey"
            onClick={() =>
              setForm({
                id: row.id,
                categoryId: row.categoryId,
                locale: row.locale,
                slug: row.slug,
                title: row.title,
                excerpt: row.excerpt ?? "",
                bodyMd: row.bodyMd,
                sort: row.sort,
                isPublished: row.isPublished,
              })
            }
          >
            Edit
          </Button>
        </RowLine>
      ))}
      {loaded && visible.length === 0 && rows.length > 0 && (
        <Typography variant="body2" className="text-text-secondary">
          No articles match the filter.
        </Typography>
      )}
    </Box>
  );
}
