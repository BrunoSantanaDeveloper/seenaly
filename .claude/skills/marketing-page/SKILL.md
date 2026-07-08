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

**Pass 0 — Establish the direction.** Design decisions must be TUNED TO THE PRODUCT, not generically "good". Two branches:

**A. `docs/DESIGN.md` already exists (the common case after the first page): INHERIT, do not re-decide.** Read it and build strictly within it — typography, palette usage, depth treatment, layout archetypes, signature element, motion. **STRICT MODE: do NOT re-run the direction engine and do NOT restyle the UI.** Changing the direction is a "redesign" and happens ONLY when the user explicitly asks for it ("redesign", "nova direção", "novo visual"); that request rewrites `docs/DESIGN.md` first, then pages follow the new version.

**B. `docs/DESIGN.md` does NOT exist yet (first public page of the project): run the engine, then WRITE it.**
1. If the `ui-ux-pro-max` skill is installed (`.claude/skills/ui-ux-pro-max`), query it for this product's category: style, color usage, **font pairing** and layout guidance (161 product types, 57 pairings). For premium/expensive-product briefs, also load `premium-frontend-ui` (hero architecture, scroll narratives, atmosphere).
2. Pick ONE named direction from `references/directions.md` (or justify a custom one). The direction fixes: typography pairing, background/depth treatment, layout archetypes, motion character.
3. **Typography is a blocking decision**: load the display font with `next/font` in the root layout and set `--font-display`. A marketing page shipped on the admin font alone fails review.
4. **Persist it**: write the committed direction to `docs/DESIGN.md` (follow the shape of the template's version). This is what every later page inherits — the whole point of a consistent site.

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

## Anti-slop list (never ship these)

- The three default clusters: warm-cream + serif display + terracotta; near-black + acid accent; broadsheet hairlines with zero radius.
- **This repo's own failure mode: admin widgets stretched into a landing page.** Marketing pages use the marketing library, never dashboard cards/stat tiles as hero content.
- Templated hero = big stat + purple gradient. Open instead with the most characteristic thing in this product's world (usually a real product screenshot in `<ProductFrame>`).
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

## Visual vocabulary (the library's expressive range)

Beyond `Section`/`SectionHeader`/`FeatureGrid`/`Testimonials`/`Faq`/`Cta`, the library ships archetypes for expensive-product pages — compose these instead of inventing per-page layouts:

- `Hero layout="split"` — copy left, product evidence right; the default for data/product-heavy pages.
- `<ProductFrame glow>` — primary-tinted halo behind the frame; `<DataVizPlaceholder>` inside it when no screenshot exists yet (data products never ship a naked hero).
- `<FeatureRows>` — alternating text ↔ visual zig-zag; every claim next to its evidence. Use for the 2–4 features that deserve depth.
- `<BentoGrid>` — asymmetric grid with `featured` cells; replaces a second equal-card grid.
- `<StatBand>` — contrast band of oversized real numbers.
- `Section` props `decor` (glow/grid/gradient-edge) and `background="contrast"` — the depth system; vary along the scroll.

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

- Real product screenshots inside `<ProductFrame>` beat any decorative stock photo. The template ships zero stock photos — placeholders are token-driven (CSS gradients, tinted inline SVG) so they follow every theme.
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

Walk the page at 375px, 768px, 1440px; toggle dark mode and at least two color themes; emulate reduced motion; confirm every string resolves in all 5 locales; run `npm run build` and `npm run lint:fix`.
