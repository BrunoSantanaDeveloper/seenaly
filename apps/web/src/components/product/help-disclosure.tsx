"use client";

import { useState } from "react";

import { Box, Button, Collapse } from "@mui/material";

import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import { cn } from "@/lib/utils";

/**
 * Contextual, opt-in help — teaches a concept AT the point of doubt without
 * cluttering the form for people who already know. Collapsed by default; one
 * tap reveals the explanation. Use for the recurring mental-model questions a
 * beginner hits mid-flow (e.g. "is each plan a separate product?").
 */
export default function HelpDisclosure({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Box className={cn("border-grey-50 mb-3 rounded-2xl border", className)}>
      <Button
        variant="text"
        color="grey"
        fullWidth
        className="justify-between! px-3! py-2!"
        aria-expanded={open}
        endIcon={<NiChevronDownSmall className={cn("transition-transform", open && "rotate-180")} />}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </Button>
      <Collapse in={open}>
        <Box className="text-text-secondary px-3 pb-3 text-sm leading-6">{children}</Box>
      </Collapse>
    </Box>
  );
}
