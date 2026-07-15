# Design direction (committed) — the marketing look, persisted

**This file is the single source of the public site's visual direction.** The `marketing-page` skill READS it and builds within it. It is durable design memory: once committed, every new page, every edit, and every added section inherit these decisions so the whole site reads as one system.

## STRICT MODE — how this governs work

- **New page** → inherit everything below. Do NOT re-run the direction engine.
- **Edit an existing page** → follow this file; do not restyle.
- **Add or change a section** → the new section obeys this file AND you run a **whole-page coherence pass**: every existing section must stay aesthetically aligned with the new one and pass the premium bar. If new work raises the bar, bring the older sections up — never ship a page half at the old level and half at the new.
- **Redesign** (changing the direction itself) happens ONLY when the user explicitly asks ("redesign" / "nova direção"). That request rewrites this file first; then pages follow the new version.

---

## Committed direction — "Sala de Controle" (instrument-grade, dark data-driven)

Seenaly is an **AI growth copilot for paid traffic** — a decision-intelligence layer, not an ads manager. The site must read like a serious instrument that reads your account and returns an evidence-backed diagnosis, not a bright brochure. The look is a **dark control room** with two **instrument zones** (the hero and the section directly below it) and **oversized numbers** carrying the proof.

| Field | Decision |
|---|---|
| **Direction** | Premium SaaS / Data-driven, dark-first (directions.md #1), with a mono **instrument** treatment in the hero + the section right below it (directions.md #5) and **oversized-number** proof bands (directions.md #4). |
| **Why** | The product's signature output is a fixed, structured recommendation (Diagnóstico / Evidência / Base técnica / Ação / Confiança / Critério). Rendering that as a mono instrument readout above the fold IS the product evidence and the brand's differentiator. |
| **Display type** | **Space Grotesk** (geometric grotesk), loaded via `next/font` as `--font-display`; marketing `font-display` resolves to it. Tight tracking, bold at the top of the fluid scale. (Admin keeps Urbanist on `--font-heading`.) |
| **Instrument / data type** | **IBM Plex Mono** (`--font-mono`, Tailwind `font-mono`) — first-class, not decoration: the diagnosis readout, metric callouts, data labels and the eyebrows of the two instrument zones. |
| **Body type** | Mulish (`--font-body`), 16–18px, line-height 1.5+. |
| **Numbers** | **Oversized** and extrabold in the display face for `StatBand`/KPIs (the "big numbers" borrowed from a performance look) and tabular/mono for inline metrics — data credibility is the whole point. |
| **Palette usage** | Dark-first, **harmonic — never monochrome**. Orange **primary** (`14 99% 55%`) is the single saturated focus per viewport: CTAs, the hero glow, the readout's live signal. Categorical families keep ONE consistent hue site-wide via `tone`: **diagnosis/decision = primary**, **creative fatigue = accent-1** (rose), **funnel/bottleneck = accent-4** (blue), **experiment memory = accent-3** (violet), **Meta knowledge base = secondary** (burnt orange), **product context / zero-data = accent-2** (magenta). Quiet neutral base, hairline borders. |
| **Depth treatment** | `Section decor="glow"` on the hero; a **vertical grid** on the instrument section below it and `decor="grid"` on one technical FeatureRows; one `background="contrast"` band (the oversized StatBand). Background changes ≥2× down the page. |
| **Layout archetypes** | Hero `layout="split"` with the **mono `DiagnosisReadout`** as evidence (not browser chrome), **layered inside `<ProductComposition>`**: the readout is the central frame, orbited by 2–3 `satellite-chips` carrying REAL domain signals (creative fatigue KPI, funnel trend, memory readout) at different depths and slight rotation. A lone unlayered frame is now below the bar. An **instrument pipeline** section directly below (`ProcessSteps mono`); `StatBand` with oversized numbers; `FeatureRows` zig-zag with the domain vignettes (`DiagnosisVignette`/`FatigueVignette`/`FunnelVignette`); **exactly one breakout moment** (`<Band angle>` angled contrast strip OR `<Breakout side>` media escaping to the viewport edge) — reserved for the product's differentiator, the experiment memory. Never centered-stack + equal-card-grid all the way down. |
| **Signature element** | The **mono diagnosis readout** — the product's fixed recommendation format rendered as an instrument panel above the fold, layered with its satellite signals. A naked text hero is a direction violation; so is a flat, unlayered one. |
| **Motion** | One orchestrated hero timeline (staggered copy → readout frame rise → satellites pop, via GSAP `useGSAP`); quiet `<Reveal>` elsewhere; chart/line draw-ins in the vignettes. Plus an **ambient layer** — the instrument must feel *alive*, never busy: `<Float>` on the hero satellites, one `<Parallax>` drift on a back-depth satellite, `<CountUp>` on the StatBand numbers (built in), and `decor="orbit"` as the closing CTA's slow pulse. **Budget: ≤4 `Float` + ≤2 `Parallax` + ≤1 `orbit` per page**, all reduced-motion safe. No uniform scroll-reveals on everything. |

## Premium bar (must all pass before shipping any page)

1. Product evidence above the fold (the mono readout, or a domain vignette / real screenshot).
2. ≥2 layout archetypes beyond the centered stack.
3. Background changes ≥2× along the scroll.
4. 1440px density check: no viewport >50% empty.
5. One orchestrated motion moment + a runtime scroll pass (no `<Reveal>` left un-fired).
6. Display typography is Space Grotesk (mono where the instrument zones call for it), not the raw admin font.
7. Harmonic palette in use: at least two hues beyond primary, purposefully mapped to the families above, via the `tone` prop — never a 100%-primary page and never hues outside the tokens.
8. Show, don't tell: text-heavy sections carry a glance-able visual (readout, vignette, oversized number, meaningful icon in the family hue) — no wall of title+paragraph cards.
9. **The hero media is LAYERED, not a flat rectangle** — `<ProductComposition>`: central frame (the `DiagnosisReadout`, or a real `<ProductShot>` once screenshots exist) + ≥2 `satellite-chips` overlapping its edges at different depths with slight rotation. Satellites carry REAL localized domain content — a chip that lies is worse than no chip. This is the single biggest lever against "looks like every other SaaS".
10. **≥1 breakout / full-bleed moment** — one `<Band angle>` (angled contrast strip) OR `<Breakout side>` (media escaping to the viewport edge). Exactly one: two competing breakouts fight. On the home it belongs to the experiment memory, the product's differentiator.
11. **Ambient motion is present but restrained** — something breathes: `<Float>` satellites, `<CountUp>` stat numbers, one `<Parallax>` layer, `decor="orbit"` on the closer. Budget ≤4 Float + ≤2 Parallax + ≤1 orbit per page, all reduced-motion safe. A dead-static page reads cheap; a page where everything moves reads like a demo.

## Open items

- The home implements this direction end to end (layered instrument hero + pipeline, FeatureRows with vignettes, oversized StatBand, the memory breakout, ambient motion within budget). It is the reference implementation new pages read.
- `/pricing`, `/about`, `/contact` are supporting pages: structurally compliant (single h1, metadata, primitives, lead-section glow) but quieter than the home. Deepening them is a normal edit governed by this file.
- Real product screenshots still pending — the token-driven vignettes and the mono readout stand in until screenshots exist; drop them into `<ProductFrame>` when ready.
