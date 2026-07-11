import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import Cta from "@/components/marketing/cta";
import FeatureGrid from "@/components/marketing/feature-grid";
import Prose from "@/components/marketing/prose";
import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import NiHearts from "@/icons/nexture/ni-hearts";
import NiShieldCheck from "@/icons/nexture/ni-shield-check";
import NiUsers from "@/icons/nexture/ni-users";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing");
  return { title: t("about-meta-title"), description: t("about-meta-description") };
}

const VALUE_ICONS = [<NiUsers key="users" />, <NiShieldCheck key="shield" />, <NiHearts key="hearts" />];

export default async function AboutPage() {
  const t = await getTranslations("marketing");

  return (
    <>
      <Section decor="glow">
        <SectionHeader eyebrow={t("about-eyebrow")} title={t("about-title")} subtitle={t("about-subtitle")} as="h1" />
        <Reveal>
          <Prose>
            <p>{t("about-story-p1")}</p>
            <p>{t("about-story-p2")}</p>
          </Prose>
        </Reveal>
      </Section>

      <FeatureGrid
        eyebrow={t("about-values-eyebrow")}
        title={t("about-values-title")}
        features={VALUE_ICONS.map((icon, index) => ({
          icon,
          title: t(`about-value-${index + 1}-title`),
          description: t(`about-value-${index + 1}-description`),
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
