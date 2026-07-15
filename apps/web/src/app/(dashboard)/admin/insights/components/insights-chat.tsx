"use client";

import { useState } from "react";

import { Alert, Box, Button, Chip, Collapse, FormControl, Input, Typography } from "@mui/material";

import NiChartLineBar from "@/icons/nexture/ni-chart-line-bar";

type QueryStep = { sql: string; rowCount: number; error?: string };

type Turn = {
  question: string;
  answer: string | null;
  error: string | null;
  steps: QueryStep[];
};

/** Openers that show what this thing is for, so a first-time operator isn't staring at a blank box. */
const STARTERS = [
  "How many users signed up in the last 7 days?",
  "Revenue by plan over the last 30 days",
  "Which organizations are past due?",
  "How many messages did the AI assistants answer this month?",
];

/**
 * The operator's job: get an answer to a business question about the
 * platform — not to browse tables. So the screen is a conversation, and
 * every answer shows the SQL it came from, because a number you cannot
 * verify is worthless.
 */
export default function InsightsChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setQuestion("");
    const index = turns.length;
    setTurns((current) => [...current, { question: trimmed, answer: null, error: null, steps: [] }]);

    try {
      const response = await fetch("/api/admin/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
        steps?: QueryStep[];
      };
      setTurns((current) =>
        current.map((turn, position) =>
          position === index
            ? {
                ...turn,
                answer: payload.answer ?? null,
                error: response.ok ? null : (payload.error ?? "Request failed."),
                steps: payload.steps ?? [],
              }
            : turn,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      setTurns((current) => current.map((turn, position) => (position === index ? { ...turn, error: message } : turn)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box className="flex flex-col gap-5">
      {turns.length === 0 && (
        <Box className="flex flex-col items-start gap-4 py-4">
          <span className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-2xl [&_svg]:h-6 [&_svg]:w-6">
            <NiChartLineBar size="medium" />
          </span>
          <Box>
            <Typography variant="h5" component="h2" className="mb-1">
              Ask the database anything
            </Typography>
            <Typography variant="body1" className="text-text-secondary">
              Questions in plain language become read-only SQL against the live database. Writes are impossible — the
              query runs inside a read-only transaction — and every answer shows the SQL it came from.
            </Typography>
          </Box>
          <Box className="flex flex-row flex-wrap gap-2">
            {STARTERS.map((starter) => (
              <Chip key={starter} label={starter} variant="outlined" onClick={() => ask(starter)} clickable />
            ))}
          </Box>
        </Box>
      )}

      {turns.map((turn, index) => (
        <Box key={index} className="flex flex-col gap-2">
          <Typography variant="h6" component="p">
            {turn.question}
          </Typography>

          {!turn.answer && !turn.error && (
            <Typography variant="body2" className="text-text-secondary">
              Querying the database…
            </Typography>
          )}

          {turn.error && (
            <Alert severity="error" className="neutral bg-background-paper/60!">
              {turn.error}
            </Alert>
          )}

          {turn.answer && (
            <Typography variant="body1" className="whitespace-pre-wrap">
              {turn.answer}
            </Typography>
          )}

          {turn.steps.length > 0 && (
            <Box>
              <Button
                size="small"
                variant="text"
                color="grey"
                onClick={() => setExpanded((current) => (current === index ? null : index))}
              >
                {expanded === index ? "Hide queries" : `Queries executed (${turn.steps.length})`}
              </Button>
              <Collapse in={expanded === index}>
                <Box className="flex flex-col gap-2 pt-2">
                  {turn.steps.map((step, position) => (
                    <Box key={position} className="bg-background-default/50 overflow-x-auto rounded-lg p-3">
                      <Typography component="pre" variant="body2" className="font-mono whitespace-pre-wrap">
                        {step.sql}
                      </Typography>
                      <Typography variant="body2" className="text-text-secondary mt-1">
                        {step.error ? `Error: ${step.error}` : `${step.rowCount} row${step.rowCount === 1 ? "" : "s"}`}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>
          )}
        </Box>
      ))}

      <Box className="flex flex-row items-end gap-2">
        <FormControl className="outlined mb-0 flex-1" variant="standard" size="small">
          <Input
            placeholder="How many customers bought in the last 7 days?"
            value={question}
            disabled={busy}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                ask(question);
              }
            }}
          />
        </FormControl>
        <Button variant="contained" onClick={() => ask(question)} disabled={busy || !question.trim()}>
          {busy ? "Asking…" : "Ask"}
        </Button>
      </Box>
    </Box>
  );
}
