/**
 * Extracts readiness signals from a fetched page (docs/PRODUCT.md phase 7,
 * fase B). Pure — no network, no I/O — so every rule is unit-testable.
 *
 * These are OBSERVED facts, the counterpart to the user's DECLARED checklist.
 * Where the two disagree ("I confirmed the site is indexable" vs. a `noindex`
 * meta tag) the disagreement is itself the most valuable finding, which is why
 * the scan never writes into the checklist.
 *
 * Deliberate limitation, surfaced rather than hidden: we read the RAW HTML the
 * server returns. A client-rendered page (SPA) injects its tags after JS runs,
 * so "not detected" there means "not in the initial HTML" — which matters for
 * crawlers too, but is NOT the same as "absent". `jsRenderedLikely` flags it so
 * neither the engine nor the UI states absence as fact.
 */

export interface ScanSeo {
  title: string | null;
  titleLength: number | null;
  metaDescription: string | null;
  metaDescriptionLength: number | null;
  canonical: string | null;
  lang: string | null;
  hasViewport: boolean;
  h1Count: number;
  firstH1: string | null;
  ogTitle: boolean;
  ogDescription: boolean;
  ogImage: boolean;
  /** @type values found in JSON-LD blocks. */
  structuredDataTypes: string[];
  /** A `noindex` directive — silently removes the page from search. */
  noindex: boolean;
  imagesTotal: number;
  imagesMissingAlt: number;
}

export interface ScanDiscovery {
  robotsTxt: "found" | "missing" | "error";
  /** robots.txt blocks every crawler — catastrophic for organic, easy to miss. */
  robotsDisallowsAll: boolean;
  sitemapReferencedInRobots: boolean;
  sitemapXml: "found" | "missing" | "error";
}

export interface ScanTracking {
  metaPixel: boolean;
  ga4: boolean;
  gtm: boolean;
  tiktokPixel: boolean;
}

export interface ScanSignals {
  seo: ScanSeo;
  discovery: ScanDiscovery;
  tracking: ScanTracking;
  https: boolean;
  /** Little server-rendered text — tags may be injected client-side. */
  jsRenderedLikely: boolean;
  visibleTextLength: number;
  bytes: number;
  /** Wall-clock of OUR fetch. Not Core Web Vitals — see scanTimingCaveat. */
  fetchMs: number | null;
}

/* -------------------------------------------------------------------------- */
/*  HTML helpers                                                              */
/* -------------------------------------------------------------------------- */

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => ENTITIES[match] ?? match);
}

/** Attribute value from a single tag, quoted or bare. */
function attr(tag: string, name: string): string | null {
  const quoted = new RegExp(`\\b${escapeRe(name)}\\s*=\\s*"([^"]*)"|\\b${escapeRe(name)}\\s*=\\s*'([^']*)'`, "i").exec(
    tag,
  );
  if (quoted) return decodeEntities((quoted[1] ?? quoted[2] ?? "").trim());
  const bare = new RegExp(`\\b${escapeRe(name)}\\s*=\\s*([^\\s>]+)`, "i").exec(tag);
  return bare ? decodeEntities(bare[1].trim()) : null;
}

/**
 * `content` of the first <meta> whose `name`/`property` matches. Scans tags
 * rather than one big regex so attribute ORDER never matters — `<meta content=
 * "..." name="description">` is legal and common enough to break naive regexes.
 */
function metaContent(html: string, key: "name" | "property", value: string): string | null {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if (attr(tag, key)?.toLowerCase() === value.toLowerCase()) return attr(tag, "content");
  }
  return null;
}

/** Strip <svg>/<script>/<style> so their contents never pollute text or title. */
function stripNoise(html: string): string {
  return html
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function jsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1].trim());
    } catch {
      // Malformed JSON-LD is common and is itself worth noticing, but it must
      // never abort the whole scan.
      types.add("(inválido)");
      continue;
    }
    const visit = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      const type = record["@type"];
      if (typeof type === "string") types.add(type);
      else if (Array.isArray(type)) type.filter((t) => typeof t === "string").forEach((t) => types.add(t as string));
      if (Array.isArray(record["@graph"])) visit(record["@graph"]);
    };
    visit(parsed);
  }
  return [...types];
}

/* -------------------------------------------------------------------------- */
/*  Analysis                                                                  */
/* -------------------------------------------------------------------------- */

export interface AnalyzeInput {
  html: string;
  finalUrl: string;
  bytes: number;
  fetchMs: number | null;
  robotsTxt: { status: "found" | "missing" | "error"; body: string | null };
  sitemapXml: "found" | "missing" | "error";
}

/** Below this much server-rendered text, tags are probably injected by JS. */
const JS_RENDERED_TEXT_THRESHOLD = 250;

export function analyzeScan(input: AnalyzeInput): ScanSignals {
  const { html } = input;
  const clean = stripNoise(html);

  const titleRaw = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(clean)?.[1];
  const title = titleRaw ? decodeEntities(titleRaw.replace(/\s+/g, " ").trim()) : null;

  const description = metaContent(html, "name", "description");
  const robotsMeta = (metaContent(html, "name", "robots") ?? "").toLowerCase();

  const h1Matches = [...clean.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const firstH1 = h1Matches[0]
    ? decodeEntities(
        h1Matches[0][1]
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      ) || null
    : null;

  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);

  const visibleText = clean
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const robotsBody = input.robotsTxt.body ?? "";
  // "Disallow: /" under a User-agent: * group blocks everything. Approximated
  // without full robots.txt grammar: good enough to RAISE the question, and the
  // engine is told it is an approximation rather than a verdict.
  const robotsDisallowsAll = /user-agent\s*:\s*\*/i.test(robotsBody) && /^\s*disallow\s*:\s*\/\s*$/im.test(robotsBody);

  return {
    seo: {
      title,
      titleLength: title ? title.length : null,
      metaDescription: description,
      metaDescriptionLength: description ? description.length : null,
      canonical: (() => {
        for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
          if (attr(match[0], "rel")?.toLowerCase() === "canonical") return attr(match[0], "href");
        }
        return null;
      })(),
      lang: (() => {
        const htmlTag = /<html\b[^>]*>/i.exec(html)?.[0];
        return htmlTag ? attr(htmlTag, "lang") : null;
      })(),
      hasViewport: metaContent(html, "name", "viewport") !== null,
      h1Count: h1Matches.length,
      firstH1,
      ogTitle: metaContent(html, "property", "og:title") !== null,
      ogDescription: metaContent(html, "property", "og:description") !== null,
      ogImage: metaContent(html, "property", "og:image") !== null,
      structuredDataTypes: jsonLdTypes(html),
      noindex: /\bnoindex\b/.test(robotsMeta),
      imagesTotal: imgTags.length,
      imagesMissingAlt: imgTags.filter((tag) => attr(tag, "alt") === null).length,
    },
    discovery: {
      robotsTxt: input.robotsTxt.status,
      robotsDisallowsAll,
      sitemapReferencedInRobots: /^\s*sitemap\s*:/im.test(robotsBody),
      sitemapXml: input.sitemapXml,
    },
    tracking: {
      metaPixel: /connect\.facebook\.net|fbq\s*\(|facebook\.com\/tr\?/i.test(html),
      ga4: /googletagmanager\.com\/gtag\/js|gtag\s*\(\s*['"]config['"]/i.test(html),
      gtm: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/.test(html),
      tiktokPixel: /analytics\.tiktok\.com|ttq\s*\.\s*(load|track)/i.test(html),
    },
    https: input.finalUrl.startsWith("https://"),
    // Thin server-rendered text is only evidence of client rendering if there
    // is JS that could do the rendering. A short page with NO script tag cannot
    // inject anything — treating it as an SPA would permanently disable
    // verification for every legitimately minimal landing page.
    jsRenderedLikely: visibleText.length < JS_RENDERED_TEXT_THRESHOLD && /<script\b/i.test(html),
    visibleTextLength: visibleText.length,
    bytes: input.bytes,
    fetchMs: input.fetchMs,
  };
}
