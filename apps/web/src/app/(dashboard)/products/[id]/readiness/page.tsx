"use client";

import { ReadinessExperience } from "../../../readiness/experience";
import { useParams } from "next/navigation";

export default function ProductReadinessPage() {
  const { id } = useParams<{ id: string }>();
  return <ReadinessExperience forcedProductId={id} workspace />;
}
