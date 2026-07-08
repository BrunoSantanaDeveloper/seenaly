"use client";
import { Accordion, AccordionDetails, AccordionSummary, Typography } from "@mui/material";

import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";

export type FaqItem = { question: string; answer: string };

/**
 * Funnel stage: objection handling. Each question should be a REAL purchase
 * objection (price, migration, security, lock-in), answered plainly.
 */
export default function Faq({ eyebrow, title, items }: { eyebrow?: string; title: string; items: FaqItem[] }) {
  return (
    <Section>
      <SectionHeader eyebrow={eyebrow} title={title} />
      <Reveal className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        {items.map((item) => (
          <Accordion
            key={item.question}
            elevation={0}
            disableGutters
            className="border-grey-100 bg-background-paper rounded-2xl! border"
          >
            <AccordionSummary expandIcon={<NiChevronDownSmall />} className="px-6! py-4!">
              <Typography component="h3" variant="subtitle1">
                {item.question}
              </Typography>
            </AccordionSummary>
            <AccordionDetails className="px-6! pt-0! pb-6!">
              <Typography variant="body1" className="text-text-secondary leading-6">
                {item.answer}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Reveal>
    </Section>
  );
}
