---
name: marketing-verify
description: Visual verification of marketing pages against the premium bar — runs the app, captures screenshots at 3 widths × light/dark, and judges the actual pixels (evidence above the fold, archetypes, background changes, density, fired reveals). Use AFTER building or substantially editing any page under apps/web/src/app/(marketing), before declaring it done; also when asked to "verify/check the marketing page" or audit it against docs/DESIGN.md.
---

# Marketing visual verification

The premium bar (`docs/DESIGN.md` + the `marketing-page` skill) is judged on PIXELS, not on code review. This skill makes the check executable: render the page, look at it, verdict each bar item. A page is not "done" because it typechecks — it is done when the screenshots pass.

## 1. Run the app

- `npm run dev` from the repo root, in the background; wait until `http://localhost:3000` answers (Turbopack usually < 30s). Reuse an already-running dev server when one is up.

## 2. Capture

Screenshots go to the session scratchpad (never into the repo). One-time setup in the scratchpad: `npm init -y && npm i playwright && npx playwright install chromium` (~130MB, cached machine-wide). If the browser download is impossible (offline/CI), skip to the degraded mode below.

Write an ad-hoc script from this template (adjust `routes`):

```js
import { chromium } from "playwright";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const routes = ["/"]; // every route you touched
const viewports = [[375, 812], [768, 1024], [1440, 900]];
const browser = await chromium.launch();
for (const route of routes) {
  for (const [width, height] of viewports) {
    for (const dark of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height } });
      // Theme mode defaults to "system", and the ThemeProvider re-resolves the
      // <html> classes on hydration — injecting the class directly gets undone.
      // Emulating the OS color scheme is the supported way to render dark.
      if (dark) await page.emulateMedia({ colorScheme: "dark" });
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      // Scroll the full page in steps so every ScrollTrigger reveal fires, then return to top.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(800);
      const slug = route.replaceAll("/", "_") || "home";
      await page.screenshot({ path: `shots/${slug}-${width}${dark ? "-dark" : ""}.png`, fullPage: true });
      if (width === 1440 && !dark) await page.screenshot({ path: `shots/${slug}-fold.png` }); // above-the-fold
      await page.close();
    }
  }
}
await browser.close();
```

Extra passes when relevant: `page.emulateMedia({ reducedMotion: "reduce" })` (everything must render static AND visible) and a second color theme — set the persisted preference before load (`page.addInitScript` writing the `*-theme-color` localStorage key; see `LS_KEYS`/`DEFAULTS` in `src/constants.ts` + `src/config.ts`), since the ThemeProvider owns the `<html>` classes.

## 2b. MEASURE before you judge (a class can be silently dropped)

Eyeballing a full-page thumbnail hides the most damaging failure: a token class that **never reached the DOM**. Real case: `cn()` runs tailwind-merge, which did not know the custom `text-display-*` scale, classified it as a text COLOR, saw it conflict with `text-primary`, and dropped the size — so "oversized" stat numbers rendered at base size and the whole page read flat while every checklist item still "passed".

So assert the computed values, don't trust the classes:

```js
const sizes = await page.evaluate(() =>
  [...document.querySelectorAll('[class*="text-display-"]')].map((el) => ({
    cls: [...el.classList].find((c) => c.startsWith("text-display-")),
    px: parseFloat(getComputedStyle(el).fontSize),
    font: getComputedStyle(el).fontFamily.split(",")[0],
  })),
);
```
- Every `text-display-*` element must be **well above body size** (at 1440: `display-2xl` ≈ 84px, `display-xl` ≈ 64px, `display-lg` ≈ 45px). Anything landing near 16px means the class was dropped — fix the merge config, not the markup.
- `font` must be the committed display face, not the admin font.
- Count the elements you expect: if the selector finds fewer than the page's headings + stat numbers, a class was stripped somewhere.

Also assert the layered-composition and breakout invariants:
```js
const layout = await page.evaluate(() => ({
  satellites: document.querySelectorAll("[data-composition-satellite]").length,
  overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
}));
```
- At 1440, `satellites` ≥ 2 (the hero is a layered `<ProductComposition>`, not a flat frame — premium bar #9). Zero means the composition collapsed or was never used.
- At **375**, `overflow` must be `true` (`scrollWidth <= clientWidth`). Breakouts (`Band`/`Breakout`, `bleed` sections) are the new horizontal-overflow risk — this is the deterministic check for it.
- Note: 768 is below the `md` breakpoint (960px), so the 768 shot shows the satellites' MOBILE chip row under the frame, not the overlapping desktop layout — that is correct, not a bug.

## 3. Judge (Read every screenshot — actually look)

Verdict each item PASS/FAIL with the screenshot as evidence:

1. **Evidence above the fold** — the `-fold.png` shows product media (ProductFrame/DataViz/screenshot), not text+buttons only.
2. **≥2 archetypes beyond the centered stack** — visible in the full-page shot (split hero, zig-zag rows, bento, stat band...).
3. **Background changes ≥2×** along the full-page shot — no flat single-color void.
4. **Density at 1440** — no viewport-height stretch of the full-page shot >50% empty.
5. **Reveals all fired** — after the scripted scroll, no invisible/blank section anywhere in the full-page shot.
6. **Display typography** — headings are clearly the committed display font, not the admin font.
7. **Harmonic palette** — at least two hues beyond primary, consistently mapped; dark shots stay legible (borders, muted text).
8. **Mobile (375)** — no horizontal scroll, no overlapping/clipped text, media scales.

9. **Nothing is a stock component with new text.** The failure this skill exists to catch: the page passes every item above and still looks like the template, because the mid/lower sections reused generic components while only the hero got real craft. Ask of every section: is the visual here *specific to this product*, or would it appear unchanged on any SaaS page? A section whose only visual is a small lonely icon in a tall empty card FAILS — give it real evidence (a domain visual, an oversized number) or merge it away.
10. **Layered hero** — the fold shot shows floating satellite chips overlapping the frame (a composition), not a single flat rectangle. Confirmed numerically by the `satellites ≥ 2` measurement above.
11. **Breakout present** — the full-page shot has one angled band or edge-bleeding media; the page is not a stack of centered containers.
12. **Real imagery when available** — if `public/images/marketing/` has assets, the page uses `<ProductShot>` (not a placeholder). When it has none (the template itself), the layered placeholder frame is correct — do not fail this.
13. **Ambient motion + reduced-motion pass** — in the normal capture something breathes (a floated chip offset between two shots, stat numbers mid-count); in the `reducedMotion: "reduce"` pass EVERYTHING is static AND fully visible (no chip stuck invisible, no un-drawn chart).

## 4. Close the loop

- Report the verdict table to the user (one line per item, with the failing screenshot named).
- FAIL items: fix under the `marketing-page` skill rules (STRICT direction — fix the page, don't restyle the system), then re-capture and re-judge. Do not report "done" with open FAILs.
- Clean up: screenshots stay in the scratchpad; nothing from this skill is committed.

## Degraded mode (no browser available)

Say so explicitly, then do the best static pass: `npm run build` must succeed; re-read the page against the premium bar checklist in code; list the items that could NOT be visually verified and ask the user to eyeball the page once. Never silently claim visual verification that didn't happen.
