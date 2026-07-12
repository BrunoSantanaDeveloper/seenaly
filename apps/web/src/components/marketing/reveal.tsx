"use client";
import { useRef } from "react";

import { gsap, readMotionToken, tokenSeconds, useGSAP } from "@/components/marketing/motion";
import { cn } from "@/lib/utils";

/**
 * Scroll reveal for marketing sections — the ONLY sanctioned way to animate
 * content into view. Rules baked in (do not bypass):
 * - transforms + autoAlpha only (compositor-friendly, no layout thrash);
 * - plays once, near-viewport trigger;
 * - `prefers-reduced-motion: reduce` renders everything static and visible;
 * - distance/duration come from the marketing motion tokens.
 */
export default function Reveal({
  children,
  className,
  stagger = 0,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Seconds between children; 0 animates the wrapper as a single block. */
  stagger?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return;

      const distance = readMotionToken("--motion-reveal-distance", "2.5rem");
      const duration = tokenSeconds("--motion-duration-3", 0.8);

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(stagger > 0 ? Array.from(element.children) : element, {
          y: distance,
          autoAlpha: 0,
          duration,
          ease: "power3.out",
          delay,
          stagger,
          scrollTrigger: {
            trigger: element,
            start: "top 85%",
            once: true,
          },
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
