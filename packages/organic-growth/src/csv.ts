import {
  isFunnelStage,
  isNarrativeType,
  isSocialPlatform,
  isStrategicIntent,
  normalizeTaxonomyValue,
} from "./taxonomy";
import type {
  AnalysisConfidence,
  ConciergeCsvResult,
  CsvDelimiter,
  CsvIssue,
  CsvIssueCode,
  OrganicContentMetrics,
  OrganicContentRecord,
  ParseConciergeCsvOptions,
} from "./types";

export const ORGANIC_CSV_MAX_ROWS = 500;

export const ORGANIC_CSV_HEADERS = [
  "external_content_id",
  "url",
  "published_at",
  "observed_at",
  "platform",
  "account",
  "format",
  "title",
  "caption",
  "duration_seconds",
  "funnel_stage",
  "strategic_intent",
  "narrative_type",
  "theme",
  "hook",
  "promise",
  "cta",
  "proof",
  "classification_confidence",
  "impressions",
  "reach",
  "views",
  "plays",
  "likes",
  "comments",
  "shares",
  "saves",
  "profile_visits",
  "link_clicks",
  "leads",
  "assisted_conversions",
  "average_watch_percentage",
  "average_watch_time_seconds",
] as const;

export const ORGANIC_CSV_TEMPLATE = `${ORGANIC_CSV_HEADERS.join(",")}\r\n`;

type OrganicCsvHeader = (typeof ORGANIC_CSV_HEADERS)[number];

interface RawCsvRecord {
  line: number;
  values: string[];
}

interface RawCsvResult {
  records: RawCsvRecord[];
  errors: CsvIssue[];
}

const headerSet = new Set<string>(ORGANIC_CSV_HEADERS);

const countMetricColumns = {
  impressions: "impressions",
  reach: "reach",
  views: "views",
  plays: "plays",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  saves: "saves",
  profile_visits: "profileVisits",
  link_clicks: "linkClicks",
  leads: "leads",
  assisted_conversions: "assistedConversions",
} as const satisfies Readonly<Record<string, keyof OrganicContentMetrics>>;

function issue(row: number, code: CsvIssueCode, message: string, column?: string, value?: string): CsvIssue {
  return { row, code, message, ...(column ? { column } : {}), ...(value !== undefined ? { value } : {}) };
}

function detectDelimiter(csv: string): CsvDelimiter {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) break;
    if (!quoted && character === ",") commas += 1;
    if (!quoted && character === ";") semicolons += 1;
  }

  return semicolons > commas ? ";" : ",";
}

function parseRawCsv(csv: string, delimiter: CsvDelimiter): RawCsvResult {
  const records: RawCsvRecord[] = [];
  const errors: CsvIssue[] = [];
  let values: string[] = [];
  let field = "";
  let line = 1;
  let recordLine = 1;
  let quoted = false;
  let justClosedQuote = false;

  const finishRecord = () => {
    values.push(field);
    if (values.some((value) => value.trim() !== "")) records.push({ line: recordLine, values });
    values = [];
    field = "";
    justClosedQuote = false;
  };

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (quoted) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          justClosedQuote = true;
        }
      } else {
        field += character;
        if (character === "\n") line += 1;
      }
      continue;
    }

    if (justClosedQuote) {
      if (character === delimiter) {
        values.push(field);
        field = "";
        justClosedQuote = false;
        continue;
      }
      if (character === "\n" || character === "\r") {
        if (character === "\r" && csv[index + 1] === "\n") index += 1;
        finishRecord();
        line += 1;
        recordLine = line;
        continue;
      }
      if (/\s/u.test(character)) continue;
      errors.push(issue(line, "invalid_csv", "Caractere inesperado após o fechamento de aspas."));
      return { records: [], errors };
    }

    if (character === '"') {
      if (field.length > 0) {
        errors.push(issue(line, "invalid_csv", "Aspas só podem iniciar um campo vazio."));
        return { records: [], errors };
      }
      quoted = true;
      continue;
    }

    if (character === delimiter) {
      values.push(field);
      field = "";
      continue;
    }

    if (character === "\n" || character === "\r") {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      finishRecord();
      line += 1;
      recordLine = line;
      continue;
    }

    field += character;
  }

  if (quoted) {
    errors.push(issue(recordLine, "invalid_csv", "Campo com aspas não foi fechado."));
    return { records: [], errors };
  }

  if (field.length > 0 || values.length > 0 || justClosedQuote) finishRecord();
  return { records, errors };
}

function normalizeHeader(value: string): string {
  return normalizeTaxonomyValue(value.replace(/^\uFEFF/u, ""));
}

function emptyResult(delimiter: CsvDelimiter, errors: CsvIssue[], totalRows = 0): ConciergeCsvResult {
  return {
    delimiter,
    headers: [],
    rows: [],
    errors,
    warnings: [],
    totalRows,
    acceptedRows: 0,
    rejectedRows: totalRows,
    fatal: true,
  };
}

function parseIsoDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/u.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function parseHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseSafeCount(value: string, delimiter: CsvDelimiter): { value?: number; code?: CsvIssueCode } {
  const decimal = delimiter === ";" ? value.replace(",", ".") : value;
  if (!/^\d+(?:\.\d+)?$/u.test(decimal)) return { code: "invalid_number" };
  const number = Number(decimal);
  if (!Number.isSafeInteger(number) || number < 0) return { code: "unsafe_number" };
  return { value: number };
}

function parseSafeDecimal(
  value: string,
  delimiter: CsvDelimiter,
  maximum: number,
): { value?: number; code?: CsvIssueCode } {
  const decimal = delimiter === ";" ? value.replace(",", ".") : value;
  if (!/^\d+(?:\.\d+)?$/u.test(decimal)) return { code: "invalid_number" };
  const number = Number(decimal);
  if (!Number.isFinite(number) || number < 0 || number > maximum) return { code: "unsafe_number" };
  return { value: number };
}

function valueAt(row: Readonly<Record<string, string>>, header: OrganicCsvHeader): string {
  return (row[header] ?? "").trim();
}

function confidenceValue(value: string): AnalysisConfidence | null {
  const normalized = normalizeTaxonomyValue(value);
  if (normalized === "baixa" || normalized === "media" || normalized === "alta") return normalized;
  return null;
}

/**
 * Parses the Concierge interchange format. Syntax/header failures are fatal;
 * validation failures reject only their row. No partial import is returned when
 * the configured row limit is exceeded.
 */
export function parseOrganicCsv(csv: string, options: ParseConciergeCsvOptions = {}): ConciergeCsvResult {
  const normalizedCsv = csv.replace(/^\uFEFF/u, "");
  const delimiter = options.delimiter ?? detectDelimiter(normalizedCsv);
  if (normalizedCsv.trim() === "") return emptyResult(delimiter, [issue(1, "empty_file", "O arquivo CSV está vazio.")]);

  const raw = parseRawCsv(normalizedCsv, delimiter);
  if (raw.errors.length > 0) return emptyResult(delimiter, raw.errors);
  if (raw.records.length === 0) return emptyResult(delimiter, [issue(1, "empty_file", "O arquivo CSV está vazio.")]);

  const headerRecord = raw.records[0];
  const headers = headerRecord.values.map(normalizeHeader);
  const totalRows = Math.max(0, raw.records.length - 1);
  const maximumRows = Math.min(
    ORGANIC_CSV_MAX_ROWS,
    Math.max(1, Number.isFinite(options.maxRows) ? Math.trunc(options.maxRows as number) : ORGANIC_CSV_MAX_ROWS),
  );

  if (totalRows > maximumRows) {
    return {
      ...emptyResult(
        delimiter,
        [
          issue(
            maximumRows + 2,
            "too_many_rows",
            `O arquivo possui ${totalRows} linhas; o limite desta importação é ${maximumRows}.`,
          ),
        ],
        totalRows,
      ),
      headers,
    };
  }

  const errors: CsvIssue[] = [];
  const warnings: CsvIssue[] = [];
  const seenHeaders = new Set<string>();
  for (const header of headers) {
    if (seenHeaders.has(header)) errors.push(issue(1, "duplicate_header", `Cabeçalho duplicado: ${header}.`, header));
    seenHeaders.add(header);
    if (header !== "" && !headerSet.has(header)) {
      warnings.push(issue(1, "unknown_header", `Cabeçalho desconhecido será ignorado: ${header}.`, header));
    }
  }

  const requiredHeaders = ["published_at", "format"];
  if (!options.defaultPlatform) requiredHeaders.push("platform");
  if (!options.defaultAccount) requiredHeaders.push("account");
  for (const header of requiredHeaders) {
    if (!seenHeaders.has(header))
      errors.push(issue(1, "missing_header", `Cabeçalho obrigatório ausente: ${header}.`, header));
  }
  if (!seenHeaders.has("external_content_id") && !seenHeaders.has("url")) {
    errors.push(issue(1, "missing_header", "Inclua external_content_id ou url para identificar cada conteúdo."));
  }
  if (!seenHeaders.has("title") && !seenHeaders.has("caption")) {
    errors.push(issue(1, "missing_header", "Inclua title ou caption para descrever cada conteúdo."));
  }

  if (errors.length > 0) {
    return {
      delimiter,
      headers,
      rows: [],
      errors,
      warnings,
      totalRows,
      acceptedRows: 0,
      rejectedRows: totalRows,
      fatal: true,
    };
  }

  const rows: OrganicContentRecord[] = [];
  const rejectedRecordLines = new Set<number>();
  const seenContents = new Set<string>();

  for (const record of raw.records.slice(1)) {
    const rowErrors: CsvIssue[] = [];
    if (record.values.length > headers.length) {
      rowErrors.push(issue(record.line, "too_many_columns", "A linha possui mais colunas que o cabeçalho."));
    }

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (headerSet.has(header)) row[header] = record.values[index] ?? "";
    });

    const externalId = valueAt(row, "external_content_id");
    const rawUrl = valueAt(row, "url");
    const parsedUrl = rawUrl ? parseHttpUrl(rawUrl) : null;
    if (!externalId && !rawUrl) {
      rowErrors.push(issue(record.line, "missing_value", "Informe external_content_id ou url.", "external_content_id"));
    }
    if (rawUrl && !parsedUrl) rowErrors.push(issue(record.line, "invalid_url", "URL inválida.", "url", rawUrl));

    const rawPublishedAt = valueAt(row, "published_at");
    const publishedAt = parseIsoDate(rawPublishedAt);
    if (!publishedAt) {
      rowErrors.push(
        issue(
          record.line,
          "invalid_date",
          "Use uma data ISO, como 2026-07-15 ou um timestamp ISO.",
          "published_at",
          rawPublishedAt,
        ),
      );
    }

    const rawObservedAt = valueAt(row, "observed_at");
    const observedAt = rawObservedAt ? parseIsoDate(rawObservedAt) : undefined;
    if (rawObservedAt && !observedAt) {
      rowErrors.push(
        issue(record.line, "invalid_date", "observed_at deve usar formato ISO.", "observed_at", rawObservedAt),
      );
    }

    const platformInput = valueAt(row, "platform") || options.defaultPlatform || "";
    const normalizedPlatform = normalizeTaxonomyValue(platformInput);
    if (!isSocialPlatform(normalizedPlatform)) {
      rowErrors.push(issue(record.line, "invalid_platform", "Plataforma não suportada.", "platform", platformInput));
    }

    const account = valueAt(row, "account") || options.defaultAccount?.trim() || "";
    if (!account) rowErrors.push(issue(record.line, "missing_value", "Informe a conta de origem.", "account"));

    const format = valueAt(row, "format");
    if (!format) rowErrors.push(issue(record.line, "missing_value", "Informe o formato.", "format"));
    const title = valueAt(row, "title");
    const caption = valueAt(row, "caption");
    if (!title && !caption) {
      rowErrors.push(issue(record.line, "missing_value", "Informe title ou caption.", "caption"));
    }

    const rawFunnelStage = valueAt(row, "funnel_stage");
    const funnelStage = rawFunnelStage ? normalizeTaxonomyValue(rawFunnelStage) : undefined;
    if (funnelStage && !isFunnelStage(funnelStage)) {
      rowErrors.push(
        issue(
          record.line,
          "invalid_taxonomy",
          "Etapa do funil não pertence à taxonomia v1.",
          "funnel_stage",
          rawFunnelStage,
        ),
      );
    }

    const rawStrategicIntent = valueAt(row, "strategic_intent");
    const strategicIntent = rawStrategicIntent ? normalizeTaxonomyValue(rawStrategicIntent) : undefined;
    if (strategicIntent && !isStrategicIntent(strategicIntent)) {
      rowErrors.push(
        issue(
          record.line,
          "invalid_taxonomy",
          "Intenção estratégica não pertence à taxonomia v1.",
          "strategic_intent",
          rawStrategicIntent,
        ),
      );
    }

    const rawNarrativeType = valueAt(row, "narrative_type");
    const narrativeType = rawNarrativeType ? normalizeTaxonomyValue(rawNarrativeType) : undefined;
    if (narrativeType && !isNarrativeType(narrativeType)) {
      rowErrors.push(
        issue(
          record.line,
          "invalid_taxonomy",
          "Tipo narrativo não pertence à taxonomia v1.",
          "narrative_type",
          rawNarrativeType,
        ),
      );
    }

    const rawConfidence = valueAt(row, "classification_confidence");
    const classificationConfidence = rawConfidence ? confidenceValue(rawConfidence) : undefined;
    if (rawConfidence && !classificationConfidence) {
      rowErrors.push(
        issue(
          record.line,
          "invalid_taxonomy",
          "Confiança deve ser baixa, media ou alta.",
          "classification_confidence",
          rawConfidence,
        ),
      );
    }

    const metrics: OrganicContentMetrics = {};
    for (const [column, property] of Object.entries(countMetricColumns)) {
      const rawValue = (row[column] ?? "").trim();
      if (!rawValue) continue;
      const parsed = parseSafeCount(rawValue, delimiter);
      if (parsed.value === undefined) {
        rowErrors.push(
          issue(
            record.line,
            parsed.code ?? "invalid_number",
            "Use um inteiro não negativo e seguro.",
            column,
            rawValue,
          ),
        );
      } else {
        metrics[property] = parsed.value;
      }
    }

    const rawWatchPercentage = valueAt(row, "average_watch_percentage");
    if (rawWatchPercentage) {
      const parsed = parseSafeDecimal(rawWatchPercentage, delimiter, 100);
      if (parsed.value === undefined) {
        rowErrors.push(
          issue(
            record.line,
            parsed.code ?? "invalid_number",
            "Percentual médio assistido deve estar entre 0 e 100.",
            "average_watch_percentage",
            rawWatchPercentage,
          ),
        );
      } else metrics.averageWatchPercentage = parsed.value;
    }

    const rawWatchTime = valueAt(row, "average_watch_time_seconds");
    if (rawWatchTime) {
      const parsed = parseSafeDecimal(rawWatchTime, delimiter, Number.MAX_SAFE_INTEGER);
      if (parsed.value === undefined) {
        rowErrors.push(
          issue(
            record.line,
            parsed.code ?? "invalid_number",
            "Tempo médio assistido deve ser um número não negativo e seguro.",
            "average_watch_time_seconds",
            rawWatchTime,
          ),
        );
      } else metrics.averageWatchTimeSeconds = parsed.value;
    }

    const rawDuration = valueAt(row, "duration_seconds");
    const duration = rawDuration ? parseSafeDecimal(rawDuration, delimiter, Number.MAX_SAFE_INTEGER) : {};
    if (rawDuration && duration.value === undefined) {
      rowErrors.push(
        issue(
          record.line,
          duration.code ?? "invalid_number",
          "Duração deve ser um número não negativo e seguro.",
          "duration_seconds",
          rawDuration,
        ),
      );
    }

    const contentKey =
      isSocialPlatform(normalizedPlatform) && account
        ? `${normalizedPlatform}|${account.toLocaleLowerCase("pt-BR")}|${externalId ? `id:${externalId}` : `url:${parsedUrl ?? rawUrl}`}`
        : "";
    if (contentKey && seenContents.has(contentKey)) {
      rowErrors.push(
        issue(
          record.line,
          "duplicate_content",
          "Conteúdo duplicado dentro do mesmo arquivo.",
          externalId ? "external_content_id" : "url",
        ),
      );
    }

    if (rowErrors.length > 0 || !publishedAt || !isSocialPlatform(normalizedPlatform)) {
      errors.push(...rowErrors);
      rejectedRecordLines.add(record.line);
      continue;
    }

    seenContents.add(contentKey);
    rows.push({
      id: contentKey,
      rowNumber: record.line,
      ...(externalId ? { externalId } : {}),
      ...(parsedUrl ? { url: parsedUrl } : {}),
      publishedAt,
      ...(observedAt ? { observedAt } : {}),
      platform: normalizedPlatform,
      account,
      format: normalizeTaxonomyValue(format),
      ...(title ? { title } : {}),
      ...(caption ? { caption } : {}),
      ...(duration.value !== undefined ? { durationSeconds: duration.value } : {}),
      ...(funnelStage && isFunnelStage(funnelStage) ? { funnelStage } : {}),
      ...(strategicIntent && isStrategicIntent(strategicIntent) ? { strategicIntent } : {}),
      ...(narrativeType && isNarrativeType(narrativeType) ? { narrativeType } : {}),
      ...(valueAt(row, "theme") ? { theme: valueAt(row, "theme") } : {}),
      ...(valueAt(row, "hook") ? { hook: valueAt(row, "hook") } : {}),
      ...(valueAt(row, "promise") ? { promise: valueAt(row, "promise") } : {}),
      ...(valueAt(row, "cta") ? { cta: valueAt(row, "cta") } : {}),
      ...(valueAt(row, "proof") ? { proof: valueAt(row, "proof") } : {}),
      ...(classificationConfidence ? { classificationConfidence } : {}),
      source: options.source ?? "manual",
      metrics,
    });
  }

  return {
    delimiter,
    headers,
    rows,
    errors,
    warnings,
    totalRows,
    acceptedRows: rows.length,
    rejectedRows: rejectedRecordLines.size,
    fatal: false,
  };
}

/** Backward-compatible descriptive name for non-web consumers. */
export const parseConciergeCsv = parseOrganicCsv;
