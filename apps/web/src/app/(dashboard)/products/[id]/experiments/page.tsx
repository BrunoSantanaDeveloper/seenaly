"use client";

import { ExperimentsExperience } from "../../../experiments/experience";
import { useParams } from "next/navigation";

export default function ProductExperimentsPage() {
  const { id } = useParams<{ id: string }>();
  return <ExperimentsExperience forcedProductId={id} workspace />;
}
