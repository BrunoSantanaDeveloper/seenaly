import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import { TONE, type Tone, toneAt } from "@/components/marketing/tone";
import { cn } from "@/lib/utils";

export type Feature = {
  /**
   * MEANINGFUL icon — it should let the reader grasp the feature at a glance,
   * so pick the concept, not a generic decoration. Sized large on purpose.
   */
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Harmonic hue for this feature family. Defaults to a rotation across the palette. */
  tone?: Tone;
};

/**
 * Funnel stage: desire. Titles must be benefit-led (the outcome for the
 * customer), never the internal feature name. Each card leads with a
 * meaningful icon in its family's hue — show before tell.
 */
export default function FeatureGrid({
  id,
  eyebrow,
  title,
  subtitle,
  features,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  features: Feature[];
}) {
  return (
    <Section id={id}>
      <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <Reveal stagger={0.08} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => {
          const tone = TONE[feature.tone ?? toneAt(index)];
          return (
            <div
              key={feature.title}
              className="border-grey-100 bg-background-paper flex flex-col gap-4 rounded-3xl border p-6"
            >
              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl [&_svg]:h-7 [&_svg]:w-7",
                  tone.softBg,
                  tone.text,
                )}
              >
                {feature.icon}
              </span>
              <h3 className="text-text-primary font-heading text-xl font-bold">{feature.title}</h3>
              <p className="text-text-secondary text-base leading-6">{feature.description}</p>
            </div>
          );
        })}
      </Reveal>
    </Section>
  );
}
