/**
 * Local draft of an unsaved new product.
 *
 * Why this exists: when a save fails (a dropped connection, or a stale client
 * bundle whose action id 404s against a newer deployment) the only honest
 * advice is "reload the page" — and reloading used to throw away a long,
 * carefully typed product context. The advice cost the user their work.
 *
 * Deliberately NOT a sync feature: it is a crash pad for one browser, holding
 * only what the user typed and has not managed to save yet. It is cleared the
 * moment the product is saved for real.
 *
 * Pure over an injected storage so the expiry and corruption rules are testable
 * without a browser (see scripts/test-product-draft.mts).
 */

/** The minimal storage surface used — `window.localStorage` satisfies it. */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Draft<T> {
  values: T;
  /** Epoch ms. Drives expiry, and the "restored from <when>" message. */
  savedAt: number;
}

/**
 * A draft older than this is not offered. A month-old abandoned form
 * reappearing over a fresh start is a nasty surprise, and its contents are
 * probably stale anyway.
 */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Namespaced per org: two orgs on one browser must never see each other's draft. */
export const draftKey = (orgId: string) => `seenaly:product-draft:${orgId}`;

export function saveDraft<T>(storage: DraftStorage, orgId: string, values: T, now = Date.now()): void {
  try {
    storage.setItem(draftKey(orgId), JSON.stringify({ values, savedAt: now } satisfies Draft<T>));
  } catch {
    // Quota exceeded, or storage disabled (private mode, blocked cookies).
    // A draft is a convenience — never let it break the form it protects.
  }
}

/**
 * Read a usable draft, or null. Returns null for anything suspect — missing,
 * unparseable, wrong shape, or expired — because a half-restored form is worse
 * than an empty one.
 */
export function loadDraft<T>(storage: DraftStorage, orgId: string, now = Date.now()): Draft<T> | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(draftKey(orgId));
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearDraft(storage, orgId);
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const draft = parsed as Partial<Draft<T>>;
  if (typeof draft.savedAt !== "number" || !Number.isFinite(draft.savedAt)) return null;
  if (draft.values === undefined || draft.values === null || typeof draft.values !== "object") return null;

  // A clock that moved backwards (timezone change, manual set) must not make a
  // draft immortal or instantly dead — treat the future as "just now".
  const age = now - draft.savedAt;
  if (age > DRAFT_MAX_AGE_MS) {
    clearDraft(storage, orgId);
    return null;
  }

  return { values: draft.values as T, savedAt: draft.savedAt };
}

export function clearDraft(storage: DraftStorage, orgId: string): void {
  try {
    storage.removeItem(draftKey(orgId));
  } catch {
    // Same reasoning as saveDraft: never throw out of a cleanup path.
  }
}

/**
 * Is there anything worth saving? An untouched form must not create a draft —
 * otherwise every visit to /products/new leaves a crumb and greets the next
 * visit with a "draft restored" banner about nothing.
 */
export function isWorthSaving(values: Record<string, unknown>, meaningfulKeys: string[]): boolean {
  return meaningfulKeys.some((key) => {
    const value = values[key];
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== "";
  });
}
