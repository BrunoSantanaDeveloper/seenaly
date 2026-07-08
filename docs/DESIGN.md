# Design direction (committed) — the marketing look, persisted

**This file is the single source of the public site's visual direction.** The `marketing-page` skill READS it and builds within it. It is durable design memory: once committed, every new page, every edit, and every added section inherit these decisions so the whole site reads as one system.

## STRICT MODE — how this governs work

- **New page** → inherit everything below. Do NOT re-run the direction engine.
- **Edit an existing page** → follow this file; do not restyle.
- **Add or change a section** → the new section obeys this file AND you run a **whole-page coherence pass**: every existing section must stay aesthetically aligned with the new one and pass the premium bar. If new work raises the bar, bring the older sections up — never ship a page half at the old level and half at the new.
- **Redesign** (changing the direction itself) happens ONLY when the user explicitly asks ("redesign" / "nova direção"). That request rewrites this file first; then pages follow the new version.

Derived projects: `/init-project` rewrites this file when the brand direction is committed. The values below are the flyee template's own reference direction — replace them, keep the shape.

---

## Committed direction

| Field | Decision |
|---|---|
| **Direction** | Premium SaaS / Data-driven (see `.claude/skills/marketing-page/references/directions.md` #1) |
| **Why** | Multi-tenant admin platform sold to teams; the product IS data and control surfaces, so the site must read as a serious, expensive tool — not a brochure. |
| **Display type** | Urbanist (geometric sans), loaded via `next/font` as `--font-heading`; marketing `font-display` resolves to it. Tight tracking, extrabold at the top of the fluid scale. |
| **Body type** | Mulish (`--font-body`), 16–18px, line-height 1.5+. |
| **Numbers** | Tabular/extrabold in the display face for `StatBand` and KPIs — data credibility. |
| **Palette usage** | Dark-first, **harmonic — never monochrome**. Primary is reserved for CTAs and the bold moment (hero glow + data viz main series). Categorical elements use the theme's harmonic hues via `tone` (`secondary`, `accent-1..4`): plan tiers, feature families, chart comparison series, icon chips — each family keeps ONE consistent hue across the whole site. Quiet base (neutral surfaces, hairline borders); never more than one saturated focus per viewport. |
| **Depth treatment** | `Section decor="glow"` on the hero, `decor="grid"` on one technical/feature section, one `background="contrast"` band (StatBand). The background MUST change ≥2× down the page. |
| **Layout archetypes** | Hero `layout="split"` + `<ProductFrame glow>`; `<FeatureRows>` zig-zag for depth features; `<BentoGrid>` for secondary; `<StatBand>` for proof. Never centered-stack + equal-card-grid all the way down. |
| **Signature element** | The animated `<DataVizPlaceholder>` (or a real product screenshot in `<ProductFrame glow>`) — product evidence above the fold, always. A naked text hero is a direction violation. |
| **Motion** | One orchestrated hero timeline (staggered copy + frame rise via GSAP `useGSAP`); quiet `<Reveal>` elsewhere; chart draw-in. No uniform scroll-reveals on everything. |

## Premium bar (must all pass before shipping any page)

1. Product evidence above the fold.
2. ≥2 layout archetypes beyond the centered stack.
3. Background changes ≥2× along the scroll.
4. 1440px density check: no viewport >50% empty.
5. One orchestrated motion moment + a runtime scroll pass (no `<Reveal>` left un-fired).
6. Display typography is the committed display font, not the raw admin font.
7. Harmonic palette in use: at least two hues beyond primary, purposefully mapped (tiers/families/series), via the `tone` prop — never a 100%-primary page and never hues outside the tokens.

## Open items (template baseline)

- The template's own `(marketing)` pages predate this direction and may not yet meet every premium-bar item; bringing them up is a normal edit governed by this file (and the coherence pass).
