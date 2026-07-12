/**
 * Capture the demo dashboard routes as REAL product imagery for the marketing
 * layer. Writes light + `-dark` PNG pairs into public/images/marketing/, which
 * <ProductShot> renders. Derived projects re-run this after branding — same
 * filenames, nothing else changes.
 *
 * Usage:
 *   npm run dev                                  # in one terminal
 *   npm run shots:marketing -w @flyee/web        # in another
 *
 * Env:
 *   BASE_URL        dev server origin (default http://localhost:3000)
 *   PLAYWRIGHT_DIR  node_modules dir that has playwright, when it is not
 *                   installed in this repo (playwright is intentionally NOT a
 *                   repo dependency; a CI/agent session installs it elsewhere).
 *
 * Degrades gracefully: if playwright cannot be resolved it prints the install
 * one-liner and exits 0; if the dev server is down it exits 1 with a hint.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../public/images/marketing");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// Route → output basename. These demo dashboards are the template's own
// "product" until a derived project ships its real screens.
const ROUTES = {
  "/dashboards/analytics": "dashboard-analytics",
  "/dashboards/visual": "dashboard-visual",
  "/pages/ecommerce": "page-ecommerce",
  "/applications/ai-chat/new-chat": "app-ai-chat",
};

function resolvePlaywright() {
  const candidates = [];
  if (process.env.PLAYWRIGHT_DIR) candidates.push(join(process.env.PLAYWRIGHT_DIR, "playwright"));
  candidates.push("playwright");
  for (const id of candidates) {
    try {
      return require(require.resolve(id, { paths: [process.cwd(), HERE] }));
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function serverUp() {
  try {
    const res = await fetch(BASE_URL, { redirect: "manual" });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function main() {
  const playwright = resolvePlaywright();
  if (!playwright) {
    console.warn(
      [
        "⚠ playwright not found — skipping screenshot capture (this is not a repo dependency).",
        "  Install it in a scratch dir and re-run with PLAYWRIGHT_DIR:",
        "    npm i --prefix /tmp/pw playwright && npx --prefix /tmp/pw playwright install chromium",
        "    PLAYWRIGHT_DIR=/tmp/pw/node_modules npm run shots:marketing -w @flyee/web",
      ].join("\n"),
    );
    process.exit(0);
  }

  if (!(await serverUp())) {
    console.error(`✖ Dev server not reachable at ${BASE_URL}. Start it first: npm run dev`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await playwright.chromium.launch();

  for (const [route, name] of Object.entries(ROUTES)) {
    for (const scheme of ["light", "dark"]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      await page.emulateMedia({ colorScheme: scheme });
      const response = await page.goto(BASE_URL + route, { waitUntil: "networkidle", timeout: 120000 });
      const landed = new URL(page.url()).pathname;
      if (landed.startsWith("/auth") || (response && response.status() >= 400)) {
        console.warn(
          `  ↳ ${route} redirected to ${landed} (auth?) — skipping. Capture while signed in or without auth.`,
        );
        await page.close();
        continue;
      }
      await page.waitForTimeout(2500); // let charts settle
      const file = join(OUT_DIR, `${name}${scheme === "dark" ? "-dark" : ""}.png`);
      await page.screenshot({ path: file }); // viewport clip, not fullPage
      console.log(`  ✓ ${route} (${scheme}) → ${file.replace(process.cwd(), ".")}`);
      await page.close();
    }
  }

  await browser.close();
  console.log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
