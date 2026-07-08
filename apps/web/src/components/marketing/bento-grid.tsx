import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import { TONE, type Tone, toneAt } from "@/components/marketing/tone";
import { cn } from "@/lib/utils";

export type BentoItem = {
  title: string;
  body: string;
  /** Icon node or small visual (chart, mini ProductFrame) rendered above the text. */
  visual?: React.ReactNode;
  /** Featured cells span 2 columns on desktop — give the strongest 1–2 features the room. */
  featured?: boolean;
  /** Harmonic hue for this cell (icon chip + hover wash). Defaults to a rotation. */
  tone?: Tone;
};

/**
 * Asymmetric feature bento — breaks the monotony of equal 3-card grids by
 * giving hierarchy to features: featured cells are wider and carry a visual.
 * Keep 4–6 cells; more belongs in FeatureRows or a plain grid.
 */
export default function BentoGrid({
  id,
  eyebrow,
  title,
  subtitle,
  items,
  background,
  decor,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  items: BentoItem[];
  background?: React.ComponentProps<typeof Section>["background"];
  decor?: React.ComponentProps<typeof Section>["decor"];
}) {
  return (
    <Section id={id} background={background} decor={decor}>
      <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <Reveal stagger={0.08} className="grid gap-4 md:grid-cols-3">
        {items.map((item, index) => {
          const tone = TONE[item.tone ?? toneAt(index)];
          return (
            <div
              key={item.title}
              className={cn(
                "group border-grey-100 bg-background-paper relative flex flex-col gap-4 overflow-hidden rounded-3xl border p-7 transition-colors duration-300",
                item.featured && "md:col-span-2",
              )}
              style={{ ["--bento-tone" as string]: `var(${tone.cssVar})` }}
            >
              {item.visual && <div className={cn("min-h-24", tone.text)}>{item.visual}</div>}
              <div>
                <h3 className="text-text-primary text-lg font-bold">{item.title}</h3>
                <p className="text-text-secondary mt-2 leading-6">{item.body}</p>
              </div>
              {/* Corner wash in the cell's own hue — quiet until touched. */}
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: "radial-gradient(circle, hsl(var(--bento-tone) / 0.14), transparent 70%)" }}
              />
              <div
                aria-hidden
                className="absolute inset-0 rounded-3xl border border-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ borderColor: "hsl(var(--bento-tone) / 0.35)" }}
              />
            </div>
          );
        })}
      </Reveal>
    </Section>
  );
}
