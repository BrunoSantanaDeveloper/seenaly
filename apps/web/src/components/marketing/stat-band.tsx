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
 */
export default function StatBand({ stats }: { stats: Stat[] }) {
  return (
    <Section spacing="compact" background="contrast" decor="gradient-edge">
      <Reveal stagger={0.1} className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-1 text-center">
            <span className={cn("font-display text-display-lg font-extrabold", TONE[stat.tone ?? "primary"].text)}>
              {stat.value}
            </span>
            <span className="text-text-secondary max-w-44 text-sm leading-5">{stat.label}</span>
          </div>
        ))}
      </Reveal>
    </Section>
  );
}
