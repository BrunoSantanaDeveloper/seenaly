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

/**
 * Paragraph-aware splitter: packs whole paragraphs up to maxChars and
 * falls back to a hard split (with overlap) for oversized paragraphs.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? 1600;
  const overlap = options.overlap ?? 200;

  const paragraphs = normalizeNewlines(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      flush();
      for (let start = 0; start < paragraph.length; start += maxChars - overlap) {
        chunks.push(paragraph.slice(start, start + maxChars).trim());
        if (start + maxChars >= paragraph.length) break;
      }
      continue;
    }
    if (current.length + paragraph.length + 2 > maxChars) flush();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  flush();

  return chunks;
}
