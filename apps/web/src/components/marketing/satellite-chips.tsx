import { TONE, type Tone, toneAt } from "@/components/marketing/tone";
import { cn } from "@/lib/utils";

/**
 * Ready-made floating chips for <ProductComposition> satellites. All content
 * is REAL and localized (pass i18n strings) — a satellite that lies is worse
 * than no satellite. Token-driven, theme-aware, no photos. The satellite
 * wrapper owns the shadow; chips own the surface.
 */
const CHIP_BASE = "border-grey-100 bg-background-paper rounded-2xl border px-4 py-3";

/** Headline metric: label, oversized value, optional delta pill in the family hue. */
export function KpiChip({
  label,
  value,
  delta,
  tone = "primary",
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: Tone;
}) {
  const hue = TONE[tone];
  return (
    <div className={CHIP_BASE}>
      <p className="text-text-secondary text-xs">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-text-primary text-2xl font-extrabold tabular-nums">{value}</span>
        {delta && (
          <span className={cn("rounded-full px-1.5 py-0.5 text-xs font-semibold", hue.softBg, hue.text)}>{delta}</span>
        )}
      </div>
    </div>
  );
}

/** Tiny sparkline in the family hue over a label — trend at a glance. */
export function TrendChip({
  label,
  data = [4, 7, 5, 9, 8, 12],
  tone = "accent-1",
}: {
  label: string;
  data?: number[];
  tone?: Tone;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((value, index) => `${(index / (data.length - 1)) * 88},${26 - ((value - min) / range) * 24 + 1}`)
    .join(" ");
  return (
    <div className={CHIP_BASE}>
      <svg viewBox="0 0 88 28" className="h-7 w-22" aria-hidden>
        <polyline
          points={points}
          fill="none"
          stroke={`hsl(var(${TONE[tone].cssVar}))`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="text-text-secondary mt-1 text-xs">{label}</p>
    </div>
  );
}

/** Overlapping initials row + label — social proof without stock photos. */
export function AvatarRowChip({ names, label }: { names: string[]; label: string }) {
  return (
    <div className={cn(CHIP_BASE, "flex items-center gap-3")}>
      <div className="flex">
        {names.slice(0, 4).map((name, index) => {
          const hue = TONE[toneAt(index)];
          return (
            <span
              key={name}
              className={cn(
                "border-background-paper flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                index > 0 && "-ml-2",
                hue.softBg,
                hue.text,
              )}
            >
              {name.charAt(0)}
            </span>
          );
        })}
      </div>
      <p className="text-text-secondary text-xs">{label}</p>
    </div>
  );
}

/** Mono status line with a live dot — the instrument/terminal mood. */
export function ReadoutChip({ text, tone = "accent-4" }: { text: string; tone?: Tone }) {
  const hue = TONE[tone];
  return (
    <div className={cn(CHIP_BASE, "flex items-center gap-2")}>
      <span
        className={cn("h-1.5 w-1.5 flex-none rounded-full", hue.text)}
        style={{ backgroundColor: "currentcolor" }}
      />
      <p className="text-text-secondary font-mono text-xs">{text}</p>
    </div>
  );
}
