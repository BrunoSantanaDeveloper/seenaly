import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must be taught the marketing display scale (`text-display-*`,
 * defined in tailwind.config + @flyee/design-tokens/css/marketing.css).
 * Without this it classifies `text-display-2xl` as a TEXT COLOR, sees it
 * conflict with a real color like `text-primary`, and silently DROPS the size —
 * so any token-sized heading built through cn() (StatBand numbers, tone-colored
 * headings) renders at base size. Keep this list in sync with the scale.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display-2xl", "display-xl", "display-lg", "display-md"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isPathMatch = (pathname: string, href: string): boolean => {
  const cleanPath = pathname.replace(/\/$/, "");
  const cleanHref = href.replace(/\/$/, "");

  if (cleanPath === cleanHref) return true;

  if (!cleanPath.startsWith(cleanHref)) return false;

  const pathParts = cleanPath.split("/");
  const menuParts = cleanHref.split("/");

  return pathParts.slice(0, menuParts.length).join("/") === cleanHref;
};
