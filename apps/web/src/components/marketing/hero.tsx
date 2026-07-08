"use client";
import gsap from "gsap";
import Link from "next/link";
import { useRef } from "react";

import { Button } from "@mui/material";

import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export type HeroCta = { label: string; href: string };

/**
 * Funnel stage: attention + value proposition. Above the fold it must answer
 * what the product is, for whom, and the outcome — before any scrolling.
 * `media` is the product-as-proof slot (usually <ProductFrame> with a real
 * screenshot); the primary CTA label is THE conversion action of the page.
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

  // The page's one orchestrated motion moment (DESIGN.md): staggered copy,
  // then the product frame rises — a timeline, not uniform scroll-reveals.
  // Center layout keeps the quiet <Reveal>; reduced motion renders static.
  useGSAP(
    () => {
      if (layout !== "split" || !scope.current) return;

      const rootStyles = getComputedStyle(document.documentElement);
      const distance = rootStyles.getPropertyValue("--motion-reveal-distance").trim() || "2.5rem";
      const duration = (parseFloat(rootStyles.getPropertyValue("--motion-duration-3")) || 800) / 1000;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out", duration } });
        tl.from("[data-hero-copy] > *", { y: distance, autoAlpha: 0, stagger: 0.12 });
        tl.from("[data-hero-media]", { y: distance, autoAlpha: 0, scale: 0.98, duration: duration * 1.25 }, "<0.25");
      });
    },
    { scope, dependencies: [layout] },
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
      <Reveal stagger={0.12} className="flex flex-col items-center gap-6 text-center">
        {eyebrow && <p className="text-primary text-sm font-semibold tracking-wide uppercase">{eyebrow}</p>}

        <h1 className="font-display text-display-2xl text-text-primary max-w-4xl font-extrabold">{title}</h1>

        <p className="text-text-secondary max-w-2xl text-lg leading-6 md:text-xl md:leading-7">{subtitle}</p>

        {ctas}

        {media && <div className="mt-8 w-full max-w-4xl">{media}</div>}
      </Reveal>
    </Section>
  );
}
