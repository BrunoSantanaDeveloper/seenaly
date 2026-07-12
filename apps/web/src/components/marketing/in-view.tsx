"use client";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Sets `data-inview` on its div the first time it enters the viewport, then
 * disconnects — a one-shot CSS hook so server-rendered visuals (e.g. the
 * DataVizPlaceholder draw-in) can key their animation off scroll entry
 * without importing GSAP. No-JS and reduced-motion stay correct because the
 * consuming CSS treats the attribute as progressive enhancement.
 */
export default function InView({
  threshold = 0.35,
  className,
  children,
}: {
  threshold?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.setAttribute("data-inview", "");
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}
