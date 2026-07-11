import { cn } from "@/lib/utils";

/**
 * Standard heading block for a marketing section: eyebrow, display-scale
 * title and supporting subtitle. Keeps hierarchy identical across sections.
 *
 * `as` sets the heading tag WITHOUT changing the visual size: every page needs
 * exactly one <h1> (its page title). Pages that open with a <Hero> already have
 * their <h1> there; a page whose lead is a plain section passes `as="h1"` to its
 * first SectionHeader. All other section headers stay <h2>.
 */
export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
  as: Heading = "h2",
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "start" | "center";
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-10 flex max-w-2xl flex-col gap-3 md:mb-14",
        align === "center" ? "mx-auto items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow && <p className="text-primary text-sm font-semibold tracking-wide uppercase">{eyebrow}</p>}
      <Heading className="font-display text-display-lg text-text-primary font-bold">{title}</Heading>
      {subtitle && <p className="text-text-secondary text-lg leading-6">{subtitle}</p>}
    </div>
  );
}
