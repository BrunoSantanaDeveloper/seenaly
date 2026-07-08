# Design directions — pick ONE and commit

Self-contained fallback of the direction engine (works even if the `ui-ux-pro-max` skill is absent). Each direction is a coherent bundle: typography pairing, background/depth treatment, layout archetypes, motion character, and the product categories it serves. Load fonts with `next/font` in the root layout and point `--font-display` at the display font — **never ship a marketing page on the admin font alone**.

Rule of use: pick the direction from the product's category and audience, write down WHY in one sentence, then stay consistent — mixing directions is how pages become generic again.

Palette note (applies to EVERY direction): the theme ships 6 harmonic hues (`primary`, `secondary`, `accent-1..4`). Primary carries CTAs and the bold moment; categorical elements (tiers, feature families, chart series, icon chips) take accent tones via the `tone` prop with a consistent meaning-mapping. Monochrome primary-only pages fail the premium bar — and hues outside the tokens are forbidden.

---

## 1. Premium SaaS / Data-driven ("the Linear/Stripe look")

- **For**: analytics, growth/marketing intelligence, fintech, dev tools, AI products.
- **Type**: geometric sans display with tight tracking (Space Grotesk, General Sans, Geist) over a neutral text sans (Inter, Figtree). Display sizes at the top of the scale; numbers in a tabular or mono face for data credibility.
- **Background**: dark-first. `decor="glow"` on the hero, `decor="grid"` on one technical section, one `background="contrast"` band. Noise/grain optional at 2–4% opacity.
- **Layouts**: Hero `layout="split"` with `<ProductFrame glow>` (screenshot or `<DataVizPlaceholder>`), `FeatureRows` zig-zag, `StatBand`, `BentoGrid` for secondary features.
- **Motion**: one orchestrated hero timeline (staggered copy + frame rise), quiet reveals elsewhere; chart draw-ins.

## 2. Editorial / Authority

- **For**: consultancy, education, publishing, professional services, thought-leadership products.
- **Type**: high-contrast serif display (Fraunces, Newsreader, Source Serif 4) over a humanist sans (Inter, Source Sans 3). Generous leading, drop caps sparingly.
- **Background**: light-first, warm neutrals; depth from typography and rules (hairlines), not glows.
- **Layouts**: asymmetric hero (large headline left, supporting media right), `FeatureRows`, pull-quote testimonials, numbered process only if the sequence is real.
- **Motion**: minimal — fades and small rises; the type is the show.

## 3. Health / Care / Trust

- **For**: healthtech, clinics (e.g. TCM/therapy products), wellness, insurance.
- **Type**: rounded or soft sans display (Plus Jakarta Sans, Nunito Sans, DM Sans) over the same family in text weights.
- **Background**: light, airy; soft `gradient-edge` transitions; one `contrast` band in a tinted brand pastel. Large radii everywhere.
- **Layouts**: Hero center with human-scale product shot, `FeatureRows` with benefit bullets, trust badges + credentials near the fold, FAQ prominent (objections are emotional here).
- **Motion**: gentle, slower durations; nothing snaps.

## 4. Commerce / Conversion-heavy

- **For**: e-commerce platforms, marketplaces, booking, local services.
- **Type**: strong condensed or bold sans display (Archivo, Barlow Condensed, Manrope ExtraBold) over a plain text sans.
- **Background**: light with saturated accent blocks; product imagery does the visual work.
- **Layouts**: Hero split with product collage, `StatBand` early (social proof), `BentoGrid` of category features, pricing above the FAQ.
- **Motion**: snappy micro-interactions on cards/CTAs; restrained scroll effects.

## 5. Technical / Developer-first

- **For**: APIs, infra, CLIs, open-source-adjacent commercial products.
- **Type**: sans display + **monospace as a first-class citizen** (JetBrains Mono, IBM Plex Mono) for code, numbers and eyebrows.
- **Background**: dark, `decor="grid"` prominent, terminal-style frames instead of browser chrome.
- **Layouts**: hero with a code/terminal block as the product evidence, `FeatureRows` alternating code ↔ outcome, comparison table.
- **Motion**: typed-text or line-by-line reveals in the terminal block only.

## 6. Luxury / Boutique

- **For**: premium services, high-ticket B2C, brands selling exclusivity.
- **Type**: refined serif or display face with personality (Cormorant, Playfair, Canela-like) at very large sizes; tiny tracking-wide uppercase labels.
- **Background**: near-black or bone-white; enormous negative space used deliberately (dense is cheap, sparse is expensive — but every viewport still needs ONE anchor).
- **Layouts**: cinematic full-bleed hero, few sections, oversized imagery, editorial pacing.
- **Motion**: slow cross-fades, parallax restraint, cinematic pacing (see the `premium-frontend-ui` skill).

---

## Anti-direction (what a missing direction looks like)

Centered stack → 3 equal cards → centered stack → accordions, all on one flat background, admin font as display, no product imagery. If the page you're about to ship matches this description, you skipped the direction step — go back.
