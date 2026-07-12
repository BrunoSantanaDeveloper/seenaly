import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * A REAL product screenshot pair (light + dark) from public/images/marketing,
 * captured by `npm run shots:marketing -w @flyee/web` (see scripts/
 * marketing-shots.mjs). The dark variant is the same basename with a `-dark`
 * suffix; the swap is class-driven (`dark:` follows the ThemeProvider via
 * @custom-variant). Give `priority` ONLY to the above-the-fold shot, and
 * always pass `sizes` so next/image serves a sensibly sized webp/avif.
 * Derived projects re-run the capture script after branding — same names,
 * nothing else changes.
 */
export default function ProductShot({
  name,
  alt,
  width = 2880,
  height = 1800,
  priority = false,
  sizes,
  className,
}: {
  /** Basename under /images/marketing (e.g. "dashboard-analytics"). */
  name: string;
  /** Translated alt text (marketing i18n namespace). */
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes: string;
  className?: string;
}) {
  return (
    <>
      <Image
        src={`/images/marketing/${name}.png`}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        className={cn("h-auto w-full dark:hidden", className)}
      />
      <Image
        src={`/images/marketing/${name}-dark.png`}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        className={cn("hidden h-auto w-full dark:block", className)}
      />
    </>
  );
}
