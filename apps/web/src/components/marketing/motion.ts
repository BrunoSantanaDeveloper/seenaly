"use client";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { useGSAP } from "@gsap/react";

/**
 * Central GSAP module for the marketing motion layer. Registers the plugins
 * exactly once and re-exports them so every client motion component (Reveal,
 * Hero, Float, Parallax, CountUp) shares one setup. Import this ONLY from
 * "use client" files — GSAP never runs in admin code (marketing rule).
 */
gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Read a marketing motion token off :root with a fallback (client-only). */
export function readMotionToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Parse a CSS duration token ("800ms" | "6s") into seconds. */
export function tokenSeconds(name: string, fallbackSeconds: number): number {
  const raw = readMotionToken(name, "");
  if (!raw) return fallbackSeconds;
  const value = parseFloat(raw);
  if (Number.isNaN(value)) return fallbackSeconds;
  return raw.endsWith("ms") ? value / 1000 : value;
}

export { gsap, ScrollTrigger, useGSAP };
