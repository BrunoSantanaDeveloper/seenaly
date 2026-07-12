import { cn } from "@/lib/utils";

/**
 * Media escaping the container to one viewport edge — the "vazado" breakout
 * of reference sites. Use inside `<Section bleed className="overflow-x-clip">`
 * (Section's bleed skips the Container; Breakout re-creates the container
 * gutters as grid tracks so the copy column stays aligned with every other
 * section while the media runs through the outer gutter to the screen edge).
 * All track sizes derive from the container tokens — no 100vw, so scrollbar
 * width can never cause horizontal overflow.
 */
const GRID =
  "md:grid md:items-center md:gap-10 md:grid-cols-[minmax(var(--container-px),1fr)_minmax(0,calc(var(--container-max)/2))_minmax(0,calc(var(--container-max)/2))_minmax(var(--container-px),1fr)]";

export default function Breakout({
  side = "right",
  media,
  children,
  className,
}: {
  /** Which viewport edge the media bleeds to. */
  side?: "right" | "left";
  media: React.ReactNode;
  /** The copy column (eyebrow/heading/body/bullets). */
  children: React.ReactNode;
  className?: string;
}) {
  const mediaFrame = (
    <div
      className={cn(
        "border-grey-100 shadow-darker-sm overflow-hidden border",
        side === "right" ? "rounded-l-3xl border-r-0" : "rounded-r-3xl border-l-0",
      )}
    >
      {media}
    </div>
  );

  if (side === "left") {
    return (
      <div className={cn("flex flex-col gap-8", GRID, className)}>
        <div className="md:col-start-1 md:col-end-3 md:row-start-1">{mediaFrame}</div>
        <div className="px-[var(--container-px)] md:col-start-3 md:row-start-1 md:px-0 md:pl-14">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-8", GRID, className)}>
      <div className="px-[var(--container-px)] md:col-start-2 md:row-start-1 md:px-0 md:pr-14">{children}</div>
      <div className="md:col-start-3 md:col-end-5 md:row-start-1">{mediaFrame}</div>
    </div>
  );
}
