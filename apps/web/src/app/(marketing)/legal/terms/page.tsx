import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import Prose from "@/components/marketing/prose";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing");
  return { title: t("terms-meta-title") };
}

/**
 * Placeholder terms — NOT legal advice. Derived projects must replace the
 * copy (marketing namespace, terms-* keys) with text reviewed by counsel;
 * versioned acceptance can be wired to packages/audit consent terms.
 */
export default async function TermsPage() {
  const t = await getTranslations("marketing");

  return (
    <Section spacing="compact">
      <SectionHeader title={t("terms-title")} subtitle={t("legal-updated")} align="start" className="mx-0" as="h1" />
      <Prose className="mx-0">
        {[1, 2, 3, 4].map((index) => (
          <section key={index}>
            <h2>{t(`terms-${index}-title`)}</h2>
            <p>{t(`terms-${index}-body`)}</p>
          </section>
        ))}
      </Prose>
    </Section>
  );
}
