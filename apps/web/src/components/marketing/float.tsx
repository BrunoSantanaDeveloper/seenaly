"use client";
import { useRef } from "react";

import { gsap, readMotionToken, tokenSeconds, useGSAP } from "@/components/marketing/motion";
import { cn } from "@/lib/utils";

/**
 * Gentle infinite oscillation for composition satellites (chips/cards around
 * the hero frame). Compositor-only (y + optional rotation), tiny amplitude,
 * so it stays on for touch devices too; `prefers-reduced-motion` renders it
 * static. Float animates ITS OWN div — entrance timelines animate the outer
 * positioning wrapper, so the transforms never collide.
 */
export default function Float({
  amplitude,
  duration,
  delay = 0,
  rotate = 0,
  className,
  children,
}: {
  /** Pixels of vertical travel. Default: --motion-float-distance token. */
  amplitude?: number;
  /** Seconds for a full up-down cycle. Default: --motion-float-duration token. */
  duration?: number;
  /** Seconds; stagger multiple floats so they de-sync. */
  delay?: number;
  /** Degrees of slow rotation drift (subtle: -2..2). */
  rotate?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const travel = amplitude ?? parseFloat(readMotionToken("--motion-float-distance", "0.4rem")) * 16;
        const cycle = duration ?? tokenSeconds("--motion-float-duration", 6);
        gsap.to(element, {
          y: -travel,
          rotation: rotate,
          duration: cycle / 2, // yoyo halves make one full cycle
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay,
        });
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}
