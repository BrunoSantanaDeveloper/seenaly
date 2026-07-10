import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import { TONE, type Tone } from "@/components/marketing/tone";
import { cn } from "@/lib/utils";

export type Stat = {
  /** The number as it should read, already formatted ("34%", "R$ 2,1M", "12x"). */
  value: string;
  label: string;
  /** Harmonic hue for the number. Default: primary — vary when stats belong to different families. */
  tone?: Tone;
};

/**
 * Full-width contrast band of 3–4 oversized numbers — proof at a glance.
 * Only real, defensible numbers: an invented stat is worse than no band.
 *
 * The number is the section's whole payload: display-lg, tabular, extrabold
 * (data credibility per DESIGN.md) against a quiet label — it stays one step
 * below the hero's display-xl, which owns the page's bold moment. Hairline
 * dividers give the band structure instead of leaving the numbers floating in
 * dead space. Callers pass a `tone` per stat so the band reads in the page's
 * family hues rather than a flat wall of primary.
 */
export default function StatBand({ stats }: { stats: Stat[] }) {
  return (
    <Section spacing="compact" background="contrast" decor="gradient-edge">
      <Reveal
        stagger={0.1}
        className="md:divide-grey-100 grid grid-cols-2 gap-y-12 md:grid-cols-4 md:gap-y-0 md:divide-x"
      >
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-3 px-4 text-center">
            <span
              className={cn(
                "font-display text-display-lg font-extrabold tabular-nums",
                TONE[stat.tone ?? "primary"].text,
              )}
            >
              {stat.value}
            </span>
            <span className="text-text-secondary max-w-56 text-sm leading-5 text-balance">{stat.label}</span>
          </div>
        ))}
      </Reveal>
    </Section>
  );
}
