/**
 * Split a recommended action into its steps.
 *
 * The engine is told to write ONE action, but for a cold-start account that
 * action is genuinely a sequence ("1. Configure a mensuração… 2. Estruture a
 * primeira campanha… 3. Defina o orçamento…"). The model emits it as a single
 * string, so the card rendered a 12-line paragraph with numbers buried inside —
 * unreadable exactly when the reader most needs to follow along.
 *
 * The structure is already in the text; this only surfaces it. Pure and
 * conservative: if the text is not clearly enumerated we return it untouched as
 * a single step, because inventing structure that isn't there would be worse
 * than a paragraph.
 */

/** A leading "1." / "1)" / "1 -" marker, at the string start or after a break. */
const NUMBERED = /(?:^|\s)(\d{1,2})\s*[.)]\s+(?=[A-ZÀ-ÖØ-Þ])/g;

export function splitActionSteps(action: string): string[] {
  const text = (action ?? "").trim();
  if (!text) return [];

  const marks: { index: number; number: number }[] = [];
  for (const match of text.matchAll(NUMBERED)) {
    // `match.index` points at the leading space when there is one.
    const at = match.index + (match[0].length - match[0].trimStart().length);
    marks.push({ index: at, number: Number(match[1]) });
  }

  // Require a real sequence starting at 1 with at least two entries; a stray
  // "2023." or a single "1." inside prose must not shatter the paragraph.
  if (marks.length < 2 || marks[0].number !== 1) return [text];
  const sequential = marks.every((mark, i) => mark.number === i + 1);
  if (!sequential) return [text];

  // Anything before the first marker is a lead-in sentence, kept as its own
  // step so no words are ever dropped.
  const steps: string[] = [];
  const lead = text.slice(0, marks[0].index).trim();
  if (lead) steps.push(lead);

  marks.forEach((mark, i) => {
    const from = mark.index;
    const to = i + 1 < marks.length ? marks[i + 1].index : text.length;
    // Drop the "1." marker itself — the list renders its own numbering.
    const body = text
      .slice(from, to)
      .replace(/^\d{1,2}\s*[.)]\s*/, "")
      .trim();
    if (body) steps.push(body);
  });

  return steps.length > 0 ? steps : [text];
}
