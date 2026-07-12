"use client";
import { useRef } from "react";

import { gsap, useGSAP } from "@/components/marketing/motion";
import { cn } from "@/lib/utils";

/**
 * Scroll-scrubbed vertical drift for layered media/decor. Desktop-only by
 * design (scroll-linked transforms fight mobile URL-bar resizes and feel
 * janky on touch) and reduced-motion safe. Speed is capped at 12 yPercent —
 * parallax is seasoning, never the dish.
 */
export default function Parallax({
  speed = 8,
  className,
  children,
}: {
  /** yPercent half-range: element travels +speed → -speed across its scroll window. Capped at 12. */
  speed?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return;

      const clamped = Math.min(Math.abs(speed), 12) * (speed < 0 ? -1 : 1);
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 960px)", () => {
        gsap.fromTo(
          element,
          { yPercent: clamped },
          {
            yPercent: -clamped,
            ease: "none",
            scrollTrigger: { trigger: element, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
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
