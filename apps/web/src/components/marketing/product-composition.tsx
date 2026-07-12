import Float from "@/components/marketing/float";
import Parallax from "@/components/marketing/parallax";
import { cn } from "@/lib/utils";

/**
 * Layered hero media — the reference-site pattern: a central product frame
 * with floating satellite chips overlapping its edges at different depths and
 * slight rotations. Below md (960px) the satellites collapse into a centered
 * chip row under the frame (real content stays visible, zero overlap, zero
 * CLS); at md+ they become absolutely positioned layers of the isolated root.
 *
 * Layer scale (see README): z-0 back satellites · z-10 frame · z-20 front
 * satellites. Satellites are REAL localized content (values/labels from
 * i18n), not decoration — never aria-hidden.
 *
 * Hero's load timeline recognizes [data-composition-frame] /
 * [data-composition-satellite] and choreographs the entrance; entrance
 * animates the positioning wrapper while <Float> animates the chip inside,
 * so the transforms never collide.
 */
export type Satellite = {
  /** Usually one of the chips from satellite-chips.tsx. */
  children: React.ReactNode;
  position: "top-left" | "top-right" | "right" | "bottom-right" | "bottom-left" | "left";
  /** front = overlaps the frame (z-20, stronger shadow); back = behind it (z-0, soft shadow). */
  depth?: "front" | "back";
  /** Slight tilt at md+; the mobile row stays level. */
  rotate?: -6 | -3 | -2 | 0 | 2 | 3 | 6;
  /** Gentle infinite oscillation (reduced-motion safe). */
  float?: boolean;
  /** Seconds — de-syncs multiple floats. */
  floatDelay?: number;
  /** Optional scroll parallax (yPercent, capped at 12; desktop-only). */
  parallax?: number;
  /** Hide instead of joining the mobile chip row (purely additive satellites). */
  hideBelow?: "md";
};

const POSITION: Record<NonNullable<Satellite["position"]>, string> = {
  "top-left": "md:absolute md:-top-8 md:-left-6 lg:-left-10",
  "top-right": "md:absolute md:-top-8 md:-right-6 lg:-right-10",
  right: "md:absolute md:top-1/3 md:-right-8",
  "bottom-right": "md:absolute md:-bottom-8 md:-right-6",
  "bottom-left": "md:absolute md:-bottom-8 md:-left-6 lg:-left-12",
  left: "md:absolute md:top-1/2 md:-left-8",
};

const DEPTH: Record<NonNullable<Satellite["depth"]>, string> = {
  front: "z-20 shadow-darker-sm",
  back: "z-0 shadow-xs",
};

const ROTATE: Record<NonNullable<Satellite["rotate"]>, string> = {
  [-6]: "md:-rotate-6",
  [-3]: "md:-rotate-3",
  [-2]: "md:-rotate-2",
  [0]: "",
  [2]: "md:rotate-2",
  [3]: "md:rotate-3",
  [6]: "md:rotate-6",
};

export default function ProductComposition({
  frame,
  satellites,
  className,
}: {
  /** The central evidence: <ProductFrame> with a real screenshot or placeholder. */
  frame: React.ReactNode;
  /** 2–4 floating chips; extras beyond 4 are ignored (compositions get noisy fast). */
  satellites: Satellite[];
  className?: string;
}) {
  return (
    <div className={cn("relative isolate", className)}>
      <div data-composition-frame className="relative z-10">
        {frame}
      </div>

      {/* Mobile: centered chip row under the frame. md+: the box disappears
          (contents) and each satellite positions against the isolated root. */}
      <div className="mt-4 flex flex-wrap justify-center gap-3 md:contents">
        {satellites.slice(0, 4).map((satellite, index) => {
          const chip = satellite.float ? (
            <Float delay={satellite.floatDelay ?? index * 0.6}>{satellite.children}</Float>
          ) : (
            satellite.children
          );
          return (
            <div
              key={index}
              data-composition-satellite
              className={cn(
                "rounded-2xl",
                POSITION[satellite.position],
                DEPTH[satellite.depth ?? "front"],
                ROTATE[satellite.rotate ?? 0],
                satellite.hideBelow === "md" && "hidden md:block",
              )}
            >
              {satellite.parallax ? <Parallax speed={satellite.parallax}>{chip}</Parallax> : chip}
            </div>
          );
        })}
      </div>
    </div>
  );
}
