"use client";

import { useOptionalProductWorkspace } from "./product-workspace";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Box, Button, Card, CardContent, Chip, Typography } from "@mui/material";

import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiCheck from "@/icons/nexture/ni-check";
import NiListCheck from "@/icons/nexture/ni-list-check";

/**
 * The end of a step screen used to be a dead end: the user finished reading a
 * verdict or a plan and nothing said what came next, so the only way back to
 * the thread was navigating out to Home. This block closes that — it names the
 * next pending task and links straight into it.
 *
 * Deliberately NOT a completion celebration. It reads the SAME queue the rail
 * reads, which is derived from real state in the database, so when the last
 * task is gone it says so honestly instead of congratulating work that the data
 * cannot confirm. Rendering nothing outside a workspace (or with no queue at
 * all) keeps it safe to drop at the bottom of any screen.
 *
 * `skipSource` exists because the current screen already shows its own items in
 * full: on the readiness screen, "next" meaning another finding two rows down
 * is noise. Passing the screen's own source advances the pointer to the first
 * task that lives somewhere else — the actual handoff.
 */
export default function NextTaskCard({ skipSource }: { skipSource?: "readiness" | "creative_plan" | "launch_plan" }) {
  const t = useTranslations("workspace");
  const workspace = useOptionalProductWorkspace();
  if (!workspace) return null;

  const { tasks } = workspace;
  // Nothing generated yet: the screen's own EmptyState owns that moment.
  if (tasks.length === 0) return null;

  const next = skipSource ? tasks.find((task) => task.source !== skipSource) : tasks[0];
  const remainingHere = skipSource ? tasks.filter((task) => task.source === skipSource).length : 0;

  // Everything left belongs to this screen — the rail already lists it, so a
  // card repeating it would be noise.
  if (!next) return null;

  return (
    <Card component="section" className="mt-5">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="bg-primary/10 text-primary flex h-11 w-11 flex-none items-center justify-center rounded-2xl">
          <NiListCheck size="medium" aria-hidden />
        </span>
        <Box className="min-w-0 grow">
          <Typography variant="body2" className="text-text-secondary mb-0">
            {t("next-task-label")}
          </Typography>
          <Typography variant="subtitle1" component="p" className="mb-0">
            {next.title}
          </Typography>
          {remainingHere > 0 && (
            <Typography variant="body2" className="text-text-secondary">
              {t("next-task-remaining-here", { count: remainingHere })}
            </Typography>
          )}
        </Box>
        {next.urgent && <Chip label={t("queue-urgent")} size="small" variant="outlined" color="error" />}
        <Button
          component={Link}
          href={next.href}
          variant="contained"
          size="small"
          endIcon={<NiArrowRight size="small" />}
          className="flex-none"
        >
          {t("next-task-cta")}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * The honest end-of-queue state: shown only when the queue was LOADED and is
 * empty, never as a default. Separate component so a screen can decide whether
 * "nothing left" deserves the space.
 */
export function QueueClearCard() {
  const t = useTranslations("workspace");
  const workspace = useOptionalProductWorkspace();
  if (!workspace || workspace.tasks.length > 0) return null;

  return (
    <Card component="section" className="mt-5">
      <CardContent className="flex flex-row items-center gap-3">
        <span className="bg-success/10 text-success flex h-11 w-11 flex-none items-center justify-center rounded-2xl">
          <NiCheck size="medium" aria-hidden />
        </span>
        <Box className="min-w-0 grow">
          <Typography variant="subtitle1" component="p" className="mb-0">
            {t("queue-clear-title")}
          </Typography>
          <Typography variant="body2" className="text-text-secondary">
            {t("queue-clear-body")}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
