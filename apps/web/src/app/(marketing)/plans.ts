import { getLocale, getTranslations } from "next-intl/server";

import { PublicPlanDisplay } from "@/components/marketing/pricing-section";
import { type Tone } from "@/components/marketing/tone";
import { listPublicPlans } from "@flyee/billing/public";

const PLACEHOLDER_SLUGS = ["plan-1", "plan-2", "plan-3"] as const;

/**
 * Harmonic hue per plan tier by position (premium bar item 7): a distinct
 * trio so the three tiers read apart, with the middle anchor in the
 * differentiator hue. Primary stays reserved for the highlighted plan's
 * border + CTA. Extra tiers (>3) fall back to the component's rotation.
 */
const TIER_TONES: Tone[] = ["accent-1", "secondary", "accent-4"];

/**
 * Display-ready plans for the public pricing sections: real rows from
 * packages/billing formatted for the active locale, or the i18n placeholder
 * plans when the database is not configured (fresh clone stays browsable).
 */
export async function getDisplayPlans(): Promise<PublicPlanDisplay[]> {
  const [t, locale, plans] = await Promise.all([getTranslations("marketing"), getLocale(), listPublicPlans()]);

  if (!plans || plans.length === 0) {
    return PLACEHOLDER_SLUGS.map((slug, index) => ({
      slug,
      name: t(`${slug}-name`),
      description: t(`${slug}-description`),
      price: t(`${slug}-price`),
      period: t(`${slug}-period`),
      features: [t(`${slug}-feature-1`), t(`${slug}-feature-2`), t(`${slug}-feature-3`)],
      highlighted: slug === "plan-2",
      tone: TIER_TONES[index],
    }));
  }

  // Highlight the middle plan — the conventional anchor of a 3-tier grid.
  const highlightIndex = plans.length >= 3 ? 1 : -1;

  return plans.map((plan, index) => {
    const features: string[] = [];
    if (plan.kind === "credits" && plan.creditAmount) {
      features.push(t("pricing-feature-credits", { count: plan.creditAmount }));
    }
    if (typeof plan.limits.members === "number") {
      features.push(t("pricing-feature-members", { count: plan.limits.members }));
    }
    if (plan.trialDays > 0) {
      features.push(t("pricing-feature-trial", { days: plan.trialDays }));
    }

    return {
      slug: plan.slug,
      name: plan.name,
      description: plan.description ?? undefined,
      price: plan.isFree
        ? t("pricing-free")
        : new Intl.NumberFormat(locale, {
            style: "currency",
            currency: plan.currency,
            maximumFractionDigits: 0,
          }).format(plan.priceCents / 100),
      period: plan.kind === "recurring" && plan.period && !plan.isFree ? t(`pricing-period-${plan.period}`) : undefined,
      features,
      highlighted: index === highlightIndex,
      tone: TIER_TONES[index],
    };
  });
}
