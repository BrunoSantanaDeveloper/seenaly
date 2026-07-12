"use client";
import Link from "next/link";
import { useRef } from "react";

import { Button } from "@mui/material";

import { gsap, readMotionToken, tokenSeconds, useGSAP } from "@/components/marketing/motion";
import Section from "@/components/marketing/section";

export type HeroCta = { label: string; href: string };

/**
 * Funnel stage: attention + value proposition. Above the fold it must answer
 * what the product is, for whom, and the outcome — before any scrolling.
 * `media` is the product-as-proof slot (usually <ProductFrame> with a real
 * screenshot); the primary CTA label is THE conversion action of the page.
 *
 * Entrance is the page's ONE orchestrated motion moment (committed direction):
 * copy staggers in, then the media rises — a load timeline, not a scroll
 * reveal. Reduced motion renders everything static and visible.
 */
export default function Hero({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  media,
  layout = "center",
  decor = "glow",
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  primaryCta: HeroCta;
  secondaryCta?: HeroCta;
  /** Product evidence. Required in practice — a hero without it fails the premium bar. */
  media?: React.ReactNode;
  /** "center": stacked, media below. "split": copy left, media right (data/product-heavy pages). */
  layout?: "center" | "split";
  decor?: "glow" | "grid" | "none";
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const element = scope.current;
      if (!element) return;

      const distance = readMotionToken("--motion-reveal-distance", "2.5rem");
      const duration = tokenSeconds("--motion-duration-3", 0.8);

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const timeline = gsap.timeline({
          defaults: { y: distance, autoAlpha: 0, duration, ease: "power3.out" },
        });
        timeline.from(element.querySelectorAll("[data-hero-copy] > *"), { stagger: 0.12 });

        // Layered media (<ProductComposition>): frame rises, then satellites
        // pop in staggered. The entrance animates each satellite's positioning
        // wrapper — <Float> inside animates the chip itself, so no collision.
        const frame = element.querySelector("[data-composition-frame]");
        if (frame) {
          timeline.from(frame, {}, "-=0.55");
          const satellites = element.querySelectorAll("[data-composition-satellite]");
          if (satellites.length) {
            const half = (parseFloat(distance) * 16) / 2; // rem → px, half the reveal distance
            timeline.from(satellites, { y: half, autoAlpha: 0, scale: 0.96, stagger: 0.08 }, "-=0.35");
          }
          return;
        }

        const mediaElement = element.querySelector("[data-hero-media]");
        if (mediaElement) timeline.from(mediaElement, {}, "-=0.55");
      });
    },
    { scope },
  );

  const ctas = (
    <div className="flex flex-col items-center gap-2 sm:flex-row">
      <Button size="large" variant="contained" color="primary" href={primaryCta.href} LinkComponent={Link}>
        {primaryCta.label}
      </Button>
      {secondaryCta && (
        <Button size="large" variant="pastel" color="primary" href={secondaryCta.href} LinkComponent={Link}>
          {secondaryCta.label}
        </Button>
      )}
    </div>
  );

  if (layout === "split") {
    return (
      <Section spacing="default" decor={decor} className="overflow-hidden">
        <div ref={scope} className="grid items-center gap-10 md:grid-cols-[1.05fr_1fr] md:gap-14">
          <div data-hero-copy className="flex flex-col items-start gap-6 text-left">
            {eyebrow && <p className="text-primary text-sm font-semibold tracking-wide uppercase">{eyebrow}</p>}
            <h1 className="font-display text-display-xl text-text-primary font-extrabold">{title}</h1>
            <p className="text-text-secondary text-lg leading-6 md:text-xl md:leading-7">{subtitle}</p>
            {ctas}
          </div>
          {media && (
            <div data-hero-media className="w-full">
              {media}
            </div>
          )}
        </div>
      </Section>
    );
  }

  return (
    <Section spacing="default" decor={decor} className="overflow-hidden">
      <div ref={scope} className="flex flex-col items-center">
        <div data-hero-copy className="flex flex-col items-center gap-6 text-center">
          {eyebrow && <p className="text-primary text-sm font-semibold tracking-wide uppercase">{eyebrow}</p>}

          <h1 className="font-display text-display-2xl text-text-primary max-w-4xl font-extrabold">{title}</h1>

          <p className="text-text-secondary max-w-2xl text-lg leading-6 md:text-xl md:leading-7">{subtitle}</p>

          {ctas}
        </div>

        {media && (
          <div data-hero-media className="mt-14 w-full max-w-4xl">
            {media}
          </div>
        )}
      </div>
    </Section>
  );
}
