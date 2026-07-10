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
import ProcessSteps from "@/components/marketing/process-steps";
import ProductFrame from "@/components/marketing/product-frame";
import { FatigueVignette, FunnelVignette, MemoryVignette } from "@/components/marketing/product-vignettes";
import StatBand from "@/components/marketing/stat-band";
import Testimonials from "@/components/marketing/testimonials";
import { TONE, type Tone } from "@/components/marketing/tone";
import NiAi from "@/icons/nexture/ni-ai";
import NiChartLine from "@/icons/nexture/ni-chart-line";
import NiListCheck from "@/icons/nexture/ni-list-check";
import NiPlug from "@/icons/nexture/ni-plug";
import NiRefresh from "@/icons/nexture/ni-refresh";
import NiSearch from "@/icons/nexture/ni-search";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import { cn } from "@/lib/utils";

/**
 * Harmonic hue per feature family (premium bar item 7 / DESIGN.md). Primary
 * stays reserved for CTAs and the hero; every categorical family below keeps
 * ONE consistent hue across the whole page and site:
 *   diagnosis     → the daily recommendation engine + its read-only principle
 *   creative      → creative fatigue
 *   funnel        → funnel view + client reports (results delivered)
 *   connection    → the Meta Ads data pipeline
 *   intelligence  → the differentiator: experiment memory + AI grounding
 */
const FAMILY = {
  diagnosis: "accent-1",
  creative: "accent-2",
  funnel: "accent-3",
  connection: "accent-4",
  intelligence: "secondary",
} as const satisfies Record<string, Tone>;

function IconChip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const t = TONE[tone];
  return (
    <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", t.softBg, t.text)}>{children}</span>
  );
}

/**
 * Home = conversion funnel: hero (value prop + product evidence) → logos
 * (trust) → stat band (proof) → process (how the daily diagnosis works) →
 * feature rows (desire, claim next to evidence) → bento (foundation) →
 * testimonials → pricing (action) → FAQ (objections) → CTA (recovery).
 * Background rhythm per DESIGN.md: glow → contrast band → grid → paper.
 * The primary CTA label (cta-primary) repeats verbatim at every action point.
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

      {/* Proof band. Each number takes its family hue (premium bar item 7) —
          the read-only guarantee ("0 alterações") belongs to the diagnosis
          family, same as the bento cell that states the principle. */}
      <StatBand
        stats={[
          { value: t("stat-1-value"), label: t("stat-1-label"), tone: FAMILY.diagnosis },
          { value: t("stat-2-value"), label: t("stat-2-label"), tone: FAMILY.connection },
          { value: t("stat-3-value"), label: t("stat-3-label"), tone: FAMILY.intelligence },
          { value: t("stat-4-value"), label: t("stat-4-label"), tone: FAMILY.diagnosis },
        ]}
      />

      {/* How the daily diagnosis works — the flow, scannable by icon + deliverable.
          Hues follow the family map: sync (connection) → read (intelligence) → recommend (diagnosis). */}
      <ProcessSteps
        eyebrow={t("process-eyebrow")}
        title={t("process-title")}
        subtitle={t("process-subtitle")}
        steps={[
          {
            icon: <NiRefresh />,
            title: t("process-1-title"),
            body: t("process-1-body"),
            deliverableLabel: t("process-deliverable-label"),
            deliverableValue: t("process-1-deliverable"),
            tone: FAMILY.connection,
          },
          {
            icon: <NiSearch />,
            title: t("process-2-title"),
            body: t("process-2-body"),
            deliverableLabel: t("process-deliverable-label"),
            deliverableValue: t("process-2-deliverable"),
            tone: FAMILY.intelligence,
          },
          {
            icon: <NiListCheck />,
            title: t("process-3-title"),
            body: t("process-3-body"),
            deliverableLabel: t("process-deliverable-label"),
            deliverableValue: t("process-3-deliverable"),
            tone: FAMILY.diagnosis,
          },
        ]}
      />

      <FeatureRows
        id="features"
        eyebrow={t("features-eyebrow")}
        title={t("features-title")}
        subtitle={t("features-subtitle")}
        items={[
          {
            eyebrow: t("row-2-eyebrow"),
            title: t("feature-3-title"),
            body: t("feature-3-description"),
            bullets: [1, 2, 3].map((index) => t(`row-2-bullet-${index}`)),
            media: <FatigueVignette tone={FAMILY.creative} />,
            tone: FAMILY.creative,
          },
          {
            eyebrow: t("row-3-eyebrow"),
            title: t("feature-4-title"),
            body: t("feature-4-description"),
            bullets: [1, 2, 3].map((index) => t(`row-3-bullet-${index}`)),
            media: <FunnelVignette tone={FAMILY.funnel} />,
            tone: FAMILY.funnel,
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
            visual: <MemoryVignette tone={FAMILY.intelligence} />,
            featured: true,
            tone: FAMILY.intelligence,
          },
          {
            title: t("feature-1-title"),
            body: t("feature-1-description"),
            visual: (
              <IconChip tone={FAMILY.connection}>
                <NiPlug />
              </IconChip>
            ),
            tone: FAMILY.connection,
          },
          {
            title: t("feature-5-title"),
            body: t("feature-5-description"),
            visual: (
              <IconChip tone={FAMILY.intelligence}>
                <NiAi />
              </IconChip>
            ),
            tone: FAMILY.intelligence,
          },
          {
            title: t("feature-6-title"),
            body: t("feature-6-description"),
            visual: (
              <IconChip tone={FAMILY.funnel}>
                <NiChartLine />
              </IconChip>
            ),
            tone: FAMILY.funnel,
          },
          {
            title: t("bento-readonly-title"),
            body: t("bento-readonly-body"),
            visual: (
              <IconChip tone={FAMILY.diagnosis}>
                <NiShieldCheck />
              </IconChip>
            ),
            tone: FAMILY.diagnosis,
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
