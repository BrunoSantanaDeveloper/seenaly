import { Avatar } from "@mui/material";

import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import { TONE, type Tone, toneAt } from "@/components/marketing/tone";
import { cn } from "@/lib/utils";

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  /** Harmonic hue for the initials avatar. Defaults to a rotation — testimonials are people, not one brand block. */
  tone?: Tone;
};

/**
 * Funnel stage: trust. Quotes should carry a concrete outcome (numbers,
 * before/after) — vague praise converts nothing. Avatars are initials on
 * token colors: no stock photos in the template.
 */
export default function Testimonials({
  eyebrow,
  title,
  items,
}: {
  eyebrow?: string;
  title: string;
  items: Testimonial[];
}) {
  return (
    <Section background="paper">
      <SectionHeader eyebrow={eyebrow} title={title} />
      <Reveal stagger={0.08} className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {items.map((item, index) => {
          const tone = TONE[item.tone ?? toneAt(index)];
          return (
            <figure key={item.name} className="border-grey-100 flex flex-col gap-4 rounded-3xl border p-6">
              <blockquote className="text-text-primary flex-1 text-base leading-6">“{item.quote}”</blockquote>
              <figcaption className="flex flex-row items-center gap-3">
                <Avatar className={cn("medium font-semibold", tone.softBg, tone.text)}>{item.name.charAt(0)}</Avatar>
                <span className="flex flex-col">
                  <span className="text-text-primary text-base font-semibold">{item.name}</span>
                  <span className="text-text-secondary text-sm">{item.role}</span>
                </span>
              </figcaption>
            </figure>
          );
        })}
      </Reveal>
    </Section>
  );
}
