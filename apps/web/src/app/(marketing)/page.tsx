import { getDisplayPlans } from "./plans";
import { getTranslations } from "next-intl/server";

import BentoGrid from "@/components/marketing/bento-grid";
import Cta from "@/components/marketing/cta";
import DataVizPlaceholder from "@/components/marketing/data-viz-placeholder";
import Faq from "@/components/marketing/faq";
import FeatureRows from "@/components/marketing/feature-row";
import Hero from "@/components/marketing/hero";
import LogoCloud from "@/components/marketing/logo-cloud";
import PricingSection from "@/components/marketing/pricing-section";
import ProductFrame from "@/components/marketing/product-frame";
import {
  DiagnosisVignette,
  FatigueVignette,
  FunnelVignette,
  MemoryVignette,
} from "@/components/marketing/product-vignettes";
import StatBand from "@/components/marketing/stat-band";
import Testimonials from "@/components/marketing/testimonials";
import NiAi from "@/icons/nexture/ni-ai";
import NiChartLine from "@/icons/nexture/ni-chart-line";
import NiFlash from "@/icons/nexture/ni-flash";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";

function IconChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-xl">{children}</span>
  );
}

/**
 * Home = conversion funnel: hero (value prop + product evidence) → logos
 * (trust) → stat band (proof) → feature rows (desire, claim next to
 * evidence) → bento (foundation) → testimonials → pricing (action) →
 * FAQ (objections) → CTA (recovery). Background rhythm per DESIGN.md:
 * glow → contrast band → grid → paper. The primary CTA label (cta-primary)
 * repeats verbatim at every action point.
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
          <ProductFrame glow>
            <DataVizPlaceholder label={t("hero-viz-label")} />
          </ProductFrame>
        }
      />

      <LogoCloud label={t("logos-label")} items={[1, 2, 3, 4, 5].map((index) => ({ name: t(`logo-${index}`) }))} />

      <StatBand
        stats={[1, 2, 3, 4].map((index) => ({
          value: t(`stat-${index}-value`),
          label: t(`stat-${index}-label`),
        }))}
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
            title: t("feature-2-title"),
            body: t("feature-2-description"),
            bullets: [1, 2, 3].map((index) => t(`row-1-bullet-${index}`)),
            media: <DiagnosisVignette />,
          },
          {
            eyebrow: t("row-2-eyebrow"),
            title: t("feature-3-title"),
            body: t("feature-3-description"),
            bullets: [1, 2, 3].map((index) => t(`row-2-bullet-${index}`)),
            media: <FatigueVignette />,
          },
          {
            eyebrow: t("row-3-eyebrow"),
            title: t("feature-4-title"),
            body: t("feature-4-description"),
            bullets: [1, 2, 3].map((index) => t(`row-3-bullet-${index}`)),
            media: <FunnelVignette />,
          },
        ]}
      />

      <BentoGrid
        background="paper"
        eyebrow={t("bento-eyebrow")}
        title={t("bento-title")}
        subtitle={t("bento-subtitle")}
        items={[
          {
            title: t("bento-memory-title"),
            body: t("bento-memory-body"),
            visual: <MemoryVignette />,
            featured: true,
          },
          {
            title: t("feature-1-title"),
            body: t("feature-1-description"),
            visual: (
              <IconChip>
                <NiFlash />
              </IconChip>
            ),
          },
          {
            title: t("feature-5-title"),
            body: t("feature-5-description"),
            visual: (
              <IconChip>
                <NiAi />
              </IconChip>
            ),
          },
          {
            title: t("feature-6-title"),
            body: t("feature-6-description"),
            visual: (
              <IconChip>
                <NiChartLine />
              </IconChip>
            ),
          },
          {
            title: t("bento-readonly-title"),
            body: t("bento-readonly-body"),
            visual: (
              <IconChip>
                <NiShieldCheck />
              </IconChip>
            ),
          },
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
        title={t("cta-title")}
        subtitle={t("cta-subtitle")}
        cta={{ label: t("cta-primary"), href: "/auth/sign-up" }}
      />
    </>
  );
}
