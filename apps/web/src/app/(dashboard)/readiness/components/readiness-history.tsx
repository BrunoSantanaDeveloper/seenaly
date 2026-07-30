"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Typography } from "@mui/material";

import NiChevronRightSmall from "@/icons/nexture/ni-chevron-right-small";
import { compareVerdicts, type VerdictDelta } from "@/lib/readiness/compare";
import type { ReadinessOutput } from "@/lib/readiness/schema";

/**
 * Past verdicts with a PAYOFF: each row leads with what changed versus its own
 * predecessor, and expands into the summary + blockers + per-dimension states.
 * The old version was inert text — a graveyard, when the whole point of the
 * re-check loop is seeing the structure move.
 *
 * Each accordion root carries id="verdict-<id>" — the exact anchor the
 * experiment backlink (?verdict=<id>) resolves to.
 */
export interface HistoryVerdictRow {
  id: string;
  output: ReadinessOutput;
  created_at: string;
}

const DIRECTION_COLOR = { improved: "success", regressed: "warning", same: "grey" } as const;

/** The delta chips — shared by the history rows and the since-last strip. */
export function DeltaChips({ delta }: { delta: VerdictDelta }) {
  const t = useTranslations("readiness");
  if (!delta.changed) {
    return <Chip label={t("delta-none")} size="small" variant="outlined" color="grey" className="flex-none" />;
  }
  return (
    <>
      {delta.verdict.direction !== "same" && (
        <Chip
          label={t("delta-verdict", { from: t(`verdict-${delta.verdict.from}`), to: t(`verdict-${delta.verdict.to}`) })}
          size="small"
          variant="outlined"
          color={DIRECTION_COLOR[delta.verdict.direction]}
          className="flex-none"
        />
      )}
      {delta.blockers.direction !== "same" && (
        <Chip
          label={t("delta-blockers", { before: delta.blockers.before, after: delta.blockers.after })}
          size="small"
          variant="outlined"
          color={DIRECTION_COLOR[delta.blockers.direction]}
          className="flex-none"
        />
      )}
      {delta.transitions.map((transition) => (
        <Chip
          key={transition.dimension}
          label={t("delta-dimension", {
            dimension: t(`dimension-${transition.dimension}`),
            from: t(`status-${transition.from}`),
            to: t(`status-${transition.to}`),
          })}
          size="small"
          variant="outlined"
          color={DIRECTION_COLOR[transition.direction]}
          className="flex-none"
        />
      ))}
      {/* Neutral on purpose: absence from a 7-finding verdict is not proof of
          resolution — never say "resolved" here. */}
      {delta.clearedDimensions.map((dimension) => (
        <Chip
          key={dimension}
          label={t("delta-dimension-cleared", { dimension: t(`dimension-${dimension}`) })}
          size="small"
          variant="outlined"
          color="grey"
          className="flex-none"
        />
      ))}
      {delta.newDimensions.map((entry) => (
        <Chip
          key={entry.dimension}
          label={t("delta-dimension-new", {
            dimension: t(`dimension-${entry.dimension}`),
            status: t(`status-${entry.status}`),
          })}
          size="small"
          variant="outlined"
          color="warning"
          className="flex-none"
        />
      ))}
    </>
  );
}

export default function ReadinessHistory({
  rows,
  expandedId = null,
  onExpandedChange,
  hasOlderPredecessor = false,
}: {
  /** Newest-first; each row is compared against the NEXT one in the list. */
  rows: HistoryVerdictRow[];
  expandedId?: string | null;
  onExpandedChange?: (id: string | null) => void;
  /** Whether the last listed row still has an older (unfetched) predecessor —
   *  decides between a real delta and the honest "first verdict" caption. */
  hasOlderPredecessor?: boolean;
}) {
  const t = useTranslations("readiness");
  const locale = useLocale();
  const dateTime = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );

  if (rows.length === 0) return null;

  return (
    <Box className="flex flex-col gap-2">
      {rows.map((row, index) => {
        const predecessor = rows[index + 1] ?? null;
        const isOldest = index === rows.length - 1;
        const delta = predecessor ? compareVerdicts(predecessor.output, row.output) : null;
        return (
          <Accordion
            key={row.id}
            id={`verdict-${row.id}`}
            expanded={expandedId === row.id}
            onChange={(_, open) => onExpandedChange?.(open ? row.id : null)}
            disableGutters
            className="rounded-2xl before:hidden"
          >
            <AccordionSummary className="group">
              <Box className="flex w-full flex-row flex-wrap items-center gap-2">
                <Typography variant="body2" className="text-text-secondary flex-none">
                  {dateTime.format(new Date(row.created_at))}
                </Typography>
                <Chip
                  label={t(`verdict-${row.output.verdict}`)}
                  size="small"
                  variant="outlined"
                  color={
                    row.output.verdict === "pronto" ? "success" : row.output.verdict === "quase" ? "warning" : "error"
                  }
                  className="flex-none"
                />
                {delta ? (
                  <DeltaChips delta={delta} />
                ) : isOldest && !hasOlderPredecessor ? (
                  <Typography variant="caption" className="text-text-secondary">
                    {t("history-first-verdict")}
                  </Typography>
                ) : null}
                <Box className="grow" />
                <NiChevronRightSmall size={20} className="accordion-rotate flex-none" />
              </Box>
            </AccordionSummary>
            <AccordionDetails className="flex flex-col gap-2">
              <Typography variant="body2" className="leading-6">
                {row.output.summary}
              </Typography>
              {row.output.blocking.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" className="text-text-secondary uppercase">
                    {t("history-blocking-title")}
                  </Typography>
                  <Box component="ul" className="m-0 list-disc space-y-0.5 pl-5">
                    {row.output.blocking.map((line, lineIndex) => (
                      <Typography key={lineIndex} component="li" variant="body2">
                        {line}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
              <Box className="flex flex-row flex-wrap gap-1">
                {row.output.findings.map((finding, findingIndex) => (
                  <Chip
                    key={findingIndex}
                    label={`${t(`dimension-${finding.dimension}`)}: ${t(`status-${finding.status}`)}`}
                    size="small"
                    variant="outlined"
                    color={finding.status === "ok" ? "success" : finding.status === "critico" ? "error" : "grey"}
                    className="flex-none"
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
