"use client";

import { FunnelExperience } from "../../../funnel/experience";
import { useParams } from "next/navigation";

export default function ProductFunnelPage() {
  const { id } = useParams<{ id: string }>();
  return <FunnelExperience forcedProductId={id} workspace />;
}
