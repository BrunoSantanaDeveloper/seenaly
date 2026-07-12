import Reveal from "@/components/marketing/reveal";
import Section from "@/components/marketing/section";
import SectionHeader from "@/components/marketing/section-header";
import { TONE, type Tone, toneAt } from "@/components/marketing/tone";
import { cn } from "@/lib/utils";

export type ProcessStep = {
  /** Meaningful icon for this step (icon variant) — the concept at a glance, not decoration. */
  icon?: React.ReactNode;
  /** Mono kicker word for the mono variant (e.g. "read", "cross", "output"). */
  kicker?: string;
  title: string;
  body: string;
  /** Optional concrete output of the step (e.g. label "Deliverable", value "Report + roadmap"). */
  deliverableLabel?: string;
  deliverableValue?: string;
  /** Harmonic hue for this step. Defaults to a rotation across the palette. */
  tone?: Tone;
};

/**
 * A "how it works" sequence: each step is a card with a ghosted ordinal, a
 * themed icon and (optionally) its concrete deliverable — so the reader
 * grasps the flow by scanning icons + numbers, before reading a word.
 * The ordinal is only decorative order; use benefit-led step titles.
 *
 * `variant="mono"` swaps the icon + ghost ordinal for a mono `0N · kicker`
 * label — the instrument/pipeline treatment for data-first directions.
 */
export default function ProcessSteps({
  id,
  eyebrow,
  title,
  subtitle,
  steps,
  variant = "icon",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  steps: ProcessStep[];
  variant?: "icon" | "mono";
}) {
  return (
    <Section id={id} decor="grid">
      <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <Reveal stagger={0.1} className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {steps.map((step, index) => {
          const tone = TONE[step.tone ?? toneAt(index)];
          const ordinal = String(index + 1).padStart(2, "0");
          return (
            <div
              key={step.title}
              className="group border-grey-100 bg-background-paper relative flex flex-col gap-4 overflow-hidden rounded-3xl border p-7"
              style={{ ["--step-tone" as string]: `var(${tone.cssVar})` }}
            >
              {variant === "mono" ? (
                <span className="text-text-secondary font-mono text-sm">
                  {ordinal}
                  {step.kicker && (
                    <>
                      {" · "}
                      <span className={cn("tracking-wider uppercase", tone.text)}>{step.kicker}</span>
                    </>
                  )}
                </span>
              ) : (
                <>
                  {/* Ghosted ordinal — reads as rhythm, not content. */}
                  <span
                    aria-hidden
                    className="font-display text-display-2xl pointer-events-none absolute -top-4 right-3 leading-none font-extrabold opacity-[0.07]"
                    style={{ color: "hsl(var(--step-tone))" }}
                  >
                    {ordinal}
                  </span>

                  {step.icon && (
                    <span
                      className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", tone.softBg, tone.text)}
                    >
                      {step.icon}
                    </span>
                  )}
                </>
              )}

              <div className="flex flex-col gap-2">
                <h3 className="text-text-primary font-heading text-xl font-bold">{step.title}</h3>
                <p className="text-text-secondary leading-6">{step.body}</p>
              </div>

              {step.deliverableValue && (
                <div className="border-grey-100 mt-auto border-t pt-4">
                  {step.deliverableLabel && (
                    <p className={cn("mb-1 text-xs font-semibold tracking-wide uppercase", tone.text)}>
                      {step.deliverableLabel}
                    </p>
                  )}
                  <p className="text-text-primary text-sm leading-5">{step.deliverableValue}</p>
                </div>
              )}
            </div>
          );
        })}
      </Reveal>
    </Section>
  );
}
