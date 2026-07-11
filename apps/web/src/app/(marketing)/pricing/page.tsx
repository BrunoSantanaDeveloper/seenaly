import { getDisplayPlans } from "../plans";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import Container from "@/components/marketing/container";
import Cta from "@/components/marketing/cta";
import Faq from "@/components/marketing/faq";
import PricingSection from "@/components/marketing/pricing-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing");
  return { title: t("pricing-meta-title"), description: t("pricing-meta-description") };
}

export default async function PricingPage() {
  const [t, plans] = await Promise.all([getTranslations("marketing"), getDisplayPlans()]);

  return (
    <>
      <PricingSection
        eyebrow={t("pricing-eyebrow")}
        title={t("pricing-page-title")}
        subtitle={t("pricing-page-subtitle")}
        plans={plans}
        ctaLabel={t("cta-primary")}
        headingAs="h1"
        decor="glow"
      />

      <Container>
        <p className="text-text-secondary mx-auto max-w-2xl pb-4 text-center text-sm leading-5">{t("pricing-note")}</p>
      </Container>

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
