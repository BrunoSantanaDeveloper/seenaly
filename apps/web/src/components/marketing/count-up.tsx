"use client";
import { useRef } from "react";

import { gsap, tokenSeconds, useGSAP } from "@/components/marketing/motion";
import { cn } from "@/lib/utils";

/**
 * Counts a PRE-FORMATTED number up on scroll entry ("R$ 2,1M", "99,9%",
 * "1.200+", "12x") while staying SSR-safe: the final string is what the
 * server renders (SEO, no-JS, reduced-motion all see the real value), and the
 * animation only rewrites the inner aria-hidden span. Values without a
 * parseable number render statically — never a crash, never a wrong number.
 */
type Parsed = {
  prefix: string;
  suffix: string;
  target: number;
  decimals: number;
  decimalChar: string;
  groupChar: string;
};

function parseFormatted(value: string): Parsed | null {
  const match = value.match(/^([^\d]*)(\d[\d.,\s]*\d|\d)(.*)$/);
  if (!match) return null;
  const [, prefix, numeric, suffix] = match;

  // The LAST . or , is the decimal separator iff followed by 1–2 digits;
  // a separator followed by exactly 3 digits is grouping ("1.200" vs "2,1").
  const lastSep = Math.max(numeric.lastIndexOf(","), numeric.lastIndexOf("."));
  let decimals = 0;
  let decimalChar = "";
  if (lastSep !== -1) {
    const after = numeric.slice(lastSep + 1);
    if (/^\d{1,2}$/.test(after)) {
      decimals = after.length;
      decimalChar = numeric[lastSep];
    }
  }

  let groupChar = "";
  const space = numeric.match(/[\s]/);
  if (space) groupChar = space[0];
  for (let i = 0; i < numeric.length; i++) {
    const char = numeric[i];
    if ((char === "." || char === ",") && !(i === lastSep && decimalChar)) {
      groupChar = char;
      break;
    }
  }

  const digits = decimalChar
    ? `${numeric.slice(0, lastSep).replace(/\D/g, "")}.${numeric.slice(lastSep + 1).replace(/\D/g, "")}`
    : numeric.replace(/\D/g, "");
  const target = parseFloat(digits);
  if (Number.isNaN(target)) return null;

  return { prefix, suffix, target, decimals, decimalChar, groupChar };
}

function formatNumber(current: number, parsed: Parsed): string {
  const fixed = current.toFixed(parsed.decimals);
  const [integer, fraction] = fixed.split(".");
  const grouped = parsed.groupChar ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, parsed.groupChar) : integer;
  return parsed.prefix + (fraction ? grouped + parsed.decimalChar + fraction : grouped) + parsed.suffix;
}

export default function CountUp({
  value,
  duration,
  className,
}: {
  /** The final string, pre-formatted for the active locale. */
  value: string;
  /** Seconds. Default: --motion-duration-4 token. */
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) return;
      const parsed = parseFormatted(value);
      if (!parsed) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        element.textContent = formatNumber(0, parsed);
        const counter = { current: 0 };
        gsap.to(counter, {
          current: parsed.target,
          duration: duration ?? tokenSeconds("--motion-duration-4", 1.6),
          ease: "power2.out",
          scrollTrigger: { trigger: element, start: "top 85%", once: true },
          onUpdate: () => {
            element.textContent = formatNumber(counter.current, parsed);
          },
          // Land on the exact original string (rounding drift is not allowed).
          onComplete: () => {
            element.textContent = value;
          },
        });
      });
    },
    { scope: ref, dependencies: [value] },
  );

  return (
    <span className={cn("tabular-nums", className)} aria-label={value}>
      <span aria-hidden ref={ref}>
        {value}
      </span>
    </span>
  );
}
