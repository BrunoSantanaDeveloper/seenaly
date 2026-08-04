export interface ChunkOptions {
  /** Target chunk size in characters. */
  maxChars?: number;
  /** Characters repeated from the end of one chunk into the next. */
  overlap?: number;
}

/**
 * Normalize CRLF/CR to LF.
 *
 * This is not cosmetic — it is load-bearing. The paragraph split below looks
 * for two consecutive `\n`, and in CRLF text the newlines are separated by a
 * `\r`, so NOTHING matches: the whole document collapses into one "paragraph"
 * and falls through to the blind character-offset fallback, slicing chunks in
 * the middle of words. It bit the Meta corpus (checked out CRLF on Windows via
 * core.autocrlf) while the LF playbook was fine, which is exactly the kind of
 * environment-dependent corruption that never reproduces in CI. `.gitattributes`
 * pins the working tree to LF; this keeps the guarantee inside the package, for
 * text that never touches git (admin console paste, connector payloads).
 */
export const normalizeNewlines = (text: string) => text.replace(/\r\n?/g, "\n");

export interface Chunk {
  content: string;
  /** Markdown heading ancestry at the point the chunk starts, outermost first. */
  headingPath: string[];
}

/**
 * Paragraph-aware splitter that also reports where each chunk sits in the
 * document's heading hierarchy.
 *
 * The heading path exists because of what retrieval keeps getting wrong: a
 * chunk about "eventos de otimização" is indistinguishable from three other
 * documents' chunks on the same words, since the body alone never says which
 * document it belongs to. The path is metadata the corpus already carries and
 * the vector never saw. It is reported, not glued onto `content` — the caller
 * decides what to embed and what to show, and those are not the same string.
 */
export function chunkDocument(text: string, options: ChunkOptions = {}): Chunk[] {
  const maxChars = options.maxChars ?? 1600;
  const overlap = options.overlap ?? 200;

  const paragraphs = normalizeNewlines(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: Chunk[] = [];
  let current = "";
  /** Heading text by level (1-6); deeper levels are cleared when a shallower one appears. */
  const stack: (string | undefined)[] = [];
  // Snapshot taken when a chunk STARTS: a chunk that runs past a later heading
  // is still, in substance, about the section it opened in.
  let startPath: string[] = [];

  const pathNow = () => stack.filter((heading): heading is string => Boolean(heading));

  const flush = () => {
    if (current.trim()) chunks.push({ content: current.trim(), headingPath: startPath });
    current = "";
  };

  for (const paragraph of paragraphs) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(paragraph.split("\n")[0] ?? "");
    if (heading) {
      const level = heading[1].length;
      stack[level - 1] = heading[2].trim();
      stack.length = level;
    }

    if (paragraph.length > maxChars) {
      flush();
      const path = pathNow();
      for (let start = 0; start < paragraph.length; start += maxChars - overlap) {
        chunks.push({ content: paragraph.slice(start, start + maxChars).trim(), headingPath: path });
        if (start + maxChars >= paragraph.length) break;
      }
      continue;
    }
    if (current.length + paragraph.length + 2 > maxChars) flush();
    if (!current) startPath = pathNow();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  flush();

  return chunks;
}

/** Bodies only — for callers that do not care where the text sat. */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  return chunkDocument(text, options).map((chunk) => chunk.content);
}

/**
 * The string that gets EMBEDDED, which is not the string that gets shown.
 *
 * Retrieval's most expensive failure is the right passage from the wrong
 * document, and it happens because the body alone carries no identity. Naming
 * the document and the section fixes that — but the prefix competes with the
 * body for the vector, so it stays lean: title plus heading path, nothing
 * else. Description and tags were measured at ~453 chars, over half of a
 * median section; trust level is deliberately excluded because it is already a
 * filter and a ranking bonus, and semantically empty inside the vector.
 */
export function embedTextFor(title: string, chunk: Chunk): string {
  const normalize = (value: string) => value.trim().toLowerCase();
  // Most captured documents open with an H1 that repeats the title, and
  // "Sobre a API de Conversões > Sobre a API de Conversões" spends the prefix's
  // budget saying one thing twice.
  const path = chunk.headingPath.filter((heading) => normalize(heading) !== normalize(title));
  const label = [title, ...path].filter(Boolean).join(" > ");
  return label ? `${label}\n\n${chunk.content}` : chunk.content;
}
