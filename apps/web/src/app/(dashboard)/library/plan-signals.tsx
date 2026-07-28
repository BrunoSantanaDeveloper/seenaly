"use client";

import { useOrganization } from "../settings/organization/components/use-organization";
import { useTranslations } from "next-intl";
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from "react";

import { Typography } from "@mui/material";

import { isCreativePlanOutput } from "@/lib/creative-plan/schema";
import { createClient } from "@flyee/auth/client";
import { MINIMUM_ORGANIC_COHORT_SIZE } from "@flyee/organic-growth";

/**
 * The Creative Test Plan is the connective tissue between the three library
 * surfaces — these one-line signals give each card a live reason ("2 hypotheses
 * await metric import") instead of a generic description. Silence is the
 * default: with no active plan, nothing renders and the static copy stands.
 *
 * Every number is machine-derived (plan links + publication counts) — nothing
 * here is asserted state.
 */

interface PlanSignals {
  totalHypotheses: number;
  covered: number;
  published: number;
  readable: number;
  awaitingImport: number;
}

const PlanSignalsContext = createContext<PlanSignals | null>(null);

export function PlanSignalsProvider({ children }: PropsWithChildren) {
  const { currentOrg } = useOrganization();
  const [signals, setSignals] = useState<PlanSignals | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const { data: planRows, error } = await supabase
        .from("diagnoses")
        .select("id, product_id, output, created_at")
        .eq("org_id", currentOrg.id)
        .eq("scope", "creative_plan")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error || cancelled) return;

      // The active plan is the LATEST per product; older ones are superseded.
      const activeByProduct = new Map<string, { id: string; hypotheses: number }>();
      for (const row of (planRows ?? []) as { id: string; product_id: string; output: unknown }[]) {
        if (activeByProduct.has(row.product_id)) continue;
        if (!isCreativePlanOutput(row.output)) continue;
        activeByProduct.set(row.product_id, { id: row.id, hypotheses: row.output.hypotheses.length });
      }
      const planIds = [...activeByProduct.values()].map((plan) => plan.id);
      const totalHypotheses = [...activeByProduct.values()].reduce((sum, plan) => sum + plan.hypotheses, 0);
      if (planIds.length === 0) {
        if (!cancelled) setSignals(null);
        return;
      }

      const { data: links } = await supabase
        .from("creative_plan_links")
        .select("creative_id")
        .in("diagnosis_id", planIds);
      const creativeIds = ((links ?? []) as { creative_id: string }[]).map((link) => link.creative_id);

      const counts = new Map<string, number>();
      if (creativeIds.length > 0) {
        const { data: publications } = await supabase
          .from("organic_content_items")
          .select("creative_id")
          .in("creative_id", creativeIds)
          .limit(1000);
        for (const publication of (publications ?? []) as { creative_id: string | null }[]) {
          if (!publication.creative_id) continue;
          counts.set(publication.creative_id, (counts.get(publication.creative_id) ?? 0) + 1);
        }
      }
      const published = creativeIds.filter((id) => (counts.get(id) ?? 0) > 0).length;
      const readable = creativeIds.filter((id) => (counts.get(id) ?? 0) >= MINIMUM_ORGANIC_COHORT_SIZE).length;
      if (!cancelled) {
        setSignals({
          totalHypotheses,
          covered: creativeIds.length,
          published,
          readable,
          awaitingImport: creativeIds.length - published,
        });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentOrg]);

  return <PlanSignalsContext.Provider value={signals}>{children}</PlanSignalsContext.Provider>;
}

/**
 * One live line under a library card. Renders nothing without an active plan —
 * a signal with nothing to say must not add noise.
 */
export function PlanSignal({ kind }: { kind: "creatives" | "organic" | "reviews" }) {
  const t = useTranslations("library");
  const signals = useContext(PlanSignalsContext);
  if (!signals || signals.totalHypotheses === 0) return null;

  let text: string | null = null;
  if (kind === "creatives") {
    text = t("plan-signal-creatives", {
      covered: signals.covered,
      total: signals.totalHypotheses,
      readable: signals.readable,
    });
  } else if (kind === "organic" && signals.awaitingImport > 0) {
    text = t("plan-signal-organic", { count: signals.awaitingImport });
  } else if (kind === "reviews" && signals.readable > 0) {
    text = t("plan-signal-reviews", { count: signals.readable });
  }
  if (!text) return null;

  return (
    <Typography variant="body2" className="text-primary">
      {text}
    </Typography>
  );
}
