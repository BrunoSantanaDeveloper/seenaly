/**
 * The theme palette is SIX harmonic hues (primary, secondary, accent-1..4),
 * each designed to combine with the others — the same system the admin uses
 * for plan icons, chart series and category tiles. Marketing pages must use
 * this range: primary is reserved for CTAs and the page's bold moment;
 * categorical elements (plan tiers, feature families, chart series, icon
 * chips) take accent tones with a CONSISTENT meaning-mapping across the
 * page/site. A page tinted 100% in primary reads flat and monochrome — it
 * fails the premium bar.
 *
 * Class strings are literal so Tailwind's JIT can see them.
 */
export type Tone = "primary" | "secondary" | "accent-1" | "accent-2" | "accent-3" | "accent-4";

export const TONE: Record<Tone, { text: string; softBg: string; cssVar: string }> = {
  primary: { text: "text-primary", softBg: "bg-primary/10", cssVar: "--primary" },
  secondary: { text: "text-secondary", softBg: "bg-secondary/10", cssVar: "--secondary" },
  "accent-1": { text: "text-accent-1", softBg: "bg-accent-1/10", cssVar: "--accent-1" },
  "accent-2": { text: "text-accent-2", softBg: "bg-accent-2/10", cssVar: "--accent-2" },
  "accent-3": { text: "text-accent-3", softBg: "bg-accent-3/10", cssVar: "--accent-3" },
  "accent-4": { text: "text-accent-4", softBg: "bg-accent-4/10", cssVar: "--accent-4" },
};

/** Pleasant default rotation for lists without an explicit mapping (plans, tiles). */
export const TONE_ROTATION: Tone[] = ["accent-1", "primary", "secondary", "accent-3"];

export const toneAt = (index: number): Tone => TONE_ROTATION[index % TONE_ROTATION.length];
