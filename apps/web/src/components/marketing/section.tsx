import Container from "./container";

import { cn } from "@/lib/utils";

const SPACING = {
  default: "py-[var(--section-space)]",
  compact: "py-[var(--section-space-sm)]",
} as const;

const BACKGROUND = {
  default: "",
  paper: "bg-background-paper",
  "primary-soft": "bg-primary/5",
  /** Elevated band: tinted surface + hairline borders — breaks long same-color scrolls. */
  contrast: "bg-background-paper border-grey-100 border-y",
} as const;

/**
 * Decorative depth layers (absolute, pointer-events-none, token-driven).
 * Expensive-product pages change the background treatment along the scroll —
 * use these instead of leaving every section on the same flat color.
 */
const DECOR: Record<string, React.ReactNode> = {
  none: null,
  /** Radial primary wash behind the content — the "hero glow". */
  glow: (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        background: "radial-gradient(ellipse 70% 45% at 50% 8%, hsl(var(--primary) / 0.14), transparent 70%)",
      }}
    />
  ),
  /** Subtle line grid fading toward the bottom — technical/data mood. */
  grid: (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(hsl(var(--grey-100) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--grey-100) / 0.5) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage: "linear-gradient(to bottom, black 0%, transparent 85%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 85%)",
      }}
    />
  ),
  /** Soft top edge gradient — gentle transition into a new scroll chapter. */
  "gradient-edge": (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-64"
      style={{ background: "linear-gradient(to bottom, hsl(var(--primary) / 0.06), transparent)" }}
    />
  ),
};

/**
 * Vertical rhythm unit of every marketing page. All sections MUST be wrapped
 * in <Section> — spacing and width are decided here (marketing tokens), not
 * per page, so pages stay consistent by construction. `decor` adds a
 * token-driven depth layer; vary background/decor at least twice along a page
 * (see the marketing-page skill's premium bar).
 */
export default function Section({
  id,
  spacing = "default",
  background = "default",
  decor = "none",
  bleed = false,
  className,
  children,
}: {
  id?: string;
  spacing?: keyof typeof SPACING;
  background?: keyof typeof BACKGROUND;
  decor?: keyof typeof DECOR;
  /** Skip the inner Container (full-bleed content manages its own bounds). */
  bleed?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("relative w-full", SPACING[spacing], BACKGROUND[background], className)}>
      {DECOR[decor]}
      <div className="relative">{bleed ? children : <Container>{children}</Container>}</div>
    </section>
  );
}
