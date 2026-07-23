"use client";

import { CreativesExperience } from "../../../creatives/experience";
import { useParams } from "next/navigation";

export default function ProductCreativesPage() {
  const { id } = useParams<{ id: string }>();
  return <CreativesExperience forcedProductId={id} workspace />;
}
