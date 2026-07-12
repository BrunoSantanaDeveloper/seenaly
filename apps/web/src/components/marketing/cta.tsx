"use client";
import Link from "next/link";

import { Button } from "@mui/material";

import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";

/**
 * Funnel stage: recovery — the last conversion opportunity on the page.
 * A bordered "console" panel with a primary glow and an optional mono kicker
 * so it carries real presence instead of reading as a pastel box. The button
 * label must repeat the page's primary CTA verbatim.
 */
export default function Cta({
  title,
  subtitle,
  cta,
  kicker,
  decor = "none",
}: {
  title: string;
  subtitle?: string;
  cta: { label: string; href: string };
  /** Optional mono kicker above the title (e.g. "next step"). */
  kicker?: string;
  /** Ambient layer on the surrounding Section (orbit is the classic closer). */
  decor?: "none" | "orbit" | "mesh" | "dots";
}) {
  return (
    <Section decor={decor}>
      <Reveal>
        <div className="border-grey-100 bg-background-paper relative overflow-hidden rounded-4xl border px-6 py-16 text-center md:py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(ellipse 60% 80% at 50% 0%, hsl(var(--primary) / 0.12), transparent 70%)",
            }}
          />
          <div className="relative flex flex-col items-center gap-4">
            {kicker && <p className="text-primary font-mono text-xs tracking-widest uppercase">{kicker}</p>}
            <h2 className="font-display text-display-lg text-text-primary max-w-2xl font-bold">{title}</h2>
            {subtitle && <p className="text-text-secondary max-w-xl text-lg leading-6">{subtitle}</p>}
            <Button
              size="large"
              variant="contained"
              color="primary"
              href={cta.href}
              LinkComponent={Link}
              className="mt-2"
            >
              {cta.label}
            </Button>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
