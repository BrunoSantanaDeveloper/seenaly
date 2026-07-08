# Seenaly — Monorepo

AI Growth Intelligence Platform para tráfego pago e funis de venda: copiloto de Growth para Meta Ads, criativos e funis. Derived from the flyee template (`template` git remote) — pull base improvements with the `/update-from-template` skill.

Product language: pt-BR is the default locale (catalogs also ship de/en/es/fr).

## Product (full definition: `docs/PRODUCT.md`)

Decision Intelligence applied to Meta Ads, creatives and sales funnels: the system **analyzes, diagnoses and recommends** — it never operates campaigns for the user. Core principles: the heart is the *product context model* (offer, margin, target CAC, funnel...), not the AI; every recommendation must cite campaign data + product context + platform rules (nothing generic) and follow a fixed structured format (diagnosis / evidence / technical basis / hypothesis / action / risk / confidence / success criterion); knowledge is tiered by trust level 1–5 (official Meta docs → courses/opinions), matching `packages/knowledge`. Five pillars: Meta Ads knowledge base, campaign data sync, funnel/real-sales layer, tagged creative library, diagnostic engine — plus the key differentiator: **experiment memory**. Initial scope: Meta Ads copilot for digital products / self-service offers. The Meta Ads doc corpus lives in `docs/meta_ads/` (own capture pipeline in `_tools/`); `npm run knowledge:ingest` loads it into the global `meta-ads-docs` collection (needs Supabase + `GEMINI_API_KEY`). Roadmap phases in `docs/PRODUCT.md`.

## Structure

- `apps/web` — Next.js 15 (App Router) + MUI v9 + MUI X Premium + Tailwind 4, deployed on Vercel. See `apps/web/CLAUDE.md`.
  - **Marketing layer**: public site at `app/(marketing)` (home, /pricing, /about, /contact, /legal) built from `components/marketing/*` primitives (Section/Container/SectionHeader/Reveal), GSAP motion, per-page SEO + sitemap/robots. Design/copy playbook: `.claude/skills/marketing-page`. Site identity centralized in `apps/web/src/brand.ts` (re-export of `@flyee/content`).
- `packages/design-tokens` — design system source of truth (CSS tokens + generated TS mirror). Seenaly runs a single locked palette: `theme-orange` (primary `#FE4F18`, backgrounds `#F6F5F1` light / `#171B1C` dark), light+dark modes; the runtime theme-color switcher is removed. Includes `css/marketing.css`. See `packages/design-tokens/README.md`.
- `packages/db` — Drizzle schema + SQL migrations with RLS (multi-tenant: organizations/memberships/invites). See `packages/db/README.md`.
- `packages/auth` — Supabase auth clients (browser/server/middleware). Degrades gracefully when Supabase env vars are absent. 2FA (TOTP): enroll at `/settings/security`; the middleware forces the AAL2 step-up at `/auth/two-factor` for enrolled users.
- `packages/email` — Resend + React Email templates (server-only). No-ops without `RESEND_API_KEY`; callers must offer a fallback. ACTIVE at launch (transactional email + contact form via `CONTACT_FORM_TO`).
- `packages/billing` — ACTIVE: per-org subscriptions (recurring or credits), add-on modules, coupons, trials; Stripe + Asaas behind one `PaymentProvider` interface. Superadmin console at `/admin/billing`; customer page at `/settings/billing`. See `packages/billing/README.md`.
- `packages/ai` — ACTIVE: instruction-driven assistants (superadmin-managed rows): Anthropic/Gemini/OpenRouter behind a `ChatProvider` interface, image+audio attachments, credits debited per message. Console at `/admin/ai`; chat wired at `/applications/ai-chat/new-chat`. See `packages/ai/README.md`.
- `packages/knowledge` — ACTIVE: knowledge base with trust levels + pgvector RAG; Gemini embeddings; ingestion via Inngest with inline fallback. Superadmin console at `/admin/knowledge`; assistants opt in via `config.knowledge`. See `packages/knowledge/README.md`.
- `packages/connectors` — ACTIVE: framework for per-org connections to external APIs (Seenaly's target: Meta Ads). Implement `Connector`s and register them in `apps/web/src/lib/connectors.ts`; service-role-only secret storage; sync via Inngest; customer UI at `/settings/connections`. See `packages/connectors/README.md`.
- `packages/jobs` — Inngest client + typed event map for background jobs/cron. Functions live in the owning package's `src/jobs.ts`; all served by `apps/web` at `/api/inngest`. `sendEvent` never throws — callers must fall back to inline processing. See `packages/jobs/README.md`.
- `packages/content` — site identity (`BRAND`) + i18n message catalogs (`messages/{de,en,es,fr,pt-BR}.json`), consumed by web via next-intl. Brand master art lives in `packages/content/brand/`; derivatives (favicons, email logo, logo component artwork) are generated from it.
- `attachments/` — input inbox: the user drops project material here (brand art, page imagery, briefs); agents route each file to its canonical home per `attachments/README.md` and the folder trends back to empty.
- Inert (kept for clean template merges, no env keys configured): `packages/documents`, `packages/audit`, `packages/transcribe`, `packages/whatsapp`. Never delete `packages/*`.
- `apps/mobile` was pruned at init; the `/add-mobile` skill restores it from the template remote if ever needed.

## Golden rules

- Visual identity (colors, themes, shadows, radii) changes ONLY in `packages/design-tokens/css/*.css` (`common.css` + `orange.css`). Never hardcode theme values in the app.
- After changing token CSS, run `npm run tokens:generate` and commit the updated `tokens.generated.ts` together.
- Icon set: Nexture (`@/icons/nexture/ni-*`). Never import an icon library directly in pages.
- Shared code lives in `packages/*`, never inside `apps/web` when another consumer is plausible.
- npm workspaces: always install dependencies from the root (`npm install`), never inside an app.

## Commands (root)

- `npm run dev` / `build` / `lint:fix` — delegate to `apps/web`
- `npm run typecheck` — apps/web with its pinned TypeScript 5.8 (never run a bare root `npx tsc`: it picks the hoisted TS 6)
- `npm run tokens:generate` — regenerate the TS token mirror

## Platform (confirmed decisions)

- Deploy: Vercel. Database/auth/storage: Supabase (Postgres + RLS, Auth, Storage; pgvector for RAG). ORM: Drizzle (`packages/db`).
- Auth model: multi-tenant organizations (default template model).
- Billing: Stripe/Asaas behind an interface (`packages/billing`). Email: Resend + React Email (`packages/email`). Jobs/cron: Inngest (`packages/jobs`). AI: Anthropic/Gemini/OpenRouter behind a provider interface (`packages/ai`).
- Do not reintroduce Cloudflare-specific services (Workers, D1, R2, Workers AI).

This repo stays **private**: the UI layer contains commercially licensed template code (plus the MUI X Premium license).
