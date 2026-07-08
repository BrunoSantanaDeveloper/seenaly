"use client";
import Link from "next/link";

import { Button } from "@mui/material";

import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import { TONE, type Tone, toneAt } from "@/components/marketing/tone";
import NiCheck from "@/icons/nexture/ni-check";
import { cn } from "@/lib/utils";

/** Display-ready plan: price already formatted for the active locale/currency. */
export type PublicPlanDisplay = {
  slug: string;
  name: string;
  description?: string;
  price: string;
  period?: string;
  features: string[];
  highlighted?: boolean;
  /** Harmonic hue identifying this tier (name mark + feature checks). Defaults to a rotation. */
  tone?: Tone;
};

/**
 * Funnel stage: action. Real plans come from packages/billing
 * (listPublicPlans → formatted by the page); the CTA repeats the page's
 * primary action and leads straight to sign-up.
 */
export default function PricingSection({
  id,
  eyebrow,
  title,
  subtitle,
  plans,
  ctaLabel,
  ctaHref = "/auth/sign-up",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  plans: PublicPlanDisplay[];
  ctaLabel: string;
  ctaHref?: string;
}) {
  return (
    <Section id={id}>
      <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <Reveal stagger={0.08} className="mx-auto grid w-full max-w-4xl grid-cols-1 items-stretch gap-6 md:grid-cols-3">
        {plans.map((plan, index) => {
          const tone = TONE[plan.tone ?? toneAt(index)];
          return (
            <div
              key={plan.slug}
              className={
                plan.highlighted
                  ? "border-primary bg-background-paper shadow-darker-xs flex flex-col gap-4 rounded-3xl border-2 p-6"
                  : "border-grey-100 bg-background-paper flex flex-col gap-4 rounded-3xl border p-6"
              }
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-row items-center gap-2">
                  <span aria-hidden className={cn("h-2.5 w-2.5 flex-none rounded-full", tone.softBg)}>
                    <span
                      className={cn("block h-full w-full scale-50 rounded-full", tone.text)}
                      style={{ backgroundColor: "currentcolor" }}
                    />
                  </span>
                  <h3 className="text-text-primary font-heading text-xl font-bold">{plan.name}</h3>
                </div>
                {plan.description && <p className="text-text-secondary text-sm leading-5">{plan.description}</p>}
              </div>

              <p className="flex flex-row items-baseline gap-1">
                <span className="font-display text-display-md text-text-primary font-bold">{plan.price}</span>
                {plan.period && <span className="text-text-secondary text-sm">{plan.period}</span>}
              </p>

              <ul className="flex flex-1 flex-col gap-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="text-text-secondary flex flex-row items-start gap-2 text-base leading-6">
                    <NiCheck size="small" className={cn("mt-1 flex-none", tone.text)} />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.highlighted ? "contained" : "pastel"}
                color="primary"
                href={ctaHref}
                LinkComponent={Link}
              >
                {ctaLabel}
              </Button>
            </div>
          );
        })}
      </Reveal>
    </Section>
  );
}
