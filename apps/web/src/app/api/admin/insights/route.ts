import { NextResponse } from "next/server";
import postgres from "postgres";

import { recordAudit } from "@/lib/audit";
import {
  type AiProviderName,
  type ChatMessage,
  getChatProvider,
  isAnthropicConfigured,
  isGeminiConfigured,
  isOpenRouterConfigured,
} from "@flyee/ai";
import { createClient } from "@flyee/auth/server";

export const maxDuration = 60;

/** First configured provider wins; the model is the provider's fast reasoning tier. */
const PROVIDERS: { name: AiProviderName; model: string; enabled: boolean }[] = [
  { name: "anthropic", model: "claude-sonnet-4-5", enabled: isAnthropicConfigured },
  { name: "gemini", model: "gemini-2.5-flash", enabled: isGeminiConfigured },
  { name: "openrouter", model: "anthropic/claude-sonnet-4.5", enabled: isOpenRouterConfigured },
];

/** How many SQL round-trips the model gets before it must answer. */
const MAX_ROUNDS = 4;
const ROW_LIMIT = 500;
const STATEMENT_TIMEOUT_MS = 5000;

const STEP_SCHEMA = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["sql", "final"],
      description: "Run another read-only query, or answer the question now.",
    },
    sql: { type: "string", description: "A single read-only SELECT statement (required when action = sql)." },
    answer: {
      type: "string",
      description: "The answer in the user's language, citing the numbers found (required when action = final).",
    },
  },
  required: ["action"],
} as const;

type Step = { action: "sql" | "final"; sql?: string; answer?: string };

let catalogCache: string | null = null;

/** Compact `table(column type, ...)` listing of the public schema for the prompt. */
async function loadCatalog(sql: postgres.Sql): Promise<string> {
  if (catalogCache) return catalogCache;
  const columns = await sql<{ table_name: string; column_name: string; data_type: string }[]>`
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `;
  const tables = new Map<string, string[]>();
  for (const column of columns) {
    const entry = tables.get(column.table_name) ?? [];
    entry.push(`${column.column_name} ${column.data_type}`);
    tables.set(column.table_name, entry);
  }
  catalogCache = [...tables.entries()].map(([table, cols]) => `${table}(${cols.join(", ")})`).join("\n");
  return catalogCache;
}

const systemPrompt = (catalog: string) => `You are the data analyst for a SaaS platform's superadmin.
You answer questions about the production database by writing PostgreSQL queries.

Schema (table(column type, ...)):
${catalog}

Rules:
- Emit ONE read-only SELECT per step. Never write: the connection runs in a READ ONLY transaction, so INSERT/UPDATE/DELETE/DDL (including data-modifying CTEs) fail.
- Always constrain result size (aggregate, or LIMIT ${ROW_LIMIT}).
- Time windows use the relevant created_at column, e.g. created_at >= now() - interval '7 days'.
- Money is stored in cents (price_cents, amount_cents) — convert to a currency amount when reporting.
- If a query errors, read the message and correct it in the next step.
- When you have the numbers, answer with action "final": a direct sentence with the figures, in the language the question was asked. No preamble, no SQL in the answer.`;

type InsightsRequest = { question: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle();
  if (!profile?.is_superadmin) return NextResponse.json({ error: "Superadmin only." }, { status: 403 });

  const provider = PROVIDERS.find((entry) => entry.enabled);
  if (!provider) {
    return NextResponse.json(
      { error: "No AI provider is configured. Set ANTHROPIC_API_KEY, GEMINI_API_KEY or OPENROUTER_API_KEY." },
      { status: 503 },
    );
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "DATABASE_URL is not set — insights query the database directly." },
      { status: 503 },
    );
  }

  const { question } = (await request.json()) as InsightsRequest;
  if (!question?.trim()) return NextResponse.json({ error: "Empty question." }, { status: 400 });

  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const chat = getChatProvider(provider.name);
  const steps: { sql: string; rowCount: number; error?: string }[] = [];

  try {
    const config = {
      provider: provider.name,
      model: provider.model,
      systemPrompt: systemPrompt(await loadCatalog(sql)),
      temperature: 0,
      maxTokens: 2048,
    };
    const messages: ChatMessage[] = [{ role: "user", content: question }];

    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const step = (await chat.generateStructured(config, messages, {
        name: "analyst_step",
        description: "Run a read-only query, or give the final answer.",
        schema: STEP_SCHEMA as unknown as Record<string, unknown>,
      })) as Step;

      if (step.action === "final" || !step.sql) {
        return NextResponse.json({ answer: step.answer ?? "I could not reach an answer.", steps });
      }

      // The READ ONLY transaction is the safety boundary — not prompt wording.
      // Postgres itself rejects any write the model might emit.
      let rows: unknown[] = [];
      let failure: string | null = null;
      try {
        rows = await sql.begin("read only", async (tx) => {
          await tx.unsafe(`set local statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
          return tx.unsafe(step.sql!);
        });
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
      }

      const capped = rows.slice(0, ROW_LIMIT);
      steps.push({ sql: step.sql, rowCount: capped.length, error: failure ?? undefined });
      recordAudit(supabase, "admin.insights.query", {
        entityType: "sql",
        metadata: { question, sql: step.sql, error: failure },
      });

      messages.push({ role: "assistant", content: `Query:\n${step.sql}` });
      messages.push({
        role: "user",
        content: failure
          ? `The query failed: ${failure}\nFix it and try again.`
          : `Result (${capped.length} row${capped.length === 1 ? "" : "s"}):\n${JSON.stringify(capped)}`,
      });
    }

    return NextResponse.json(
      { answer: "I ran out of query attempts before reaching an answer. Try narrowing the question.", steps },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Insights failed.";
    return NextResponse.json({ error: message, steps }, { status: 500 });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
