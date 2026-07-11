# Search direction (committed) — the SEO baseline, persisted

**This file is the single source of the public site's search direction.** The `marketing-page` skill READS it (the way it reads `docs/DESIGN.md`) when writing titles, descriptions and copy. It records two things: what the template already guarantees for free, and the per-page target terms a derived project commits to.

`/init-project` rewrites the per-page table below from `docs/PRODUCT.md`. The values here are the flyee template's own reference — replace them, keep the shape.

---

## What the template guarantees automatically (do NOT re-implement)

These ship in the base and rebrand from `@flyee/content` — a new page inherits them without effort:

| Concern | Where |
|---|---|
| XML sitemap (public routes only) | `apps/web/src/app/sitemap.ts` |
| robots + sitemap pointer (crawlers blocked from app/api) | `apps/web/src/app/robots.ts` |
| `metadataBase` + `%s \| Brand` title template + favicons | `apps/web/src/app/layout.tsx` |
| Shared Open Graph image (token-driven, 1200×630) | `apps/web/src/app/(marketing)/opengraph-image.tsx` |
| `Organization` + `WebSite` JSON-LD (site-wide) | `apps/web/src/app/(marketing)/layout.tsx` |
| `FAQPage` JSON-LD (from the FAQ items) | `components/marketing/faq.tsx` |
| `Product`/`Offer` JSON-LD (from real billing plans) | `components/marketing/pricing-section.tsx` |
| One `<h1>` per page contract | `SectionHeader` `as` / `PricingSection` `headingAs` |

## What each page must still do (the on-page layer)

See the `marketing-page` skill's "SEO & discoverability" section — enforced by review:
exactly one `<h1>` (the page title), a localized title tag (target term + value, ~60 chars) and a distinct 150–160-char description via `generateMetadata`, answer-first copy, the target term in `<h1>`/title/slug/first sentence, internal links to the money page, and structured data via `<JsonLd>` for any new schema-eligible block.

## Per-page target terms (rewrite per project from docs/PRODUCT.md)

| Page | Primary term / intent | Funnel role |
|---|---|---|
| `/` (home) | Brand + core value proposition — "one platform for billing, teams and AI" | brand + top-of-funnel |
| `/pricing` | "<product category> pricing" / "<category> plans" | commercial → the money page |
| `/about` | Brand + "about" | brand / navigational |
| `/contact` | Brand + "contact" | navigational |
| `/legal/*` | none — not a ranking target | trust / compliance |

These are template placeholders. A real project maps each page to a validated keyword with clear intent (money pages first), and grows blog/topic clusters around them — that work lives in the project, not the template.

## Architecture constraints (decisions, not page edits)

- **Indexable language:** i18n is cookie-based, so search and AI crawlers only ever see `DEFAULTS.locale` (`apps/web/src/config.ts`). The primary market's language MUST be the default (a Brazil-first project sets `pt-BR`). A genuinely multilingual, indexable site needs `/[locale]/` routing + `hreflang` — an architecture change, not a page edit.
- **`NEXT_PUBLIC_SITE_URL`** must be set in production (no trailing slash). Without it, `sitemap.ts`, `robots.ts`, the OG image and every JSON-LD `@id`/`url` fall back to `http://localhost:3000`.

## Open items (template baseline)

- The home is still the pre-direction baseline (see `docs/DESIGN.md` open items). It is technically sound for search; bringing its layout up to the premium bar is a normal edit governed by `DESIGN.md`, and does not change anything in this file.
