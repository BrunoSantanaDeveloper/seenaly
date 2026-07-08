/**
 * Token-driven data visualization that stands in for a product screenshot
 * on DATA products (analytics, growth, finance) — a hero must never ship
 * without product evidence, and for these products "evidence" is a chart.
 * Pure SVG tinted by the theme tokens; the draw-in animation is CSS-only
 * and disabled under prefers-reduced-motion. Replace with a real
 * screenshot inside <ProductFrame> as soon as one exists.
 */
export default function DataVizPlaceholder({ label }: { label?: string }) {
  return (
    <div className="flex aspect-[16/10] w-full flex-col gap-4 p-6 sm:p-8">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        {[0.9, 0.55, 0.7].map((width, index) => (
          <div key={index} className="border-grey-100 flex flex-col gap-2 rounded-xl border p-3">
            <span className="bg-grey-100 h-2 rounded-full" style={{ width: `${width * 60}%` }} />
            <span className="bg-primary/30 h-3.5 rounded-full" style={{ width: `${width * 100}%` }} />
          </div>
        ))}
      </div>

      {/* Area chart */}
      <div className="relative min-h-0 flex-1">
        <svg viewBox="0 0 400 160" preserveAspectRatio="none" className="h-full w-full" aria-label={label} role="img">
          {[32, 64, 96, 128].map((y) => (
            <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="hsl(var(--grey-100))" strokeWidth="1" />
          ))}
          <path
            d="M0 130 C 40 120, 70 90, 110 96 S 180 118, 220 88 S 300 30, 340 42 S 380 30, 400 22 L 400 160 L 0 160 Z"
            fill="url(#dvp-fill)"
          />
          <path
            d="M0 130 C 40 120, 70 90, 110 96 S 180 118, 220 88 S 300 30, 340 42 S 380 30, 400 22"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength={1}
            className="dvp-line"
          />
          <circle cx="340" cy="42" r="4" fill="hsl(var(--primary))" />
          <defs>
            <linearGradient id="dvp-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary) / 0.22)" />
              <stop offset="100%" stopColor="hsl(var(--primary) / 0)" />
            </linearGradient>
          </defs>
        </svg>
        {/* CSS-only draw-in, motion-safe. */}
        <style>{`
          @media (prefers-reduced-motion: no-preference) {
            .dvp-line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: dvp-draw 1.6s var(--motion-ease, ease-out) 0.2s forwards; }
            @keyframes dvp-draw { to { stroke-dashoffset: 0; } }
          }
        `}</style>
      </div>

      {/* Bar row */}
      <div className="flex h-10 items-end gap-1.5">
        {[0.35, 0.5, 0.42, 0.66, 0.58, 0.8, 0.72, 0.9, 0.62, 0.76, 0.88, 1].map((height, index) => (
          <span
            key={index}
            className={index >= 9 ? "bg-primary/60 flex-1 rounded-sm" : "bg-grey-100 flex-1 rounded-sm"}
            style={{ height: `${height * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
