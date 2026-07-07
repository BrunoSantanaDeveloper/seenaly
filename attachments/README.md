# attachments/ — project input inbox

Drop zone for material the user hands to the project (brand art, page imagery, briefs, reference docs). It is **input waiting to be routed** — not documentation, not a permanent home. Agents move every file to its canonical location and this folder trends back to empty (only this README stays).

## Contract

1. When a task touches related work — and always during `/init-project` — check this folder first.
2. Route with `git mv` to the canonical home below; never leave copies behind.
3. Large binaries must not LIVE here (git history bloat): route or delete promptly.

## Routing table

| Material | Canonical home |
|---|---|
| Brand master art (logo SVG or PNG ≥1024, optional dark variant) | `packages/content/brand/` (cross-platform source of truth) → derivatives are GENERATED from it into `apps/web/public/favicon/`, `apps/web/public/favicon.ico`, `apps/web/public/images/email/`, `apps/mobile/assets/` (see `/init-project` brand-assets actions) |
| Final logo SVGs (wordmark + compact mark) | inlined into `apps/web/src/components/logo/logo.tsx` (keep the token-tinting contract documented there) |
| Page/marketing imagery (heroes, product screenshots, illustrations) | `apps/web/public/images/…` next to where the page uses it |
| Product brief / PRD | `docs/PRODUCT.md` (+ ~10-line summary in the root `CLAUDE.md`) |
| Reference documents meant for the AI knowledge base | not repo files — ingest via `/admin/knowledge` (chunked + embedded), then delete from here |
| Fonts | wired via `next/font` in `apps/web` (license permitting), file next to its consumer |

Anything that fits no row: ask the user where it belongs before inventing a location.
