/**
 * Fetches a product's page for the readiness scanner (docs/PRODUCT.md phase 7,
 * fase B). Server-only: imports node:dns.
 *
 * SECURITY — this performs a server-side fetch of a URL supplied by a tenant,
 * which is textbook SSRF territory. Without guards, a tenant could point us at
 * `http://169.254.169.254/` and read the cloud metadata endpoint, or at any
 * service reachable from our network but not from theirs. The guards below are
 * the point of this module, not an afterthought:
 *
 *   1. http/https only — no file:, gopher:, data:, ftp:
 *   2. default ports only — no probing 6379, 5432, 8080…
 *   3. the hostname is DNS-resolved and EVERY resolved address must be public
 *      (loopback, private, link-local, CGNAT, multicast and IPv4-mapped IPv6
 *      are all rejected)
 *   4. redirects are followed MANUALLY and every hop is re-validated — a public
 *      host that 302s to 127.0.0.1 is the classic bypass
 *   5. hard timeout and a byte cap, so a slow or endless response cannot pin a
 *      server action open
 *
 * Residual risk, stated rather than hidden: DNS rebinding (the name resolving
 * to a public IP for our check and a private one for the actual connection) is
 * NOT fully closed — doing so requires pinning the connection to the validated
 * IP, which breaks TLS SNI for https. The window is narrow and the payoff is
 * limited to a blind fetch whose body we only parse for meta tags, so this is
 * an accepted trade-off; revisit if the scanner ever returns raw bodies.
 */

import { analyzeScan, type ScanSignals } from "./scan-analyze";
import { lookup } from "node:dns/promises";

/** Total budget for the main document. */
const FETCH_TIMEOUT_MS = 8000;
/** Shorter budget for the auxiliary robots.txt / sitemap.xml probes. */
const AUX_TIMEOUT_MS = 5000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "SeenalyReadinessBot/1.0 (+https://seenaly.com; structural readiness check)";

export interface ScanOutcome {
  requestedUrl: string;
  finalUrl: string | null;
  ok: boolean;
  statusCode: number | null;
  /** Stable slug the UI translates; null when the scan succeeded. */
  error: ScanError | null;
  signals: ScanSignals | null;
}

export type ScanError =
  | "invalid-url"
  | "blocked-scheme"
  | "blocked-port"
  | "blocked-address"
  | "dns-failed"
  | "too-many-redirects"
  | "timeout"
  | "unreachable"
  | "http-error"
  | "not-html";

/* -------------------------------------------------------------------------- */
/*  Address validation                                                        */
/* -------------------------------------------------------------------------- */

function ipv4IsPrivate(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local — cloud metadata lives here
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved
  return false;
}

/** Rejects loopback, private, link-local and IPv4-mapped-private addresses. */
export function isBlockedAddress(address: string): boolean {
  const ip = address
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  if (!ip) return true;

  if (ip.includes(":")) {
    if (ip === "::" || ip === "::1") return true;
    // ::ffff:127.0.0.1 — the embedded v4 is what actually gets contacted.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
    if (mapped) return ipv4IsPrivate(mapped[1]);
    const head = ip.split(":")[0];
    if (/^f[cd][0-9a-f]{2}$/.test(head)) return true; // fc00::/7 unique-local
    if (/^fe[89ab][0-9a-f]$/.test(head)) return true; // fe80::/10 link-local
    return false;
  }
  return ipv4IsPrivate(ip);
}

/**
 * Validate a URL and prove its hostname resolves only to public addresses.
 * Returns the error slug, or null when the URL is safe to fetch.
 */
async function validateUrl(raw: string): Promise<ScanError | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "invalid-url";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "blocked-scheme";
  if (url.port && url.port !== "80" && url.port !== "443") return "blocked-port";

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  // An IP literal skips DNS entirely — check it directly.
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) {
    return isBlockedAddress(hostname) ? "blocked-address" : null;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    return "dns-failed";
  }
  if (addresses.length === 0) return "dns-failed";
  // EVERY address must be public: one private entry is enough to be abused.
  if (addresses.some((entry) => isBlockedAddress(entry.address))) return "blocked-address";
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Fetching                                                                  */
/* -------------------------------------------------------------------------- */

async function readCapped(response: Response): Promise<{ text: string; bytes: number }> {
  const reader = response.body?.getReader();
  if (!reader) return { text: "", bytes: 0 };
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (bytes < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      bytes += value.byteLength;
    }
  }
  // Stop the transfer once the cap is hit — we have all we need from <head>.
  await reader.cancel().catch(() => {});
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    if (offset + chunk.byteLength > bytes) break;
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(merged), bytes };
}

interface HopResult {
  response: Response;
  finalUrl: string;
}

/**
 * Follow redirects by hand so every hop is address-validated.
 *
 * The abort signal is OWNED BY THE CALLER and must stay armed until the body
 * has been read: clearing it when `fetch` resolves would leave the body read
 * unbounded, and a server that dribbles bytes forever would pin this action
 * open. The deadline therefore covers connect + redirects + body.
 */
async function fetchValidated(startUrl: string, signal: AbortSignal): Promise<HopResult | ScanError> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const invalid = await validateUrl(current);
    if (invalid) return invalid;
    if (signal.aborted) return "timeout";

    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8" },
        cache: "no-store",
      });
    } catch (error) {
      return (error as Error)?.name === "AbortError" ? "timeout" : "unreachable";
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, finalUrl: current };
      // Relative Location headers are legal — resolve against the current URL.
      try {
        current = new URL(location, current).toString();
      } catch {
        return "invalid-url";
      }
      await response.body?.cancel().catch(() => {});
      continue;
    }
    return { response, finalUrl: current };
  }
  return "too-many-redirects";
}

/** Run an operation under a hard deadline that also covers the body read. */
async function withDeadline<T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Auxiliary probe (robots.txt / sitemap.xml). Never throws. */
async function probe(url: string): Promise<{ status: "found" | "missing" | "error"; body: string | null }> {
  return withDeadline(AUX_TIMEOUT_MS, async (signal) => {
    const result = await fetchValidated(url, signal);
    if (typeof result === "string") return { status: "error" as const, body: null };
    if (!result.response.ok) {
      await result.response.body?.cancel().catch(() => {});
      return { status: "missing" as const, body: null };
    }
    try {
      const { text } = await readCapped(result.response);
      return { status: "found" as const, body: text };
    } catch {
      // Aborted mid-body: we know it exists but cannot trust what we read.
      return { status: "error" as const, body: null };
    }
  });
}

/**
 * Scan a product's page. Never throws: a failure is a persisted outcome the
 * engine reasons about, not an exception that loses the attempt.
 */
export async function scanSite(rawUrl: string): Promise<ScanOutcome> {
  const requestedUrl = rawUrl.trim();
  const withScheme = /^https?:\/\//i.test(requestedUrl) ? requestedUrl : `https://${requestedUrl}`;

  const started = Date.now();
  // One deadline for connect + redirects + body. Nothing here may outlive it.
  const document = await withDeadline(FETCH_TIMEOUT_MS, async (signal): Promise<ScanOutcome | HopResult> => {
    const result = await fetchValidated(withScheme, signal);
    if (typeof result === "string") {
      return { requestedUrl, finalUrl: null, ok: false, statusCode: null, error: result, signals: null };
    }
    return result;
  });
  if ("ok" in document) return document;

  const { response, finalUrl } = document;

  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    return { requestedUrl, finalUrl, ok: false, statusCode: response.status, error: "http-error", signals: null };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml/i.test(contentType)) {
    await response.body?.cancel().catch(() => {});
    return { requestedUrl, finalUrl, ok: false, statusCode: response.status, error: "not-html", signals: null };
  }

  let html: string;
  let bytes: number;
  try {
    // A second deadline for the body: the connect budget is already spent, and
    // an unbounded read is exactly how a slow server pins a server action open.
    ({ text: html, bytes } = await withDeadline(FETCH_TIMEOUT_MS, async (signal) => {
      const onAbort = () => response.body?.cancel().catch(() => {});
      signal.addEventListener("abort", onAbort, { once: true });
      try {
        return await readCapped(response);
      } finally {
        signal.removeEventListener("abort", onAbort);
      }
    }));
  } catch {
    return { requestedUrl, finalUrl, ok: false, statusCode: response.status, error: "timeout", signals: null };
  }
  const fetchMs = Date.now() - started;

  // Discovery probes run against the FINAL origin — after a www/apex or
  // http→https redirect, the original origin is not where the site lives.
  const origin = new URL(finalUrl).origin;
  const [robotsTxt, sitemapProbe] = await Promise.all([probe(`${origin}/robots.txt`), probe(`${origin}/sitemap.xml`)]);

  return {
    requestedUrl,
    finalUrl,
    ok: true,
    statusCode: response.status,
    error: null,
    signals: analyzeScan({
      html,
      finalUrl,
      bytes,
      fetchMs,
      robotsTxt,
      sitemapXml: sitemapProbe.status,
    }),
  };
}
