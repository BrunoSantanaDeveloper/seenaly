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
 * Exported as SECTION_DECOR so Band can reuse the same vocabulary.
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
  /** Dot matrix fading from the top — quiet technical texture. */
  dots: (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: "radial-gradient(hsl(var(--grey-200) / 0.55) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        maskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black, transparent 78%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black, transparent 78%)",
      }}
    />
  ),
  /** Multi-hue corner mesh at low alpha — ambient depth without a single flat wash. */
  mesh: (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(40% 35% at 12% 8%, hsl(var(--primary) / 0.1), transparent 70%), radial-gradient(35% 30% at 88% 12%, hsl(var(--accent-1) / 0.08), transparent 70%), radial-gradient(45% 40% at 70% 95%, hsl(var(--accent-4) / 0.07), transparent 70%)",
      }}
    />
  ),
  /**
   * Faded ring with slowly orbiting dots — the page's one "alive" ambient.
   * CSS keyframes (inline, the DataVizPlaceholder precedent) under
   * prefers-reduced-motion: no-preference; reduced motion = static ring.
   */
  orbit: (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`@media (prefers-reduced-motion: no-preference){.mkt-orbit{animation:mkt-orbit-spin var(--motion-orbit-duration,40s) linear infinite}}@keyframes mkt-orbit-spin{to{transform:rotate(360deg)}}`}</style>
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: "38rem", height: "38rem" }}
      >
        <div
          className="border-grey-100 absolute inset-0 rounded-full border"
          style={{
            maskImage: "linear-gradient(to bottom, black 0%, transparent 82%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 82%)",
          }}
        />
        <div className="mkt-orbit absolute inset-0">
          <span className="bg-primary/40 absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full" />
          <span className="bg-accent-1/40 absolute top-1/2 right-0 h-1.5 w-1.5 translate-x-1/2 rounded-full" />
          <span className="bg-accent-4/40 absolute bottom-6 left-10 h-1.5 w-1.5 rounded-full" />
        </div>
      </div>
    </div>
  ),
};

export { DECOR as SECTION_DECOR };

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
