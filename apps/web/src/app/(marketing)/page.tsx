import { getDisplayPlans } from "./plans";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BRAND } from "@/brand";
import Cta from "@/components/marketing/cta";
import DiagnosisReadout from "@/components/marketing/diagnosis-readout";
import Faq from "@/components/marketing/faq";
import FeatureGrid from "@/components/marketing/feature-grid";
import FeatureRows from "@/components/marketing/feature-row";
import Hero from "@/components/marketing/hero";
import PricingSection from "@/components/marketing/pricing-section";
import ProcessSteps from "@/components/marketing/process-steps";
import {
  DiagnosisVignette,
  FatigueVignette,
  FunnelVignette,
  MemoryVignette,
} from "@/components/marketing/product-vignettes";
import StatBand from "@/components/marketing/stat-band";
import Testimonials from "@/components/marketing/testimonials";
import NiBook from "@/icons/nexture/ni-book";
import NiRocket from "@/icons/nexture/ni-rocket";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";

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
 * Home — committed "Sala de Controle" direction (docs/DESIGN.md): an instrument
 * hero (mono DiagnosisReadout) → instrument decision pipeline (ProcessSteps
 * mono) → FeatureRows depth with the domain vignettes → oversized StatBand
 * proof → more FeatureRows → FeatureGrid foundations → Testimonials → Pricing
 * → FAQ → CTA. Every mid-page section carries a real domain visual; the four
 * product vignettes each get a full-size row/cell. The primary CTA (cta-primary)
 * repeats verbatim at hero, pricing and the final CTA.
 *
 * Family → hue mapping, consistent site-wide: diagnosis/decision = primary,
 * creative fatigue = accent-1, funnel/bottleneck = accent-4, experiment
 * memory = accent-3, Meta knowledge base = secondary, product context /
 * zero-data = accent-2.
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
      />

      <ProcessSteps
        mono
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

      <FeatureRows
        eyebrow={t("bento-eyebrow")}
        title={t("bento-title")}
        items={[
          {
            eyebrow: t("row-3-eyebrow"),
            title: t("bento-1-title"),
            body: t("bento-1-body"),
            bullets: [t("row-3-bullet-1"), t("row-3-bullet-2"), t("row-3-bullet-3")],
            media: <FunnelVignette tone="accent-4" />,
            tone: "accent-4",
          },
          {
            eyebrow: t("row-4-eyebrow"),
            title: t("bento-2-title"),
            body: t("bento-2-body"),
            bullets: [t("row-4-bullet-1"), t("row-4-bullet-2"), t("row-4-bullet-3")],
            media: <MemoryVignette tone="accent-3" />,
            tone: "accent-3",
          },
        ]}
      />

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

      <Cta
        kicker={t("cta-kicker")}
        title={t("cta-title")}
        subtitle={t("cta-subtitle")}
        cta={{ label: t("cta-primary"), href: "/auth/sign-up" }}
      />
    </>
  );
}
