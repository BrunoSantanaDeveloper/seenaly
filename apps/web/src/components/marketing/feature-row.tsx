import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import NiCheck from "@/icons/nexture/ni-check";

export type FeatureRowItem = {
  eyebrow?: string;
  title: string;
  body: string;
  bullets?: string[];
  /** Product evidence for this feature: <ProductFrame>, image, or <DataVizPlaceholder>. */
  media: React.ReactNode;
};

/**
 * Alternating two-column feature rows (text ↔ visual "zig-zag") — the
 * workhorse layout of expensive-product pages: every claim ships next to
 * its product evidence, and the alternation keeps a long page rhythmic.
 * Use INSTEAD of a second card grid when features deserve depth.
 */
export default function FeatureRows({
  eyebrow,
  title,
  subtitle,
  items,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  items: FeatureRowItem[];
}) {
  return (
    <Section>
      {title && <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />}
      <div className="flex flex-col gap-[var(--section-space-sm)]">
        {items.map((item, index) => (
          <Reveal key={item.title} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <div className={index % 2 === 1 ? "md:order-2" : undefined}>
              {item.eyebrow && (
                <p className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">{item.eyebrow}</p>
              )}
              <h3 className="font-display text-display-md text-text-primary font-bold">{item.title}</h3>
              <p className="text-text-secondary mt-3 leading-7">{item.body}</p>
              {item.bullets && item.bullets.length > 0 && (
                <ul className="mt-5 flex flex-col gap-2.5">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className="text-text-primary flex items-start gap-2.5 leading-6">
                      <NiCheck size="small" className="text-primary mt-0.5 flex-none" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={index % 2 === 1 ? "md:order-1" : undefined}>{item.media}</div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
