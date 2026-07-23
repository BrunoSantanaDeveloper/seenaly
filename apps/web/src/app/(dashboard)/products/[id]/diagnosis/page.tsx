"use client";

import { DiagnosisExperience } from "../../../diagnosis/experience";
import { useParams } from "next/navigation";

export default function ProductDiagnosisPage() {
  const { id } = useParams<{ id: string }>();
  return <DiagnosisExperience forcedProductId={id} workspace />;
}
