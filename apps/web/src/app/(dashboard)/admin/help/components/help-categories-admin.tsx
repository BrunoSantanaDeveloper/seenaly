"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Box, Button, Chip, Switch, Tooltip, Typography } from "@mui/material";

import { Field, RowLine, RowText, SelectField } from "@/app/(dashboard)/admin/billing/components/catalog-shared";
import EmptyState from "@/components/product/empty-state";
import { LOCALES } from "@/constants";
import NiQuestionHexagon from "@/icons/nexture/ni-question-hexagon";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@flyee/auth/client";

export type HelpCategoryRow = {
  id: string;
  locale: string;
  slug: string;
  name: string;
  description: string | null;
  sort: number;
  isPublished: boolean;
};

type FormState = {
  id: string | null;
  locale: string;
  slug: string;
  name: string;
  description: string;
  sort: number;
  isPublished: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  locale: "en",
  slug: "",
  name: "",
  description: "",
  sort: 0,
  isPublished: true,
};

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Help-center categories: one row per locale, ordered by `sort`. */
export default function HelpCategoriesAdmin() {
  const [rows, setRows] = useState<HelpCategoryRow[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: readError } = await supabase
      .from("help_categories")
      .select("id, locale, slug, name, description, sort, is_published")
      .order("locale")
      .order("sort");
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
        name: row.name,
        description: row.description,
        sort: row.sort,
        isPublished: row.is_published,
      })),
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async () => {
    if (!form || !form.name.trim()) return;
    setError(null);
    const supabase = createClient();
    const payload = {
      locale: form.locale,
      slug: form.slug.trim() || slugify(form.name),
      name: form.name.trim(),
      description: form.description.trim() || null,
      sort: Number(form.sort) || 0,
      is_published: form.isPublished,
    };
    const query = form.id
      ? supabase.from("help_categories").update(payload).eq("id", form.id)
      : supabase.from("help_categories").insert(payload);
    const { error: writeError } = await query;
    if (writeError) {
      setError(writeError.message);
      return;
    }
    recordAudit(supabase, form.id ? "admin.help.category.updated" : "admin.help.category.created", {
      entityType: "help_category",
      entityId: form.id ?? undefined,
      metadata: { name: payload.name, locale: payload.locale },
    });
    setForm(null);
    refresh();
  };

  const remove = async (id: string) => {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("help_categories").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    recordAudit(supabase, "admin.help.category.deleted", { entityType: "help_category", entityId: id });
    setForm(null);
    refresh();
  };

  return (
    <Box className="flex flex-col gap-3">
      {error && (
        <Alert severity="error" className="neutral bg-background-paper/60!">
          {error}
        </Alert>
      )}

      {!form && (
        <Box>
          <Button variant="outlined" size="small" onClick={() => setForm(EMPTY_FORM)}>
            New category
          </Button>
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
            <Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
            <Field
              label="Slug (empty = from name)"
              value={form.slug}
              onChange={(value) => setForm({ ...form, slug: value })}
            />
          </Box>
          <Field
            label="Description (optional)"
            value={form.description}
            onChange={(value) => setForm({ ...form, description: value })}
          />
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
            <Button variant="contained" size="small" onClick={save} disabled={!form.name.trim()}>
              {form.id ? "Save changes" : "Create category"}
            </Button>
            <Button variant="text" color="grey" size="small" onClick={() => setForm(null)}>
              Cancel
            </Button>
            {form.id && (
              <Button variant="text" color="error" size="small" onClick={() => remove(form.id!)}>
                Delete category (and all its articles)
              </Button>
            )}
          </Box>
        </Box>
      )}

      {loaded && rows.length === 0 && !form && (
        <EmptyState
          icon={<NiQuestionHexagon size="medium" />}
          title="No help categories yet"
          description="Categories group the articles on the public /help page. Start with the two or three topics customers ask about most."
          action={{ label: "New category", onClick: () => setForm(EMPTY_FORM) }}
        />
      )}

      {rows.map((row) => (
        <RowLine key={row.id}>
          <RowText primary={row.name} secondary={`${row.slug}${row.description ? ` · ${row.description}` : ""}`} />
          <Chip label={row.locale} size="small" variant="outlined" />
          {!row.isPublished && <Chip label="hidden" size="small" color="warning" variant="outlined" />}
          <Tooltip title="Edit">
            <Button
              size="small"
              variant="text"
              color="grey"
              onClick={() =>
                setForm({
                  id: row.id,
                  locale: row.locale,
                  slug: row.slug,
                  name: row.name,
                  description: row.description ?? "",
                  sort: row.sort,
                  isPublished: row.isPublished,
                })
              }
            >
              Edit
            </Button>
          </Tooltip>
        </RowLine>
      ))}
    </Box>
  );
}
