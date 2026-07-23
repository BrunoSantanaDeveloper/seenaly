"use client";

import { ExperimentDetailExperience } from "../../../../experiments/[id]/experience";
import { useParams } from "next/navigation";

export default function ProductExperimentDetailPage() {
  const { experimentId } = useParams<{ experimentId: string }>();
  return <ExperimentDetailExperience forcedId={experimentId} workspace />;
}
