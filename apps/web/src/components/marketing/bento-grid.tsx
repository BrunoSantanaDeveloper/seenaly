import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import { cn } from "@/lib/utils";

export type BentoItem = {
  title: string;
  body: string;
  /** Icon node or small visual (chart, mini ProductFrame) rendered above the text. */
  visual?: React.ReactNode;
  /** Featured cells span 2 columns on desktop — give the strongest 1–2 features the room. */
  featured?: boolean;
};

/**
 * Asymmetric feature bento — breaks the monotony of equal 3-card grids by
 * giving hierarchy to features: featured cells are wider and carry a visual.
 * Keep 4–6 cells; more belongs in FeatureRows or a plain grid.
 */
export default function BentoGrid({
  eyebrow,
  title,
  subtitle,
  items,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  items: BentoItem[];
}) {
  return (
    <Section>
      <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <Reveal stagger={0.08} className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.title}
            className={cn(
              "group border-grey-100 bg-background-paper hover:border-primary/40 relative flex flex-col gap-4 overflow-hidden rounded-3xl border p-7 transition-colors duration-300",
              item.featured && "md:col-span-2",
            )}
          >
            {item.visual && <div className="min-h-24">{item.visual}</div>}
            <div>
              <h3 className="text-text-primary text-lg font-bold">{item.title}</h3>
              <p className="text-text-secondary mt-2 leading-6">{item.body}</p>
            </div>
            {/* Corner wash that answers hover — quiet until touched. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.12), transparent 70%)" }}
            />
          </div>
        ))}
      </Reveal>
    </Section>
  );
}
