import { cn } from "@/lib/utils";

/**
 * Browser chrome that presents REAL product screenshots as the hero visual —
 * the strongest anti-generic move for a SaaS site. Derived projects pass a
 * screenshot via `children` (next/image with explicit sizes + translated alt);
 * without children it renders a token-driven wireframe placeholder, so the
 * template never ships stock photos.
 */
export default function ProductFrame({
  className,
  glow = false,
  children,
}: {
  className?: string;
  /** Primary-tinted halo behind the frame — the expensive-product hero treatment. */
  glow?: boolean;
  children?: React.ReactNode;
}) {
  const frame = (
    <div
      className={cn(
        "border-grey-100 bg-background-paper shadow-darker-xs w-full overflow-hidden rounded-3xl border",
        !glow && className,
      )}
    >
      {/* Chrome bar */}
      <div className="border-grey-100 bg-grey-25 flex h-9 flex-none items-center gap-1.5 border-b px-4">
        <span className="bg-grey-200 h-2.5 w-2.5 rounded-full" />
        <span className="bg-grey-200 h-2.5 w-2.5 rounded-full" />
        <span className="bg-grey-200 h-2.5 w-2.5 rounded-full" />
        <span className="bg-grey-50 mx-auto h-4 w-1/3 rounded-full" />
      </div>

      {children ?? <PlaceholderApp />}
    </div>
  );

  if (!glow) return frame;

  return (
    <div className={cn("relative", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-8 -top-10 -bottom-16"
        style={{
          background: "radial-gradient(ellipse 60% 55% at 50% 45%, hsl(var(--primary) / 0.18), transparent 70%)",
        }}
      />
      <div className="relative">{frame}</div>
    </div>
  );
}

/** Token-driven wireframe standing in for a product screenshot. */
function PlaceholderApp() {
  return (
    <div className="flex aspect-[16/10] w-full">
      {/* Sidebar */}
      <div className="border-grey-100 bg-grey-20 hidden w-1/5 flex-col gap-2 border-r p-4 sm:flex">
        <span className="bg-primary/30 h-3 w-3/4 rounded-full" />
        <span className="bg-grey-100 mt-3 h-2 w-full rounded-full" />
        <span className="bg-grey-100 h-2 w-5/6 rounded-full" />
        <span className="bg-grey-100 h-2 w-full rounded-full" />
        <span className="bg-grey-100 h-2 w-4/6 rounded-full" />
      </div>
      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
        <span className="bg-grey-200 h-3 w-1/3 rounded-full" />
        <div className="grid grid-cols-3 gap-3">
          <span className="bg-primary/10 h-16 rounded-xl" />
          <span className="bg-accent-1/10 h-16 rounded-xl" />
          <span className="bg-accent-2/10 h-16 rounded-xl" />
        </div>
        <div className="from-primary/15 to-primary/0 flex-1 rounded-xl bg-gradient-to-b" />
        <div className="grid grid-cols-2 gap-3">
          <span className="bg-grey-50 h-10 rounded-xl" />
          <span className="bg-grey-50 h-10 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
