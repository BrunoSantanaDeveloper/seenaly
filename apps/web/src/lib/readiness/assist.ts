/**
 * When to offer the paid concierge ("nosso time faz junto com você").
 *
 * The gap this closes: the merchant who is burned by agencies, tries to do it
 * himself, and STILL cannot execute the item even with the step-by-step. Today
 * his only "someone does it for me" exit is "Delegar em 1 minuto", which sends
 * him — and his money — to an outside professional, i.e. back to the exact
 * relationship that burned him. The concierge keeps both inside.
 *
 * The offer is deliberately EARNED, not always-on: it appears only after the
 * user shows real resistance on a specific item. That ordering matters, and it
 * is a product invariant, not a preference:
 *
 *  - offering it up front turns a diagnostic tool into an upsell funnel and
 *    competes with the free path (learn it, do it, prove it) that we want most
 *    users to take;
 *  - it would also violate docs/PRODUCT.md #6 in spirit — value must never sit
 *    behind a paid prerequisite. The concierge is a way OUT of a wall, never
 *    the wall itself.
 *
 * Pure and I/O-free so the trigger is unit-testable: getting this wrong in
 * either direction (nagging, or never appearing) is a product failure.
 */

import { READINESS_ITEM_BY_KEY, READINESS_ITEM_KEYS, type ReadinessItemKey } from "./checklist";

/**
 * The DURABLE half of the resistance signals (U5): "skipped" and "has ever
 * opened the help panel" used to live in component-local state that died on
 * step unmount — the hard-won concierge offer evaporated on a collapse or a
 * reload. Persisted under product_readiness.extra.journey (the jsonb column
 * shipped unused in 0028, reserved exactly for this kind of extension).
 *
 * helpOpened is one-way accumulating BY DESIGN: adding removal would make the
 * "stuck-on-specialist" trigger gameable off.
 */
export interface ReadinessJourneySignals {
  skippedItems: ReadinessItemKey[];
  helpOpenedItems: ReadinessItemKey[];
}

export const EMPTY_JOURNEY_SIGNALS: ReadinessJourneySignals = { skippedItems: [], helpOpenedItems: [] };

/** Never trust the client (or a stale row) shape — same discipline as
 *  sanitizeProfile: filter to known keys, dedupe, cap. */
export function sanitizeJourneySignals(input: unknown): ReadinessJourneySignals {
  const raw = (input ?? {}) as Record<string, unknown>;
  const known = new Set<string>(READINESS_ITEM_KEYS);
  const clean = (value: unknown): ReadinessItemKey[] =>
    Array.isArray(value)
      ? [...new Set(value.filter((key): key is ReadinessItemKey => typeof key === "string" && known.has(key)))].slice(
          0,
          READINESS_ITEM_KEYS.length,
        )
      : [];
  return { skippedItems: clean(raw.skippedItems), helpOpenedItems: clean(raw.helpOpenedItems) };
}

/** Everything we know about how hard this user is struggling with ONE item. */
export interface AssistSignals {
  /** The scan disproves a claim they made — they think it is done, it is not. */
  contradicted: boolean;
  /** They explicitly chose "Pular por agora" on this item. */
  skipped: boolean;
  /** They opened the teaching panel for this item. */
  openedHelp: boolean;
  /**
   * How many times the page has been scanned. Two or more means they had a
   * chance to fix and re-prove it — a second failed proof is real resistance,
   * not a first read.
   */
  scanAttempts: number;
  /** The scan already PROVED it, or the item does not apply to this business. */
  resolved: boolean;
  notApplicable: boolean;
}

/** Why we are offering help — shown to the user, so it never feels random. */
export type AssistReason = "contradicted-after-retry" | "skipped-specialist" | "stuck-on-specialist";

/**
 * Decide whether to offer the concierge for one item, and say why.
 *
 * Returns null far more often than not: silence is the default, and every
 * branch below requires a specific, observed struggle.
 */
export function assistReason(key: ReadinessItemKey, signals: AssistSignals): AssistReason | null {
  // Never sell help for something that is already done or was never theirs to
  // do. Offering either would be noise at best and a scam at worst.
  if (signals.resolved || signals.notApplicable) return null;

  const meta = READINESS_ITEM_BY_KEY[key];
  if (!meta) return null;

  // Strongest signal: they claimed it, the page disproved it, and they have
  // scanned again since. They believe it is done and it measurably is not —
  // exactly the case where a human ends the loop in minutes.
  if (signals.contradicted && signals.scanAttempts >= 2) return "contradicted-after-retry";

  // Only items that normally need a professional qualify from here on. For a
  // DIY item ("add testimonials to the page") selling a service would be
  // predatory — the teaching panel is the honest answer.
  if (meta.difficulty !== "specialist") return null;

  // They read what it is and chose to skip anyway: they know they cannot do it.
  if (signals.skipped) return "skipped-specialist";

  // They opened the explanation, scanned at least once, and it is still not
  // proved — the teaching did not get them there.
  if (signals.openedHelp && signals.scanAttempts >= 1 && meta.verification === "proved") {
    return "stuck-on-specialist";
  }

  return null;
}
