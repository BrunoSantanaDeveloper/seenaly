import { getDisplayPlans } from "./plans";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BRAND } from "@/brand";
import Breakout from "@/components/marketing/breakout";
import Cta from "@/components/marketing/cta";
import DiagnosisReadout from "@/components/marketing/diagnosis-readout";
import Faq from "@/components/marketing/faq";
import FeatureGrid from "@/components/marketing/feature-grid";
import FeatureRows from "@/components/marketing/feature-row";
import Hero from "@/components/marketing/hero";
import PricingSection from "@/components/marketing/pricing-section";
import ProcessSteps from "@/components/marketing/process-steps";
import ProductComposition from "@/components/marketing/product-composition";
import ProductShot from "@/components/marketing/product-shot";
import { DiagnosisVignette, FatigueVignette, FunnelVignette } from "@/components/marketing/product-vignettes";
import { KpiChip, ReadoutChip, TrendChip } from "@/components/marketing/satellite-chips";
import Section from "@/components/marketing/section";
import StatBand from "@/components/marketing/stat-band";
import Testimonials from "@/components/marketing/testimonials";
import { TONE } from "@/components/marketing/tone";
import NiBook from "@/icons/nexture/ni-book";
import NiCheck from "@/icons/nexture/ni-check";
import NiRocket from "@/icons/nexture/ni-rocket";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing");
  // `absolute` bypasses the root "%s | Brand" template so the home title reads
  // as one line: "Seenaly — <value proposition>" (keyword-led, ~60 chars).
  return {
    title: { absolute: `${BRAND.name} — ${t("home-meta-title")}` },
    description: t("home-meta-description"),
  };
}

/**
 * Home — committed "Sala de Controle" direction (docs/DESIGN.md): a LAYERED
 * instrument hero (mono DiagnosisReadout framed by ProductComposition, orbited
 * by the three signals it cross-references) → instrument decision pipeline
 * (ProcessSteps mono) → FeatureRows zig-zag with the domain vignettes →
 * oversized StatBand proof (counts up) → the memory BREAKOUT (the product's
 * differentiator, media bleeding to the viewport edge) → FeatureGrid
 * foundations → Testimonials → Pricing → FAQ → CTA (orbit closer). The primary
 * CTA (cta-primary) repeats verbatim at hero, pricing and the final CTA.
 *
 * Family → hue mapping, consistent site-wide: diagnosis/decision = primary,
 * creative fatigue = accent-1, funnel/bottleneck = accent-4, experiment
 * memory = accent-3, Meta knowledge base = secondary, product context /
 * zero-data = accent-2.
 *
 * Ambient motion budget (premium bar #11): 3 Float (hero satellites) + 1
 * Parallax (the back-depth satellite) + 1 orbit (the closing CTA). Under the
 * ≤4 / ≤2 / ≤1 ceiling; StatBand's CountUp is built in.
 */
export default async function Home() {
  const [t, plans] = await Promise.all([getTranslations("marketing"), getDisplayPlans()]);

  return (
    <>
      <Hero
        layout="split"
        eyebrow={t("hero-eyebrow")}
        title={t("hero-title")}
        subtitle={t("hero-subtitle")}
        primaryCta={{ label: t("cta-primary"), href: "/auth/sign-up" }}
        secondaryCta={{ label: t("hero-secondary"), href: "/pricing" }}
        media={
          <ProductComposition
            frame={
              <DiagnosisReadout
                title={t("readout-title")}
                signal={t("readout-signal")}
                rows={[1, 2, 3, 4].map((index) => ({
                  label: t(`readout-row-${index}-label`),
                  value: t(`readout-row-${index}-value`),
                }))}
                confidenceLabel={t("readout-confidence-label")}
                confidenceValue={t("readout-confidence-value")}
              />
            }
            /* The three signals the readout above actually cross-references —
               each in its family hue, so the hero states the palette mapping
               the rest of the page keeps. Primary stays on the CTA + glow. */
            satellites={[
              {
                children: (
                  <KpiChip
                    label={t("satellite-fatigue-label")}
                    value={t("satellite-fatigue-value")}
                    delta={t("satellite-fatigue-delta")}
                    tone="accent-1"
                  />
                ),
                position: "top-right",
                depth: "front",
                rotate: 2,
                float: true,
              },
              {
                /* depth="back": a front chip on this corner would sit on top of
                   the readout's confidence row and hide its value. Behind the
                   frame it peeks out from the corner instead — layered, and the
                   readout stays fully legible. */
                children: <TrendChip label={t("satellite-funnel-label")} data={[12, 11, 9, 7, 6, 5]} tone="accent-4" />,
                position: "bottom-right",
                depth: "back",
                rotate: -2,
                float: true,
                floatDelay: 0.8,
              },
              {
                children: <ReadoutChip text={t("satellite-memory-text")} tone="accent-3" />,
                position: "top-left",
                depth: "back",
                rotate: -3,
                float: true,
                floatDelay: 1.4,
                parallax: 6,
              },
            ]}
          />
        }
      />

      <ProcessSteps
        variant="mono"
        eyebrow={t("pipeline-eyebrow")}
        title={t("pipeline-title")}
        steps={[
          {
            kicker: t("pipeline-1-kicker"),
            title: t("pipeline-1-title"),
            body: t("pipeline-1-body"),
            tone: "secondary",
          },
          {
            kicker: t("pipeline-2-kicker"),
            title: t("pipeline-2-title"),
            body: t("pipeline-2-body"),
            tone: "accent-4",
          },
          { kicker: t("pipeline-3-kicker"), title: t("pipeline-3-title"), body: t("pipeline-3-body"), tone: "primary" },
        ]}
      />

      <FeatureRows
        id="features"
        decor="grid"
        eyebrow={t("features-eyebrow")}
        title={t("features-title")}
        subtitle={t("features-subtitle")}
        items={[
          {
            eyebrow: t("row-1-eyebrow"),
            title: t("row-1-title"),
            body: t("row-1-body"),
            bullets: [t("row-1-bullet-1"), t("row-1-bullet-2"), t("row-1-bullet-3")],
            media: <DiagnosisVignette tone="primary" />,
            tone: "primary",
          },
          {
            eyebrow: t("row-2-eyebrow"),
            title: t("row-2-title"),
            body: t("row-2-body"),
            bullets: [t("row-2-bullet-1"), t("row-2-bullet-2"), t("row-2-bullet-3")],
            media: <FatigueVignette tone="accent-1" />,
            tone: "accent-1",
          },
          {
            eyebrow: t("row-3-eyebrow"),
            title: t("row-3-title"),
            body: t("row-3-body"),
            bullets: [t("row-3-bullet-1"), t("row-3-bullet-2"), t("row-3-bullet-3")],
            media: <FunnelVignette tone="accent-4" />,
            tone: "accent-4",
          },
        ]}
      />

      <StatBand
        stats={[
          { value: t("stats-1-value"), label: t("stats-1-label"), tone: "accent-3" },
          { value: t("stats-2-value"), label: t("stats-2-label"), tone: "secondary" },
          { value: t("stats-3-value"), label: t("stats-3-label"), tone: "accent-2" },
          { value: t("stats-4-value"), label: t("stats-4-label"), tone: "primary" },
        ]}
      />

      {/* The one breakout of the page (premium bar #10) — reserved for the
          product's differentiator: experiment memory. The vignette escapes the
          container to the right edge; the copy column stays on the site grid. */}
      <Section bleed decor="dots" className="overflow-x-clip">
        <Breakout
          side="right"
          media={
            <ProductShot name="experiment-memory" alt={t("memory-shot-alt")} sizes="(max-width: 960px) 100vw, 50vw" />
          }
        >
          <p className={cn("mb-3 text-sm font-semibold tracking-wide uppercase", TONE["accent-3"].text)}>
            {t("memory-eyebrow")}
          </p>
          <h2 className="font-display text-display-lg text-text-primary font-bold">{t("memory-title")}</h2>
          <p className="text-text-secondary mt-4 leading-7">{t("memory-body")}</p>
          <ul className="mt-6 flex flex-col gap-2.5">
            {[1, 2, 3].map((index) => (
              <li key={index} className="text-text-primary flex items-start gap-2.5 leading-6">
                <NiCheck size="small" className={cn("mt-0.5 flex-none", TONE["accent-3"].text)} />
                {t(`memory-bullet-${index}`)}
              </li>
            ))}
          </ul>
        </Breakout>
      </Section>

      <FeatureGrid
        eyebrow={t("foundations-eyebrow")}
        title={t("foundations-title")}
        features={[
          { icon: <NiBook />, title: t("bento-3-title"), description: t("bento-3-body"), tone: "secondary" },
          { icon: <NiRocket />, title: t("bento-4-title"), description: t("bento-4-body"), tone: "accent-2" },
          { icon: <NiShieldCheck />, title: t("bento-5-title"), description: t("bento-5-body"), tone: "accent-1" },
        ]}
      />

      <Testimonials
        eyebrow={t("testimonials-eyebrow")}
        title={t("testimonials-title")}
        items={[1, 2, 3].map((index) => ({
          quote: t(`testimonial-${index}-quote`),
          name: t(`testimonial-${index}-name`),
          role: t(`testimonial-${index}-role`),
        }))}
      />

      <PricingSection
        id="pricing"
        eyebrow={t("pricing-eyebrow")}
        title={t("pricing-title")}
        subtitle={t("pricing-subtitle")}
        plans={plans}
        ctaLabel={t("cta-primary")}
      />

      <Faq
        eyebrow={t("faq-eyebrow")}
        title={t("faq-title")}
        items={[1, 2, 3, 4].map((index) => ({
          question: t(`faq-${index}-question`),
          answer: t(`faq-${index}-answer`),
        }))}
      />

      {/* decor="orbit" is the page's single slowly-alive ambient (budget: ≤1). */}
      <Cta
        decor="orbit"
        kicker={t("cta-kicker")}
        title={t("cta-title")}
        subtitle={t("cta-subtitle")}
        cta={{ label: t("cta-primary"), href: "/auth/sign-up" }}
      />
    </>
  );
}
