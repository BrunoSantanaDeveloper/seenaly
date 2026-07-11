# Marketing component library

Building blocks for every public page under `apps/web/src/app/(marketing)/`. Consistency is enforced **by construction**: pages compose these components and never hand-tune spacing, widths or type sizes.

`catalog.json` is the machine-readable index of this library (components, props, funnel stage, when to use). The `marketing-guard` hook injects its digest into every marketing write/edit, and the `marketing-lint` hook checks the written result against the contract — keep the catalog in sync whenever a component's props change.

## Contract

- **Every block of content sits inside `<Section>`** (which renders `<Container>`); vertical rhythm, max width and horizontal padding come from the marketing tokens (`packages/design-tokens/css/marketing.css`) — never from per-page utility values.
- **Headings use the fluid display scale**: `font-display text-display-{2xl,xl,lg,md}` (`clamp()`-based, no breakpoint font-size jumps). `--font-display` falls back to the heading font; derived projects may load a dedicated display font in the root layout.
- **Motion only through `<Reveal>`** (GSAP + ScrollTrigger): transforms + `autoAlpha`, plays once, honors `prefers-reduced-motion`. Never animate width/height/top/left.
- **Copy comes from the `marketing` i18n namespace** — no hardcoded strings; pages fetch translations and pass plain data into the sections.
- **Tokens only** for colors/radii/shadows (`hsl(var(--token))` via Tailwind classes). All 4 color themes × light/dark must look right.
- **Icons** via `@/icons/nexture/ni-*` (alias contract), passed to sections as rendered nodes.
- **Images**: real product screenshots inside `<ProductFrame>`; static assets in `public/images/marketing/` rendered with `next/image` (explicit sizes, translated `alt`). The template itself ships zero stock photos — placeholders are token-driven.
- **Mobile-first**: base layout is the phone; breakpoints only add columns/space.

## Conversion mapping (home page order)

`Hero` split + `ProductFrame glow` (attention + value prop + evidence, ONE primary CTA) → `LogoCloud` (trust) → `FeatureRows` (flagship desire, claim next to evidence) → `BentoGrid` (secondary desire) → `StatBand` (proof) → `Testimonials` (trust) → `PricingSection` (action) → `Faq` (objection handling) → `Cta` (recovery, repeats the primary CTA verbatim).

## Expressive range (premium archetypes)

- `Hero layout="split"` + `<ProductFrame glow>` — copy left, product evidence right. `<DataVizPlaceholder>` stands in for the screenshot on data products.
- `<FeatureRows>` — alternating text ↔ visual zig-zag (claims next to evidence).
- `<BentoGrid>` — asymmetric feature grid with `featured` cells.
- `<StatBand>` — contrast band of oversized real numbers.
- `Section` `decor="glow" | "grid" | "gradient-edge"` and `background="contrast"` — token-driven depth; vary the treatment at least twice along a page.
- **Harmonic tones** (`tone.ts`): `BentoGrid` cells, `FeatureRows` items, `StatBand` stats, `PricingSection` plans, `FeatureGrid` cards and `ProcessSteps` accept `tone` (`primary | secondary | accent-1..4`). Primary stays reserved for CTAs/bold moment; categorical elements rotate through the harmonic hues with a consistent meaning-mapping — a 100%-primary page fails the premium bar.
- `ProcessSteps` — "how it works" sequence: ghosted ordinal + meaningful themed icon + optional deliverable line, one hue per step. Scannable flow before any reading.
- **Show, don't tell**: lead feature/step cards with a MEANINGFUL icon (the concept, not decoration) in the family hue. Conceptual illustrations are a first-class asset via the imagery pipeline (generate into `public/images/marketing/` or deliver a prompt + placeholder); never hand-author generic scene SVGs.

See `.claude/skills/marketing-page/SKILL.md` for the full design/copy playbook (direction engine, premium bar) and its `references/directions.md` for the named design directions with font pairings.
