"use client";

import { useState } from "react";

import { Box, Button, Chip } from "@mui/material";

import NiCross from "@/icons/nexture/ni-cross";
import NiPlus from "@/icons/nexture/ni-plus";

export type OptionalField = {
  key: string;
  /** Chip text when the field is not yet shown (e.g. "Preço"). */
  chipLabel: string;
  /** Whether the field already holds a value — drives the initial shown set. */
  filled: boolean;
  /** The input, already wired to Formik. */
  node: React.ReactNode;
};

/**
 * "Mark what you know" — the anti-clutter mechanism for onboarding.
 *
 * A beginner should never face a wall of fields for data they don't have. This
 * group shows ONLY the fields the user opted into: everything starts as compact
 * "add" chips, and tapping one reveals its input. Removing a field clears its
 * value and hides it again. On edit, fields that already have a value start
 * shown; empty ones stay behind chips — so the same mechanism declutters both
 * the create wizard and the edit form. (docs/PRODUCT.md #6: value is never
 * gated behind data the beginner lacks.)
 */
export default function OptionalFieldGroup({
  fields,
  onRemove,
  removeLabel,
  addHint,
}: {
  fields: OptionalField[];
  /** Clear the Formik value for a field when the user removes it. */
  onRemove: (key: string) => void;
  /** aria-label for the per-field remove button. */
  removeLabel: string;
  /** Optional one-line hint shown above the chips (e.g. "Marque o que já sabe"). */
  addHint?: string;
}) {
  // Shown once opted-in OR already filled (edit). Initialized once from `filled`.
  const [shown, setShown] = useState<Set<string>>(() => new Set(fields.filter((f) => f.filled).map((f) => f.key)));

  const add = (key: string) => setShown((prev) => new Set(prev).add(key));
  const remove = (key: string) => {
    onRemove(key);
    setShown((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const active = fields.filter((f) => shown.has(f.key));
  const available = fields.filter((f) => !shown.has(f.key));

  return (
    <Box className="flex flex-col gap-3">
      {active.map((field) => (
        <Box key={field.key} className="flex flex-row items-start gap-2">
          <Box className="grow">{field.node}</Box>
          <Button
            className="icon-only mt-6 shrink-0"
            size="small"
            color="grey"
            variant="text"
            aria-label={`${removeLabel}: ${field.chipLabel}`}
            onClick={() => remove(field.key)}
          >
            <NiCross size="small" />
          </Button>
        </Box>
      ))}

      {available.length > 0 && (
        <Box className="flex flex-col gap-1.5">
          {addHint && active.length === 0 && <span className="text-text-secondary text-sm">{addHint}</span>}
          <Box className="flex flex-row flex-wrap gap-1.5">
            {available.map((field) => (
              <Chip
                key={field.key}
                label={field.chipLabel}
                icon={<NiPlus size="small" />}
                variant="outlined"
                color="primary"
                onClick={() => add(field.key)}
                className="cursor-pointer"
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
