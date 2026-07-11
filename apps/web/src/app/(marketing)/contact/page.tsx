import ContactForm from "./contact-form";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing");
  return { title: t("contact-meta-title"), description: t("contact-meta-description") };
}

export default async function ContactPage() {
  const t = await getTranslations("marketing");

  return (
    <Section spacing="compact">
      <SectionHeader title={t("contact-title")} subtitle={t("contact-subtitle")} as="h1" />
      <Reveal>
        <ContactForm />
      </Reveal>
    </Section>
  );
}
