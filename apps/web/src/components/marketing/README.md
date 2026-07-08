# Marketing component library

Building blocks for every public page under `apps/web/src/app/(marketing)/`. Consistency is enforced **by construction**: pages compose these components and never hand-tune spacing, widths or type sizes.

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

`Hero` (attention + value prop, ONE primary CTA) → `LogoCloud`/`Testimonials` (trust) → `FeatureGrid` (desire, benefit-led) → `PricingSection` (action) → `Faq` (objection handling) → `Cta` (recovery, repeats the primary CTA verbatim).

## Expressive range (premium archetypes)

- `Hero layout="split"` + `<ProductFrame glow>` — copy left, product evidence right. `<DataVizPlaceholder>` stands in for the screenshot on data products.
- `<FeatureRows>` — alternating text ↔ visual zig-zag (claims next to evidence).
- `<BentoGrid>` — asymmetric feature grid with `featured` cells.
- `<StatBand>` — contrast band of oversized real numbers.
- `Section` `decor="glow" | "grid" | "gradient-edge"` and `background="contrast"` — token-driven depth; vary the treatment at least twice along a page.

See `.claude/skills/marketing-page/SKILL.md` for the full design/copy playbook (direction engine, premium bar) and its `references/directions.md` for the named design directions with font pairings.
