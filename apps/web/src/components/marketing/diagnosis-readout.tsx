import { cn } from "@/lib/utils";

/**
 * The product's SIGNATURE evidence, rendered as a mono instrument panel — the
 * fixed recommendation format Seenaly returns (diagnosis + a highlighted signal
 * with evidence bars, then label→value rows, then a confidence chip). This is
 * the hero's product-evidence slot in the committed "Sala de Controle"
 * direction: the readout IS the proof the product works. Token-driven and
 * theme-aware; the copy is real (passed from the marketing i18n namespace),
 * so it is meaningful content, not decoration.
 */
export type ReadoutRow = { label: string; value: string };

// Decorative evidence sparkline behind the signal — the two tallest bars are
// the live focus (primary), the rest quiet grey. Not data, just texture.
const EVIDENCE_BARS = [0.38, 0.52, 0.46, 0.68, 0.6, 0.86, 1];

export default function DiagnosisReadout({
  title,
  signal,
  rows,
  confidenceLabel,
  confidenceValue,
}: {
  title: string;
  /** The one-line diagnosis headline — the highlighted signal. */
  signal: string;
  /** Evidência / Base técnica / Ação / Critério — label→value pairs. */
  rows: ReadoutRow[];
  confidenceLabel: string;
  confidenceValue: string;
}) {
  return (
    <div className="border-grey-100 bg-background-paper shadow-darker-xs w-full rounded-2xl border p-5 font-mono sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-text-secondary text-xs tracking-wider uppercase">{title}</span>
        <span className="bg-primary h-2 w-2 rounded-full" />
      </div>

      {/* Highlighted signal + evidence bars — the one saturated focus */}
      <div className="border-primary/30 bg-primary/5 mb-4 rounded-xl border p-4">
        <div className="mb-3 flex items-start gap-2.5">
          <span className="bg-primary mt-1 h-2.5 w-2.5 flex-none rounded-full" />
          <span className="text-text-primary text-sm leading-5 font-medium">{signal}</span>
        </div>
        <div className="flex h-9 items-end gap-1.5">
          {EVIDENCE_BARS.map((height, index) => (
            <span
              key={index}
              className={cn("flex-1 rounded-sm", index >= EVIDENCE_BARS.length - 2 ? "bg-primary" : "bg-grey-100")}
              style={{ height: `${height * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* Fixed-format rows */}
      <dl className="flex flex-col">
        {rows.map((row) => (
          <div key={row.label} className="border-grey-100 flex items-baseline justify-between gap-4 border-b py-2.5">
            <dt className="text-text-secondary flex-none text-xs tracking-wider uppercase">{row.label}</dt>
            <dd className="text-text-primary text-right text-sm leading-5">{row.value}</dd>
          </div>
        ))}
      </dl>

      {/* Confidence footer */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-text-secondary text-xs tracking-wider uppercase">{confidenceLabel}</span>
        <span className="border-primary/50 text-primary rounded border px-2 py-0.5 text-xs tracking-wider uppercase">
          {confidenceValue}
        </span>
      </div>
    </div>
  );
}
