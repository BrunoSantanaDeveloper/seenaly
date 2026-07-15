"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Chip, FormControl, FormLabel, Input, Switch, Tooltip, Typography } from "@mui/material";

import { Field, RowLine, RowText, SelectField } from "@/app/(dashboard)/admin/billing/components/catalog-shared";
import { slugify } from "@/app/(dashboard)/admin/help/components/help-categories-admin";
import EmptyState from "@/components/product/empty-state";
import { LOCALES } from "@/constants";
import NiDocumentFull from "@/icons/nexture/ni-document-full";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@flyee/auth/client";

type PostRow = {
  id: string;
  locale: string;
  slug: string;
  title: string;
  excerpt: string | null;
  bodyMd: string;
  coverUrl: string | null;
  authorName: string | null;
  tags: string[];
  isPublished: boolean;
  publishedAt: string | null;
};

type FormState = {
  id: string | null;
  locale: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMd: string;
  coverUrl: string;
  authorName: string;
  tags: string;
  isPublished: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  locale: "en",
  slug: "",
  title: "",
  excerpt: "",
  bodyMd: "",
  coverUrl: "",
  authorName: "",
  tags: "",
  isPublished: false,
};

/** Blog posts: Markdown per locale, published to /blog with a switch. */
export default function BlogPostsAdmin() {
  const [rows, setRows] = useState<PostRow[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: readError } = await supabase
      .from("blog_posts")
      .select("id, locale, slug, title, excerpt, body_md, cover_url, author_name, tags, is_published, published_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (readError) {
      setError(readError.message);
      setLoaded(true);
      return;
    }
    setRows(
      (data ?? []).map((row) => ({
        id: row.id,
        locale: row.locale,
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt,
        bodyMd: row.body_md,
        coverUrl: row.cover_url,
        authorName: row.author_name,
        tags: row.tags ?? [],
        isPublished: row.is_published,
        publishedAt: row.published_at,
      })),
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async () => {
    if (!form || !form.title.trim()) return;
    setError(null);
    const supabase = createClient();
    const payload = {
      locale: form.locale,
      slug: form.slug.trim() || slugify(form.title),
      title: form.title.trim(),
      excerpt: form.excerpt.trim() || null,
      body_md: form.bodyMd,
      cover_url: form.coverUrl.trim() || null,
      author_name: form.authorName.trim() || null,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      is_published: form.isPublished,
    };
    const query = form.id
      ? supabase.from("blog_posts").update(payload).eq("id", form.id)
      : supabase.from("blog_posts").insert(payload);
    const { error: writeError } = await query;
    if (writeError) {
      setError(writeError.message);
      return;
    }
    recordAudit(supabase, form.id ? "admin.blog.post.updated" : "admin.blog.post.created", {
      entityType: "blog_post",
      entityId: form.id ?? undefined,
      metadata: { title: payload.title, locale: payload.locale },
    });
    setForm(null);
    refresh();
  };

  const remove = async (id: string) => {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("blog_posts").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    recordAudit(supabase, "admin.blog.post.deleted", { entityType: "blog_post", entityId: id });
    setForm(null);
    refresh();
  };

  const togglePublished = async (row: PostRow) => {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("blog_posts")
      .update({ is_published: !row.isPublished })
      .eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    recordAudit(supabase, row.isPublished ? "admin.blog.post.unpublished" : "admin.blog.post.published", {
      entityType: "blog_post",
      entityId: row.id,
      metadata: { title: row.title },
    });
    refresh();
  };

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
            New post
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
              onChange={(value) => setForm({ ...form, locale: value })}
            />
            <Field
              label="Slug (empty = from title)"
              value={form.slug}
              onChange={(value) => setForm({ ...form, slug: value })}
            />
            <Field
              label="Author (optional)"
              value={form.authorName}
              onChange={(value) => setForm({ ...form, authorName: value })}
            />
          </Box>
          <Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
          <Field
            label="Excerpt (shown on the blog index)"
            value={form.excerpt}
            onChange={(value) => setForm({ ...form, excerpt: value })}
          />
          <FormControl className="outlined" variant="standard" size="small" fullWidth>
            <FormLabel component="label">Body (Markdown)</FormLabel>
            <Input
              multiline
              minRows={12}
              value={form.bodyMd}
              onChange={(e) => setForm({ ...form, bodyMd: e.target.value })}
              className="font-mono"
            />
          </FormControl>
          <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Cover image URL (optional)"
              value={form.coverUrl}
              onChange={(value) => setForm({ ...form, coverUrl: value })}
            />
            <Field
              label="Tags (comma-separated)"
              value={form.tags}
              onChange={(value) => setForm({ ...form, tags: value })}
            />
          </Box>
          <Box className="flex flex-row items-center gap-2">
            <Switch
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              size="small"
            />
            <Typography variant="body2">Published</Typography>
          </Box>
          <Box className="flex flex-row gap-2">
            <Button variant="contained" size="small" onClick={save} disabled={!form.title.trim()}>
              {form.id ? "Save changes" : "Create post"}
            </Button>
            <Button variant="text" color="grey" size="small" onClick={() => setForm(null)}>
              Cancel
            </Button>
            {form.id && (
              <Button variant="text" color="error" size="small" onClick={() => remove(form.id!)}>
                Delete post (and its comments)
              </Button>
            )}
          </Box>
        </Box>
      )}

      {loaded && rows.length === 0 && !form && (
        <EmptyState
          icon={<NiDocumentFull size="medium" />}
          title="No blog posts yet"
          description="Posts published here appear on the public /blog page — announcements, guides, product thinking."
          action={{ label: "New post", onClick: () => setForm(EMPTY_FORM) }}
        />
      )}

      {visible.map((row) => (
        <RowLine key={row.id}>
          <RowText
            primary={row.title}
            secondary={`/blog/${row.slug}${row.publishedAt ? ` · ${new Date(row.publishedAt).toLocaleDateString()}` : ""}${row.authorName ? ` · ${row.authorName}` : ""}`}
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
                locale: row.locale,
                slug: row.slug,
                title: row.title,
                excerpt: row.excerpt ?? "",
                bodyMd: row.bodyMd,
                coverUrl: row.coverUrl ?? "",
                authorName: row.authorName ?? "",
                tags: row.tags.join(", "),
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
          No posts match the filter.
        </Typography>
      )}
    </Box>
  );
}
