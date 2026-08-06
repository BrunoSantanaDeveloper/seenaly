"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Box, Card, CardContent, Chip, Typography } from "@mui/material";

import { TONE, type Tone } from "@/components/marketing/tone";
import NiArrowRight from "@/icons/nexture/ni-arrow-right";
import NiCamera from "@/icons/nexture/ni-camera";
import NiCheck from "@/icons/nexture/ni-check";
import NiExclamationHexagon from "@/icons/nexture/ni-exclamation-hexagon";
import NiListCheck from "@/icons/nexture/ni-list-check";
import NiRocket from "@/icons/nexture/ni-rocket";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import type { JourneyTask, JourneyTaskSource } from "@/lib/journey-tasks";
import { cn } from "@/lib/utils";

/**
 * Who is here: a RETURNING user who already has a readiness verdict, a
 * creative plan or a launch plan (often more than one) and asks "what do I
 * actually do today?" — a question that used to require opening three
 * separate screens to answer. Job: one ordered list, already prioritized by
 * the engines themselves (readiness findings arrive ranked by leverage), zero
 * additional cost (every row reads data already on screen elsewhere).
 * Success: the single most valuable next click is the FIRST row, always.
 *
 * Not a table: a short, ranked action list — the row IS the action, clicking
 * it goes straight to the screen that resolves it. Capped at 5 rows; the rest
 * are summarized per source rather than paginated, since every source screen
 * already lists everything.
 */

const SOURCE_TONE: Record<JourneyTaskSource, Tone> = {
  readiness: "accent-4",
  creative_plan: "accent-1",
  launch_plan: "accent-2",
};

const SOURCE_ICON: Record<JourneyTaskSource, React.ReactNode> = {
  readiness: <NiShieldCheck size="small" />,
  creative_plan: <NiCamera size="small" />,
  launch_plan: <NiRocket size="small" />,
};

const VISIBLE_CAP = 5;

export default function TaskQueueCard({ tasks }: { tasks: JourneyTask[] }) {
  const t = useTranslations("home");

  if (tasks.length === 0) return null;

  const visible = tasks.slice(0, VISIBLE_CAP);
  const overflow = tasks.slice(VISIBLE_CAP);
  const overflowBySource = overflow.reduce<Partial<Record<JourneyTaskSource, number>>>((acc, task) => {
    acc[task.source] = (acc[task.source] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card component="section">
      <CardContent className="flex flex-col gap-3">
        <Box className="flex flex-row items-center gap-3">
          <span className="bg-primary/10 text-primary flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
            <NiListCheck size="medium" aria-hidden />
          </span>
          <Box className="grow">
            <Typography variant="h5" component="h2" className="card-title mb-0">
              {t("queue-title")}
            </Typography>
            <Typography variant="body2" className="text-text-secondary">
              {t("queue-subtitle", { count: tasks.length })}
            </Typography>
          </Box>
        </Box>

        <Box className="flex flex-col gap-2">
          {visible.map((task, index) => (
            <Box
              key={task.id}
              component={Link}
              href={task.href}
              className="group border-grey-100 hover:border-primary/40 hover:bg-primary/5 flex flex-row items-start gap-3 rounded-2xl border p-3 no-underline transition-colors"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-xl",
                  TONE[SOURCE_TONE[task.source]].softBg,
                  TONE[SOURCE_TONE[task.source]].text,
                )}
              >
                {SOURCE_ICON[task.source]}
              </span>
              <Box className="min-w-0 grow">
                <Box className="flex flex-row flex-wrap items-center gap-1.5">
                  <Typography variant="body2" className="text-text-secondary">
                    {index + 1}.
                  </Typography>
                  {task.urgent && <NiExclamationHexagon size="small" className="text-error" aria-hidden />}
                  <Typography variant="subtitle2" component="span" className="mb-0">
                    {task.title}
                  </Typography>
                </Box>
                <Box className="mt-0.5 flex flex-row flex-wrap items-center gap-1.5">
                  <Chip label={t(`queue-source-${task.source}`)} size="small" variant="outlined" color="grey" />
                  {task.effort && (
                    <Typography variant="body2" component="span" className="text-text-secondary">
                      {t("queue-effort", { effort: t(`queue-effort-${task.effort}`) })}
                    </Typography>
                  )}
                </Box>
                {task.detail && (
                  <Typography variant="body2" className="text-text-secondary mt-1 line-clamp-2">
                    {task.detail}
                  </Typography>
                )}
              </Box>
              <NiArrowRight
                size="small"
                aria-hidden
                className="text-text-disabled group-hover:text-primary mt-1 flex-none translate-x-0 transition-transform group-hover:translate-x-1"
              />
            </Box>
          ))}
        </Box>

        {overflow.length > 0 && (
          <Box className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1">
            {(Object.entries(overflowBySource) as [JourneyTaskSource, number][]).map(([source, count]) => (
              <Typography key={source} variant="body2" component="span" className="mb-0">
                <Box
                  component={Link}
                  href={
                    visible.find((task) => task.source === source)?.href ??
                    overflow.find((task) => task.source === source)!.href
                  }
                  className="text-primary hover:underline"
                >
                  {t("queue-more", { count, source: t(`queue-source-${source}`) })}
                </Box>
              </Typography>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The honest completion state: shown only when at least one engine mode has
 * run for this product AND the queue is empty — never for a product that
 * simply has not started yet (that case renders nothing, see TaskQueueCard).
 */
export function TaskQueueEmptyCard() {
  const t = useTranslations("home");
  return (
    <Card component="section">
      <CardContent className="flex flex-row items-center gap-3">
        <span className="bg-success/10 text-success flex h-10 w-10 flex-none items-center justify-center rounded-2xl">
          <NiCheck size="medium" aria-hidden />
        </span>
        <Box>
          <Typography variant="subtitle1" component="h2" className="mb-0">
            {t("queue-empty-title")}
          </Typography>
          <Typography variant="body2" className="text-text-secondary">
            {t("queue-empty-body")}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
