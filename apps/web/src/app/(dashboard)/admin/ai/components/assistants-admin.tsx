"use client";

import { Field, RowLine, RowText, SelectField } from "../../billing/components/catalog-shared";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  TextareaAutosize,
  Tooltip,
  Typography,
} from "@mui/material";

import NiPen from "@/icons/nexture/ni-pen";
import NiPlus from "@/icons/nexture/ni-plus";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@flyee/auth/client";

type AssistantForm = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  credits_per_message: number;
  is_active: boolean;
  sort: number;
};

const EMPTY: AssistantForm = {
  slug: "",
  name: "",
  description: "",
  provider: "anthropic",
  model: "claude-sonnet-5",
  system_prompt: "",
  temperature: 0.7,
  max_tokens: 2048,
  credits_per_message: 0,
  is_active: true,
  sort: 0,
};

const MODEL_HINT: Record<string, string> = {
  anthropic: "e.g. claude-sonnet-5, claude-haiku-4-5",
  gemini: "e.g. gemini-2.5-flash, gemini-2.5-pro",
  openrouter: "REQUIRED full id, e.g. openai/gpt-4o, anthropic/claude-sonnet-5",
};

export default function AssistantsAdmin() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<AssistantForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("assistants").select("*").order("sort");
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openEdit = (row?: Record<string, unknown>) => {
    setError(null);
    setForm(
      row
        ? {
            id: row.id as string,
            slug: row.slug as string,
            name: row.name as string,
            description: (row.description as string) ?? "",
            provider: row.provider as string,
            model: row.model as string,
            system_prompt: row.system_prompt as string,
            temperature: Number(row.temperature),
            max_tokens: row.max_tokens as number,
            credits_per_message: row.credits_per_message as number,
            is_active: row.is_active as boolean,
            sort: row.sort as number,
          }
        : EMPTY,
    );
  };

  const save = async () => {
    if (!form) return;
    setError(null);
    if (!form.model.trim()) {
      setError("Model is required.");
      return;
    }
    if (!form.system_prompt.trim()) {
      setError("System instructions are required — that is the whole point of an assistant.");
      return;
    }
    const supabase = createClient();
    const { error: saveError } = await supabase.from("assistants").upsert({
      ...(form.id ? { id: form.id } : {}),
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description || null,
      provider: form.provider,
      model: form.model.trim(),
      system_prompt: form.system_prompt,
      temperature: form.temperature,
      max_tokens: Number(form.max_tokens) || 2048,
      credits_per_message: Number(form.credits_per_message) || 0,
      is_active: form.is_active,
      sort: Number(form.sort) || 0,
    });
    if (saveError) {
      setError(saveError.message);
      return;
    }
    recordAudit(supabase, form.id ? "admin.ai.assistant.updated" : "admin.ai.assistant.created", {
      entityType: "assistant",
      entityId: form.id || undefined,
      metadata: { slug: form.slug.trim(), provider: form.provider },
    });
    setForm(null);
    refresh();
  };

  return (
    <Box className="flex flex-col gap-3">
      <Box>
        <Button
          variant="outlined"
          size="small"
          color="grey"
          startIcon={<NiPlus size="small" />}
          onClick={() => openEdit()}
        >
          New assistant
        </Button>
      </Box>
      {rows.map((row) => (
        <RowLine key={row.id as string}>
          <RowText
            primary={`${row.name} (${row.slug})`}
            secondary={`${row.provider} · ${row.model} · ${row.credits_per_message} credits/message`}
          />
          {!(row.is_active as boolean) && <Chip label="inactive" size="small" variant="outlined" />}
          <Tooltip title="Edit">
            <Button className="icon-only" size="small" color="grey" variant="text" onClick={() => openEdit(row)}>
              <NiPen size="medium" />
            </Button>
          </Tooltip>
        </RowLine>
      ))}

      <Dialog open={form !== null} onClose={() => setForm(null)} maxWidth="md" fullWidth>
        <DialogTitle>{form?.id ? "Edit assistant" : "New assistant"}</DialogTitle>
        {form && (
          <DialogContent className="flex flex-col">
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
            <Field
              label="Description"
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
            />
            <SelectField
              label="Provider"
              value={form.provider}
              options={[
                { value: "anthropic", label: "Anthropic" },
                { value: "gemini", label: "Gemini (audio + image)" },
                { value: "openrouter", label: "OpenRouter (multi-model)" },
              ]}
              onChange={(v) => setForm({ ...form, provider: v })}
            />
            <Field
              label={`Model — ${MODEL_HINT[form.provider] ?? ""}`}
              value={form.model}
              onChange={(v) => setForm({ ...form, model: v })}
            />
            <FormControl className="outlined" variant="standard" size="small" fullWidth>
              <FormLabel component="label">System instructions (the assistant behavior contract)</FormLabel>
              <TextareaAutosize
                minRows={8}
                className="MuiInputBase-root MuiInput-root w-full"
                value={form.system_prompt}
                onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
              />
            </FormControl>
            <Box className="flex flex-col gap-0 md:flex-row md:gap-4">
              <Field
                label="Temperature (0-1)"
                type="number"
                value={form.temperature}
                onChange={(v) => setForm({ ...form, temperature: Number(v) })}
              />
              <Field
                label="Max tokens"
                type="number"
                value={form.max_tokens}
                onChange={(v) => setForm({ ...form, max_tokens: Number(v) })}
              />
              <Field
                label="Credits per message"
                type="number"
                value={form.credits_per_message}
                onChange={(v) => setForm({ ...form, credits_per_message: Number(v) })}
              />
              <Field
                label="Sort"
                type="number"
                value={form.sort}
                onChange={(v) => setForm({ ...form, sort: Number(v) })}
              />
            </Box>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
              }
              label="Active"
            />
            <Typography variant="body2" className="text-text-secondary">
              Audio input requires Gemini (or an audio-capable OpenRouter model). Images work on all providers.
            </Typography>
            {error && (
              <Alert severity="error" className="neutral bg-background-paper/60! mt-2">
                {error}
              </Alert>
            )}
          </DialogContent>
        )}
        <DialogActions>
          <Button color="grey" variant="text" onClick={() => setForm(null)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
