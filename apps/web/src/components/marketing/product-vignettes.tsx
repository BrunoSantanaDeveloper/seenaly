import { TONE, type Tone } from "@/components/marketing/tone";
import { cn } from "@/lib/utils";

/**
 * Token-driven product vignettes — the evidence slot of FeatureRows/BentoGrid
 * when a real screenshot doesn't exist yet. Same visual language as
 * <DataVizPlaceholder> (hairline borders, primary accents, grey wireframe
 * bars) so hero and feature visuals read as one product. All decorative
 * (aria-hidden): the meaning lives in the row copy next to them.
 *
 * Each vignette carries its feature family's harmonic hue (premium bar item
 * 7): pass the SAME `tone` as the row/cell it illustrates so the accent color
 * is consistent between the copy and its evidence. The hue is threaded through
 * a `--vg` CSS variable (defaults to primary, the hero's bold moment).
 * Replace with real screenshots in <ProductFrame> as soon as they exist.
 */

function toneVar(tone?: Tone): React.CSSProperties {
  return { ["--vg" as string]: `var(${TONE[tone ?? "primary"].cssVar})` };
}

function Panel({ tone, className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      style={toneVar(tone)}
      className={cn(
        "border-grey-100 bg-background-paper shadow-darker-xs flex aspect-[4/3] w-full flex-col gap-3 rounded-3xl border p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Ranked daily recommendation list: one highlighted call with evidence bars, quieter items below. */
export function DiagnosisVignette({ tone }: { tone?: Tone }) {
  return (
    <Panel tone={tone}>
      {/* Header: title bar + date chip */}
      <div className="flex items-center justify-between">
        <span className="bg-grey-200 h-2.5 w-1/3 rounded-full" />
        <span className="h-5 w-16 rounded-full bg-[hsl(var(--vg)_/_0.2)]" />
      </div>

      {/* Top recommendation — the one saturated focus */}
      <div className="flex flex-1 flex-col gap-2.5 rounded-2xl border border-[hsl(var(--vg)_/_0.4)] bg-[hsl(var(--vg)_/_0.06)] p-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 flex-none rounded-full bg-[hsl(var(--vg))]" />
          <span className="bg-grey-200 h-2.5 w-3/5 rounded-full" />
        </div>
        <span className="bg-grey-100 h-2 w-full rounded-full" />
        <span className="bg-grey-100 h-2 w-4/5 rounded-full" />
        {/* Evidence mini-bars behind the call */}
        <div className="mt-auto flex h-8 items-end gap-1">
          {[0.4, 0.55, 0.5, 0.7, 0.62, 0.85, 1].map((height, index) => (
            <span
              key={index}
              className={index >= 5 ? "w-3 rounded-sm bg-[hsl(var(--vg)_/_0.6)]" : "bg-grey-100 w-3 rounded-sm"}
              style={{ height: `${height * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* Lower-priority items, quiet */}
      {[0, 1].map((index) => (
        <div key={index} className="border-grey-100 flex items-center gap-2 rounded-2xl border p-3">
          <span className="bg-grey-300 h-2.5 w-2.5 flex-none rounded-full" />
          <span className="bg-grey-100 h-2 w-1/2 rounded-full" />
          <span className="bg-grey-50 ml-auto h-4 w-12 rounded-full" />
        </div>
      ))}
    </Panel>
  );
}

/** Creative fatigue: CTR curve peaking then decaying while frequency climbs; alert ring at the turn. */
export function FatigueVignette({ tone }: { tone?: Tone }) {
  return (
    <Panel tone={tone}>
      {/* Legend chips */}
      <div className="flex items-center gap-5">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-5 rounded-full bg-[hsl(var(--vg))]" />
          <span className="bg-grey-100 h-2 w-10 rounded-full" />
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-grey-200 h-2 w-5 rounded-full" />
          <span className="bg-grey-100 h-2 w-14 rounded-full" />
        </span>
      </div>

      <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="min-h-0 w-full flex-1">
        {[40, 80, 120, 160].map((y) => (
          <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="hsl(var(--grey-100))" strokeWidth="1" />
        ))}
        {/* Frequency climbing (quiet, dashed) */}
        <path
          d="M0 176 C 80 172, 160 160, 240 138 S 360 96, 400 78"
          fill="none"
          stroke="hsl(var(--grey-200))"
          strokeWidth="2"
          strokeDasharray="6 6"
        />
        {/* CTR: healthy plateau, then decay past the alert point */}
        <path
          d="M0 96 C 50 78, 110 62, 170 58 C 210 56, 240 62, 268 78 S 350 148, 400 164"
          fill="none"
          stroke="hsl(var(--vg))"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Alert marker where fatigue starts */}
        <circle cx="252" cy="68" r="10" fill="none" stroke="hsl(var(--vg) / 0.35)" strokeWidth="6" />
        <circle cx="252" cy="68" r="4" fill="hsl(var(--vg))" />
        <line
          x1="252"
          x2="252"
          y1="80"
          y2="196"
          stroke="hsl(var(--vg) / 0.3)"
          strokeWidth="1.5"
          strokeDasharray="4 5"
        />
      </svg>

      {/* Alert card */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-[hsl(var(--vg)_/_0.4)] bg-[hsl(var(--vg)_/_0.06)] p-3">
        <span className="h-2.5 w-2.5 flex-none rounded-full bg-[hsl(var(--vg))]" />
        <span className="bg-grey-200 h-2 w-2/5 rounded-full" />
        <span className="ml-auto h-4 w-14 rounded-full bg-[hsl(var(--vg)_/_0.2)]" />
      </div>
    </Panel>
  );
}

/** Funnel: stage bars narrowing toward checkout; the leaking step highlighted with its lost share. */
export function FunnelVignette({ tone }: { tone?: Tone }) {
  const stages = [
    { width: "100%", leak: false },
    { width: "72%", leak: false },
    { width: "38%", leak: true },
    { width: "31%", leak: false },
  ];

  return (
    <Panel tone={tone} className="justify-between">
      <span className="bg-grey-200 h-2.5 w-1/3 rounded-full" />

      <div className="flex flex-1 flex-col justify-center gap-3 py-2">
        {stages.map((stage, index) => (
          <div key={index} className="flex items-center gap-3">
            <span className="bg-grey-100 h-2 w-10 flex-none rounded-full sm:w-14" />
            <div className="relative h-9 flex-1">
              {/* Lost share behind the leaking step */}
              {stage.leak && (
                <span
                  className="absolute inset-y-0 left-0 rounded-xl border border-dashed border-[hsl(var(--vg)_/_0.4)]"
                  style={{ width: "72%" }}
                />
              )}
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-xl",
                  stage.leak ? "bg-[hsl(var(--vg)_/_0.7)]" : "bg-[hsl(var(--vg)_/_0.15)]",
                )}
                style={{ width: stage.width }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Diagnosis note pinned to the leak */}
      <div className="border-grey-100 flex items-center gap-2.5 rounded-2xl border p-3">
        <span className="h-2.5 w-2.5 flex-none rounded-full bg-[hsl(var(--vg))]" />
        <span className="bg-grey-100 h-2 w-3/5 rounded-full" />
      </div>
    </Panel>
  );
}

/**
 * Experiment memory: the journal of past tests — each row a hypothesis with its
 * verdict chip (refuted entries read quiet/greyed), the latest one recalled in
 * the family hue. Panel-sized so it carries the same visual weight as the other
 * vignettes in a FeatureRows media slot.
 */
export function MemoryVignette({ tone }: { tone?: Tone }) {
  const entries = [
    { active: false, refuted: true },
    { active: false, refuted: false },
    { active: false, refuted: true },
    { active: true, refuted: false },
  ];

  return (
    <Panel tone={tone} className="justify-between">
      {/* Header: journal title + entry counter */}
      <div className="flex items-center justify-between">
        <span className="bg-grey-200 h-2.5 w-1/3 rounded-full" />
        <span className="h-5 w-16 rounded-full bg-[hsl(var(--vg)_/_0.2)]" />
      </div>

      {/* Journal entries — hypothesis + verdict, newest recalled */}
      <div className="flex flex-1 flex-col justify-center gap-2.5 py-2">
        {entries.map((entry, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-3",
              entry.active ? "border-[hsl(var(--vg)_/_0.4)] bg-[hsl(var(--vg)_/_0.06)]" : "border-grey-100",
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 flex-none rounded-full",
                entry.active ? "bg-[hsl(var(--vg))]" : entry.refuted ? "bg-grey-300" : "bg-grey-200",
              )}
            />
            <span className="flex flex-1 flex-col gap-1.5">
              <span
                className={cn(
                  "h-2 rounded-full",
                  entry.active ? "w-3/5 bg-[hsl(var(--vg)_/_0.5)]" : "bg-grey-100 w-1/2",
                )}
              />
              <span className="bg-grey-50 h-1.5 w-4/5 rounded-full" />
            </span>
            {/* Verdict chip */}
            <span
              className={cn(
                "h-4 w-12 flex-none rounded-full",
                entry.active ? "bg-[hsl(var(--vg)_/_0.25)]" : "bg-grey-50",
              )}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}
