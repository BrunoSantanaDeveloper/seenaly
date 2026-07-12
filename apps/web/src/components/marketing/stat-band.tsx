import CountUp from "@/components/marketing/count-up";
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
 * Full-width contrast band of OVERSIZED numbers — the page's data-credibility
 * proof (committed "Sala de Controle" direction). The number is the payload:
 * display-2xl, extrabold, tabular, left-aligned over the technical grid, each
 * under a mono index and above a tone gauge bar so the band reads like an
 * instrument panel, not a timid centered row, and it COUNTS UP on scroll entry
 * (CountUp is SSR-safe and reduced-motion safe). Real numbers only — an
 * invented stat is worse than no band. Callers pass a `tone` per stat so the
 * families keep their hue.
 */
export default function StatBand({ stats }: { stats: Stat[] }) {
  return (
    <Section background="contrast" decor="grid">
      <Reveal stagger={0.1} className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4">
        {stats.map((stat, index) => {
          const tone = TONE[stat.tone ?? "primary"];
          return (
            <div key={stat.label} className="flex flex-col gap-4">
              <span className="text-text-muted font-mono text-xs tracking-widest">
                {String(index + 1).padStart(2, "0")}
              </span>
              <CountUp
                value={stat.value}
                className={cn("font-display text-display-2xl leading-none font-extrabold tabular-nums", tone.text)}
              />

              <span
                aria-hidden
                className="h-1 w-16 rounded-full"
                style={{ backgroundColor: `hsl(var(${tone.cssVar}))` }}
              />
              <span className="text-text-secondary max-w-56 text-sm leading-5">{stat.label}</span>
            </div>
          );
        })}
      </Reveal>
    </Section>
  );
}
