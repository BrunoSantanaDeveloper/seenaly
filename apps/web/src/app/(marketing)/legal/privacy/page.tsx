import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import Prose from "@/components/marketing/prose";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing");
  return { title: t("privacy-meta-title") };
}

/**
 * Placeholder privacy policy — NOT legal advice. Derived projects must
 * replace the copy (marketing namespace, privacy-* keys) with text reviewed
 * by counsel (LGPD/GDPR as applicable).
 */
export default async function PrivacyPage() {
  const t = await getTranslations("marketing");

  return (
    <Section spacing="compact">
      <SectionHeader title={t("privacy-title")} subtitle={t("legal-updated")} align="start" className="mx-0" as="h1" />
      <Prose className="mx-0">
        {[1, 2, 3, 4].map((index) => (
          <section key={index}>
            <h2>{t(`privacy-${index}-title`)}</h2>
            <p>{t(`privacy-${index}-body`)}</p>
          </section>
        ))}
      </Prose>
    </Section>
  );
}
