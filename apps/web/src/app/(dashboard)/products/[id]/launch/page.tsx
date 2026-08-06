"use client";

import { LaunchExperience } from "../../../launch/experience";
import { useParams } from "next/navigation";

export default function ProductLaunchPage() {
  const { id } = useParams<{ id: string }>();
  return <LaunchExperience forcedProductId={id} workspace />;
}
