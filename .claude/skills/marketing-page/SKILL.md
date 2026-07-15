---
name: marketing-page
description: Design/copy playbook for public marketing pages (landing pages, pricing, about, any page under apps/web/src/app/(marketing)). Use BEFORE creating or substantially editing any public-facing page — it prevents generic "AI slop" design and copy by forcing a committed design direction, conversion-mapped structure and jargon-free copy (EN + pt-BR rules).
---

# Marketing page playbook

You are designing a public page that must convert visitors, not decorate a template. Work like a boutique studio lead: make deliberate, opinionated choices specific to THIS product — never reach for the statistically-common default.

## Scope: this skill governs ALL marketing work, not just new pages

It applies equally to **creating a page**, **editing an existing page**, and **adding or changing a section**. The `PreToolUse` marketing-guard hook loads it automatically on every Write/Edit to `app/(marketing)/**` or `components/marketing/**` — you do not wait to be asked.

- **New page** → Pass 0 (inherit or commit a direction), then build.
- **Edit an existing page** → skip the engine; obey `docs/DESIGN.md`; change only what was asked, in the established style.
- **Add/change a section** → build the section in the committed direction, then run a **whole-page coherence pass**: re-read the entire page and confirm every existing section stays aesthetically aligned with the new one and still passes the premium bar. If the new work raised the bar (a nicer layout, real product media, a depth treatment the old sections lack), bring the older sections up to it. Never leave a page half at the old level and half at the new — a mismatched section is worse than no section.

## Process: direction engine, two passes, then code

**Pass 0.R — Reference ingestion (optional, run it FIRST when references exist).** If the user dropped inspiration screenshots in `attachments/` (or points you at reference sites), study them BEFORE the direction work — a great reference analysis is wasted if the library can't express it, so the output is a mapping, not a mood board:
1. `Read` each reference image (multimodal). Extract **structural** ingredients only — layout composition, layering/depth, breakout usage, imagery type, motion character, type hierarchy. NEVER carry over a hex value or font name; map each cue to the nearest token/library primitive, or record it as "rejected: off-system".
2. Append/replace the `## Reference ingredients` section in `docs/DESIGN.md` (table shape below). Explicitly list any ingredient the library **cannot express yet** → that becomes a component to build in `components/marketing/`, NOT a per-page hack.
3. Route/delete the reference files per `attachments/README.md` (they never live in the repo).

```md
## Reference ingredients (ingested <date> from <filenames>)
| Ingredient | What the reference does | How WE do it (library mapping) |
|---|---|---|
| Hero composition | central screenshot + 3 floating KPI cards, slight tilt | ProductComposition + Kpi/Trend satellites, rotate ±2–3 |
| Breakout | angled full-width band mid-page | Band angle=-1 |
| Motion | chips drift, stats count up | Float / CountUp (reduced-motion safe) |
Gaps the library cannot express yet: <list or "none"> → extend components/marketing.
```

**Pass 0.R-B — BLUEPRINT mode (when the user says the reference is the model to FOLLOW, not inspiration).** Trigger words: "blueprint", "siga fielmente", "quero a página igual a esta", "use este modelo". The contract hardens:

1. The ingredient table becomes a **mandatory section-by-section mapping** — every section of the reference gets a row, in order, and the built page follows that order 1:1:
```md
## Reference blueprint (committed <date> from <filenames> — structure is FIXED)
| # | Reference section (what it shows) | Our section (primitive + content source) |
|---|---|---|
| 1 | hero: headline left, app screenshot right, 3 floating cards | Hero split + ProductComposition (frame + KpiChip/TrendChip/ReadoutChip) |
| 2 | logo strip | LogoCloud |
| 3 | 3-step how-it-works with numbered cards | ProcessSteps variant per direction |
| ... | every remaining section, no skips, no reordering | ... |
```
2. **Structure is decided by the blueprint; identity stays ours.** Skip the direction-exploration previews (Pass 0.B.2–3) for layout — the blueprint IS the layout decision. Typography/palette still come from the brand tokens (run only the type/palette part of the engine); copy is always ours, in all 5 locales; the reference's text, images, logos and mascots are NEVER reproduced.
3. A blueprint section the library cannot express is a **blocking gap**: build the primitive in `components/marketing/` first (register it in `catalog.json`), then compose the page. Never approximate a blueprint section with a "close enough" archetype without flagging it to the user.
4. Deviations are allowed only where a premium-bar or hard-constraint rule would be violated (e.g. the reference hero is text-only, or uses horizontal-scroll patterns that break at 375px) — list every deviation in the blueprint table (a `Deviation:` note on the row), never deviate silently.
5. **Keep the reference files in `attachments/` until the blueprint comparison passes** in marketing-verify (it needs them for the side-by-side); delete them only after the page is approved.

**Pass 0 — Establish the direction.** Design decisions must be TUNED TO THE PRODUCT, not generically "good". Two branches:

**A. `docs/DESIGN.md` already exists (the common case after the first page): INHERIT, do not re-decide.** Read it and build strictly within it — typography, palette usage, depth treatment, layout archetypes, signature element, motion. **STRICT MODE: do NOT re-run the direction engine and do NOT restyle the UI.** Changing the direction is a "redesign" and happens ONLY when the user explicitly asks for it ("redesign", "nova direção", "novo visual"); that request rewrites `docs/DESIGN.md` first, then pages follow the new version.

**B. `docs/DESIGN.md` does NOT exist yet (first public page of the project): run the engine, let the user SEE the candidates, then WRITE it.**
1. If the `ui-ux-pro-max` skill is installed (`.claude/skills/ui-ux-pro-max`), query it for this product's category: style, color usage, **font pairing** and layout guidance (161 product types, 57 pairings). For premium/expensive-product briefs, also load `premium-frontend-ui` (hero architecture, scroll narratives, atmosphere).
2. Shortlist **2–3 named directions** from `references/directions.md` (or one justified custom candidate) that genuinely fit THIS product — distinct directions, not three flavors of the same look. Each fixes: typography pairing, background/depth treatment, layout archetypes, motion character.
3. **Show, don't describe — the user picks a direction they can SEE.** For each candidate, generate a lightweight self-contained HTML preview (one file per direction: hero + one content section, ~a screenful) using the REAL token values from `packages/design-tokens` and the candidate's font pairing (a Google Fonts link is acceptable in the preview only). Present them side by side — publish via the Artifact tool when available, otherwise save them under `docs/design-directions/` and ask the user to open them — and collect the choice with AskUserQuestion (one option per direction, naming its typography/depth/layout traits). Never commit a direction the user has only read about in prose. If the session is non-interactive, pick the best-fit candidate, say so explicitly, and leave the previews in place for later review.
4. **Typography is a blocking decision**: load the display font with `next/font` in the root layout and set `--font-display`. A marketing page shipped on the admin font alone fails review.
5. **Persist it**: write the CHOSEN direction to `docs/DESIGN.md` (follow the shape of the template's version) and delete the losing previews. This is what every later page inherits — the whole point of a consistent site.

**Pass 1 — Plan against the committed direction (before any code).** Write down, consistent with `docs/DESIGN.md`: how the palette will be used on this page (where the one bold moment lives); the type treatment (display scale usage, hierarchy); the layout concept per section (which archetypes: split hero / FeatureRows / BentoGrid / StatBand — never centered-stack all the way down); and how this page carries the direction's signature element. **Spend your boldness in one place** — but quiet ≠ empty: every section still needs a visual anchor (media, background shift, oversized number, illustration).

**Pass 2 — Critique against the brief.** Re-read the plan: which choices would appear on any generic SaaS page regardless of subject? Replace them. Only then build.

## The premium bar (blocking checklist — the page is not done until ALL pass)

A page can follow every rule below and still look like a beginner site if it is visually empty. Before finishing, verify:

1. **Product evidence above the fold** — a real screenshot in `<ProductFrame glow>`, a `<DataVizPlaceholder>` (data products), or a generated asset. A hero with only text and buttons FAILS.
2. **≥2 layout archetypes beyond the centered stack** across the page (Hero `layout="split"`, `FeatureRows` zig-zag, `BentoGrid`, `StatBand`...). Centered-stack + card-grid repeated is the anti-direction.
3. **The background changes at least twice along the scroll** (`decor="glow" | "grid" | "gradient-edge"`, `background="contrast" | "paper"`). No flat single-color void from top to bottom.
4. **Density check at 1440px**: scroll the whole page — no viewport-height stretch may be >50% empty. Fix by tightening spacing, adding an anchor visual, or merging sections; never by padding with filler copy.
5. **One orchestrated motion moment** (GSAP timeline on the hero: staggered copy + media entrance) instead of uniform scroll-reveals everywhere. Then RUN the page and scroll it end to end: a `<Reveal>` that never fires leaves a permanent hole — every section must actually appear.
6. **Display typography is not the admin font** (Pass 0.3).
7. **Harmonic palette, not monochrome** — the theme ships 6 hues designed to combine (`primary`, `secondary`, `accent-1..4`, all with light/dark variants). Primary is reserved for CTAs and the bold moment; categorical elements (plan tiers, feature families, chart series, icon chips) take accent tones via the `tone` prop (`components/marketing/tone.ts`) with a CONSISTENT meaning-mapping across the page and site (the same family keeps the same hue everywhere). A page where every tinted element is primary reads flat and monochrome — it FAILS. Never invent hues outside the token palette.
8. **Show, don't tell** — the reader scans, they don't read. Every text-heavy section must carry a visual that conveys its meaning AT A GLANCE, so the point lands without reading the body: a MEANINGFUL icon (the concept, not decoration), a figure, a chart, or a conceptual illustration. Feature families and process steps always lead with such an icon in their family hue (`FeatureGrid`, `ProcessSteps`, `BentoGrid`). A wall of cards that are title+paragraph only FAILS.
9. **The hero media is LAYERED, not a flat rectangle** — a lone `<ProductFrame>` sitting in a column reads like the pre-2020 template look. Use `<ProductComposition>`: a central frame (real `<ProductShot>` screenshot when available, else `<ProductFrame>`/`<DataVizPlaceholder>`) with ≥2 floating `satellite-chips` (KPI/trend/readout) overlapping its edges at different depths and slight rotation. This is the single biggest lever against "looks like every other SaaS".
10. **≥1 breakout / full-bleed moment** — a landing page that lives entirely inside the container reads timid. One `<Band angle>` (angled contrast strip) OR `<Breakout side>` (media escaping to the viewport edge). Exactly one is plenty; two competing breakouts fight.
11. **Ambient motion is present but restrained** — something breathes: a `<Float>` satellite, an `orbit` decor, `<CountUp>` stat numbers, one `<Parallax>` layer. Budget: ≤4 Float + ≤2 Parallax + ≤1 orbit per page, all reduced-motion safe. A dead-static page reads cheap; a page where everything moves reads like a demo. Verify the reduced-motion pass renders everything visible.

## Anti-slop list (never ship these)

- The three default clusters: warm-cream + serif display + terracotta; near-black + acid accent; broadsheet hairlines with zero radius.
- **This repo's own failure mode: admin widgets stretched into a landing page.** Marketing pages use the marketing library, never dashboard cards/stat tiles as hero content.
- Templated hero = big stat + purple gradient. Open instead with the most characteristic thing in this product's world (a layered `<ProductComposition>` around a real screenshot / data-viz).
- A flat single-rectangle hero, or a page with zero breakouts and zero ambient motion — it will read a full tier below the reference sites (Flowora/Nexora/Taskora) even if every other rule passes.
- Scattered scroll effects on everything. One orchestrated moment lands harder.
- Numbered markers (01/02/03) unless the sequence carries real information.

## Hard constraints (non-negotiable, enforced by review)

- **Structure:** every content block sits in `<Section>` / `<Container>` / `<SectionHeader>` from `apps/web/src/components/marketing/` — never hand-tuned paddings, widths or `max-w-*` per page. New sections extend the library, not the page.
- **Tokens only:** colors/radii/shadows via `hsl(var(--token))` Tailwind classes; spacing/type/motion via the marketing tokens (`packages/design-tokens/css/marketing.css`). The page must look right in all 4 color themes × light/dark.
- **Type:** headings use `font-display text-display-{2xl,xl,lg,md}` (fluid clamp scale — no `text-[3rem] md:text-[5rem]` breakpoint jumps). Optional display font: load in root layout, set `--font-display`.
- **i18n:** every string through the `marketing` namespace in ALL locale files (`de,en,es,fr,pt-BR`). No hardcoded copy.
- **Icons:** the template ships more than one icon set (Nexture native; Phosphor and others via adapters — see `apps/web/src/icons/README.md`). The set is a per-project decision made once (init-project or tsconfig alias remap), NOT per page. Pages always import through the alias `@/icons/nexture/ni-*` regardless of the chosen set, and never import an icon library (Phosphor, Lucide, MUI icons) directly. If the project hasn't decided yet, ask before the first page — don't mix sets.
- **Responsive:** mobile-first — the base layout is the phone; breakpoints only add columns/space. No horizontal scroll at 375px. Verify 375/768/1440.
- **Routes:** a new public page must be added to `PUBLIC_PREFIXES` in `apps/web/src/middleware.ts` and to `apps/web/src/app/sitemap.ts`, and export its own `metadata`/`generateMetadata`.

## SEO & discoverability (every page earns its ranking)

The template already ships the technical layer — `sitemap.ts`, `robots.ts`, the shared Open Graph image, `Organization`/`WebSite` JSON-LD in the marketing layout, and `FAQPage`/`Product` JSON-LD emitted automatically by `Faq`/`PricingSection`. The committed per-page search direction (target term + intent per page) lives in `docs/SEO.md` — read it the way you read `docs/DESIGN.md`. Your job on each page is the on-page layer:

- **Exactly one `<h1>` — the page title.** A page that opens with `<Hero>` already has it; a page whose lead is a plain section passes `as="h1"` to its first `<SectionHeader>` (or `headingAs="h1"` to `<PricingSection>`). Every other heading is `<h2>`/`<h3>` in a real hierarchy — the display size is set by `text-display-*`, independent of the tag, so NEVER pick a heading level for its size.
- **Title tag:** `generateMetadata` returns a `title` that leads with the page's target term + the value, ~60 chars, localized — never just the brand name. The home composes `Brand — value proposition` via `title: { absolute }` to skip the `%s | Brand` template.
- **Meta description:** 150–160 chars, written like ad copy (the outcome + the reason to click), localized, distinct per page — don't let a page inherit the home description.
- **Answer-first copy:** any section that answers a question (FAQ, feature explainer) opens with the direct answer in the first sentence, then the depth. This is what AI search engines quote and what wins zero-click surfaces.
- **Target term in the visible places:** the page's keyword belongs in the `<h1>`, the title tag, the URL slug and the first sentence — naturally, never stuffed.
- **Structured data:** reuse the components that already emit it; if a page adds a new schema-eligible block (article, breadcrumb, how-to), emit it with `<JsonLd>` (`components/marketing/json-ld.tsx`) — never hand-write a `<script>`.
- **Internal links:** connect a new page to related pages and to the money page (pricing/sign-up) — this is how authority flows and how crawlers discover it.
- **Indexable language:** i18n is cookie-based, so crawlers only see the default locale (`DEFAULTS.locale`). The primary market's language MUST be the default; a truly multilingual site needs `/[locale]/` routing (an architecture change, not a page edit).

## Visual vocabulary (the library's expressive range)

Beyond `Section`/`SectionHeader`/`FeatureGrid`/`Testimonials`/`Faq`/`Cta`, the library ships archetypes for expensive-product pages — compose these instead of inventing per-page layouts:

- `Hero layout="split"` — copy left, product evidence right; the default for data/product-heavy pages.
- `<ProductComposition>` — the LAYERED hero: a central frame + 2–4 floating `satellite-chips` (`KpiChip`/`TrendChip`/`AvatarRowChip`/`ReadoutChip`) overlapping its edges with depth + rotation + float. This is the reference-site look and the answer to premium bar #9. Collapses to a chip row below md.
- `<ProductShot name>` — the real light/dark screenshot pair from `public/images/marketing/` (see Imagery). `<ProductFrame glow>` — browser chrome; `<DataVizPlaceholder>` inside it when no screenshot exists (data products never ship a naked hero).
- `<Band angle>` / `<Breakout side>` — the breakout primitives (premium bar #10): an angled full-bleed contrast strip, or media escaping to the viewport edge. One per page.
- `<Float>` / `<Parallax speed>` / `<CountUp>` — the ambient motion layer (premium bar #11); `Section decor="orbit"` is the one slowly-alive decor. Budget ≤4 Float + ≤2 Parallax + ≤1 orbit.
- `<FeatureRows>` — alternating text ↔ visual zig-zag; every claim next to its evidence. Use for the 2–4 features that deserve depth.
- `<BentoGrid>` — asymmetric grid with `featured` cells; replaces a second equal-card grid.
- `<StatBand>` — contrast+grid band of oversized numbers that count up.
- `<ProcessSteps>` — "how it works" sequence: `variant="icon"` (themed icon + ghost ordinal) or `variant="mono"` (mono `0N · kicker`, instrument treatment), one hue per step.
- `<FeatureGrid>` — benefit-led cards, each leading with a meaningful icon in its family hue.
- `Section` props `decor` (glow/grid/gradient-edge/dots/mesh/orbit) and `background="contrast"` — the depth system; vary along the scroll.

## Conversion structure (the home/landing formula)

Map every section to a funnel stage; a section that serves no stage gets cut:

1. **Hero — attention + value proposition.** Above the fold answers: what it is, for whom, the outcome. ONE primary CTA per page; its label is the conversion action and repeats verbatim at every action point (hero → pricing → final CTA). Secondary actions are visually subordinate (pastel/text variants).
2. **Logo cloud / testimonials — trust.** Testimonial quotes carry a concrete outcome (numbers, before/after), never vague praise.
3. **Feature grid — desire.** Titles are benefit-led (the customer's outcome), never internal feature names.
4. **Pricing — action.** Real plans via `getDisplayPlans()` (`app/(marketing)/plans.ts`); highlight one anchor plan.
5. **FAQ — objection handling.** Each question is a REAL purchase objection (price, lock-in, security, migration), answered plainly.
6. **Final CTA — recovery.** Repeats the primary CTA verbatim.

## Copy rules

- Words exist to make understanding easier. Active voice, plain verbs, conversational tone. Read it aloud: if it sounds like a press release, rewrite it.
- Benefit-led headlines: the outcome, not the feature name. Specificity beats superlatives — numbers and concrete results, never "revolutionary".
- One idea per section: headline + max 2 supporting lines, scannable.
- Consistent action names: the same button does the same thing with the same label everywhere.

**Banned AI-copy patterns — English:** "unlock", "elevate", "empower", "seamless", "robust solutions", "supercharge", "game-changing", empty triads ("fast, easy and secure"), "it's not just X, it's Y", em-dash chains, exclamation marks in body copy.

**Banned AI-copy patterns — português (pt-BR):** "desbloqueie", "eleve/potencialize/impulsione seu negócio", "soluções inovadoras/completas/robustas", "sem esforço", tríades vazias ("rápido, fácil e seguro"), a fórmula "não é apenas X, é Y", gerundismo ("estaremos enviando"), "alavancar", traduções literais do inglês ("sem costura"), excesso de travessões e exclamações. Escreva como um especialista brasileiro falaria com um cliente — não como material de imprensa.

## Imagery

Three distinct asset kinds — do not conflate them:

1. **Product evidence** — real screenshots inside `<ProductFrame>` (or `<DataVizPlaceholder>` for data products). The proof the product exists and works.
2. **Explanatory iconography** — a meaningful icon per feature/step (`@/icons/nexture/ni-*`), carrying the concept at a glance in the family's hue. Zero-dependency, always on-brand and theme-aware — this is the FIRST choice for "show, don't tell", before reaching for generated art. The icon set has hundreds of glyphs; pick the one that means the thing.
3. **Conceptual illustration** — a spot illustration/scene that explains an idea (how the flow works, what a concept maps to). This is a first-class asset, not decoration.

**Real screenshots via the pipeline (first-class):** `<ProductShot name>` renders the light + `-dark` PNG pair from `public/images/marketing/`, captured by `npm run shots:marketing -w @flyee/web` (dev server up; playwright resolved from the session/`PLAYWRIGHT_DIR`, never a repo dependency). Pass a translated `alt`, a `sizes` string, and `priority` ONLY on the above-the-fold shot. The captured screenshot is the frame inside `<ProductComposition>`/`<ProductFrame>`. **The template itself ships NO screenshots** — a fresh clone's dashboards are auth-gated, so the reference home uses `<ProductComposition>` + a token `<ProductFrame>`/`<DataVizPlaceholder>` frame; a derived project runs `shots:marketing` once it can reach its real product and swaps the frame to `<ProductShot>` (same page, one line). Real imagery is required on a page ONLY when the assets exist.

Rules:
- Real product screenshots inside `<ProductFrame>` beat any decorative stock photo. The template ships zero stock photos — placeholders are token-driven (CSS gradients, tinted inline SVG) so they follow every theme.
- **Conceptual illustrations follow the imagery pipeline**: if the session has an image-generation tool, generate into `public/images/marketing/` (line/flat style matching the page's design direction, referencing the theme's primary + accent token values, light+dark variants, translated `alt`). If NOT, deliver a complete ready-to-paste generation prompt AND leave the section working meanwhile with an icon-composition or token-SVG placeholder — never a blank. Prefer a meaningful icon over a mediocre generated illustration; reach for illustration when a single glyph cannot carry the idea.
- Do NOT hand-author generic scene illustrations as inline SVG (rockets, mascots, devices) — they look cheap forced-generic. Icons for spot art; the generation pipeline for richer scenes.
- Static assets: `apps/web/public/images/marketing/`, rendered with `next/image` (explicit `width/height`/`sizes`, translated `alt`). Dark variants via `-dark` suffix + `dark:` class. Hero media budget ~200KB; lazy-load below the fold.
- One consistent visual treatment per page (single tint/duotone from tokens) — not a collage of styles.
- AI-generated assets (Higgsfield, MCP image tools, etc.) are a per-project choice: generated files enter through `public/images/marketing/` and follow the exact same conventions.
- **No generation tool available? Deliver the prompt instead.** When the session has no image/video generation capability, produce a complete, ready-to-paste generation prompt for the user to run in their tool of choice, and leave the page working with the token-driven placeholder meanwhile. The prompt must specify: subject and composition; style aligned with the page's design direction (reference the theme's primary color values from `packages/design-tokens`); exact dimensions and aspect ratio; file format; light and dark variants when applicable; the target path under `public/images/marketing/`; and the translated `alt` text to add. The user generates the asset and drops it in — nothing else on the page should need to change.

## Motion

- Only through `<Reveal>` (`components/marketing/reveal.tsx`) or a GSAP `useGSAP` block in a client component. Transforms + `autoAlpha` only — never animate width/height/top/left.
- Wrap in `gsap.matchMedia()` honoring `prefers-reduced-motion: reduce` (static and fully visible). Degrade heavy scroll animation on touch devices.
- Durations/easing/distance come from the motion tokens. ScrollTrigger plays once, near-viewport start.
- For GSAP API details, defer to the installed `gsap-*` skills (`.claude/skills/gsap-*`).

## Before finishing

Run the `marketing-verify` skill — it renders the page and judges the premium bar on actual screenshots (375/768/1440 × light/dark, reduced motion, fired reveals). Code that was never rendered is not verified. Additionally: confirm every string resolves in all 5 locales; run `npm run build` and `npm run lint:fix`.

**SEO pass:** exactly one `<h1>`; `generateMetadata` exports a localized title (target term + value, not just the brand) and a distinct 150–160-char description; the route is in `PUBLIC_PREFIXES` and `sitemap.ts`; structured data is present where applicable (FAQ, pricing, article); every image has descriptive `alt`; the page links to the money page. View source and confirm the JSON-LD and `<h1>` are in the server-rendered HTML.
