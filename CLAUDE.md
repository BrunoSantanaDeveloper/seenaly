# Seenaly — Monorepo

AI Growth Intelligence Platform para tráfego pago e funis de venda: copiloto de Growth para Meta Ads, criativos e funis. Derived from the flyee template (`template` git remote) — pull base improvements with the `/update-from-template` skill.

Product language: pt-BR is the default locale (catalogs also ship de/en/es/fr).

## Product (full definition: `docs/PRODUCT.md`)

Decision Intelligence applied to Meta Ads, creatives and sales funnels: the system **analyzes, diagnoses and recommends** — it never operates campaigns for the user. Core principles: the heart is the *product context model* (offer, margin, target CAC, funnel...), not the AI; every recommendation must cite campaign data + product context + platform rules (nothing generic) and follow a fixed structured format (diagnosis / evidence / technical basis / hypothesis / action / risk / confidence / success criterion); knowledge is tiered by trust level 1–5 (official Meta docs → courses/opinions), matching `packages/knowledge`. **Maturity spectrum (architectural invariant): value is never gated behind a connected Meta account** — the system serves the zero-data beginner (guided from step 0 by product context + knowledge) through the data-rich enterprise, degrading gracefully; the Meta connection enriches, it is not a prerequisite. Five pillars: Meta Ads knowledge base, campaign data sync, funnel/real-sales layer, tagged creative library, diagnostic engine — plus the key differentiator: **experiment memory**. Initial scope: Meta Ads copilot for digital products / self-service offers. Two knowledge corpora: `docs/meta_ads/` (captured official Meta docs, own pipeline in `_tools/`, trust 1) and `docs/growth/` (authored CRO/checkout/offer playbook, synthesized with source attribution — never verbatim third-party text; per-doc trust, editorial model in its README). `npm run knowledge:ingest` loads both into the global `meta-ads-docs` / `growth-playbook` collections (needs Supabase + `GEMINI_API_KEY`; `-- --corpus=<slug>` to ingest one). Roadmap phases in `docs/PRODUCT.md`.

**Organic Growth (optional add-on):** native Decision Intelligence for organic content, never a separate social-media application.
- Reuses products, offers, funnels, `creatives`, diagnoses, knowledge and experiment memory; no parallel library or domain copies.
- Etapa 0 is a Concierge Beta: one product + declared Instagram account/period + standardized CSV, with no OAuth dependency.
- Manual imports are first-class, idempotent and provenance-tagged; connectors enrich later, beginning with Instagram in Etapa 1.
- AI classifies funnel stage, intent, narrative, theme, hook and CTA; human corrections always prevail.
- Comparisons stay within equivalent cohorts, and raw metrics from different networks are never ranked as equivalents.
- Recommendations use the canonical schema plus context, priority, effort, impact, sources, `insufficient_data` and `missing_data`.
- Three recommendations and an organic→paid candidate are required only when evidence is sufficient; otherwise collection guidance is the valid result.
- The Review closes the loop through export, usefulness feedback and conversion of recommendations into existing experiments.
- Scheduling, publishing, inbox, automatic replies, media editing and causal attribution are out of scope; full contract and roadmap live in `docs/PRODUCT.md`.

## Structure

- `apps/web` — Next.js 15 (App Router) + MUI v9 + MUI X Premium + Tailwind 4, deployed on Vercel. See `apps/web/CLAUDE.md`.
  - **Product layer** (authenticated app, `app/(dashboard)`): screens are goal-first, never defaulted to CRUD tables. Reusable UX blocks in `components/product/*` (`EmptyState`, `OnboardingChecklist`, `ActivationProgress`, `SetupWizard`) backed by `packages/onboarding`. Quality is enforced deterministically, mirroring the marketing layer: the `product-screen` skill is loaded by a `PreToolUse` hook (`.claude/hooks/product-screen-guard.mjs`), a `PostToolUse` lint (`.claude/hooks/product-lint.mjs`) checks every written file against the product contract (no raw theme values, a11y names on icon controls/labels/switches, error-never-rendered-as-empty, no GSAP), and flows are verified end-to-end with the `product-verify` skill (walks the real journeys — dead ends, lost context, error≠empty, leftover demo surfaces — before a screen is declared done).
  - **Platform layer**: server-gated superadmin area at `app/(dashboard)/admin` (`profiles.is_superadmin` + RLS; layout gate + superadmin-only menu group) with consoles for real metrics (`admin_metrics()` RPC), organizations & users (suspend kill-switch; ban, 2FA visibility and 2FA reset via service role), billing, AI, knowledge, audit (audit trail + sign-in access log + WhatsApp), **data insights** (ask the database in plain language; the model's SQL runs in a Postgres `READ ONLY` transaction and is shown with the answer), **backups** (`packages/backup`), announcements, help center and blog. Account plumbing is real, not mock: header notification bell (`notifications` table + `lib/notifications.ts`), dismissible system announcements, profile/account settings (avatar storage bucket), floating quick-support widget configured in `BRAND.support` (WhatsApp/email; hidden until a channel is set).
  - **Marketing layer**: public site at `app/(marketing)` (home, /pricing, /about, /contact, /help, /blog, /legal — /help and /blog serve DB-managed content written in the admin consoles, locale-aware with EN fallback via `lib/public-content.ts`) built from `components/marketing/*` primitives (Section/Container/SectionHeader/Reveal + premium archetypes: FeatureRows/BentoGrid/StatBand/ProductFrame/DataVizPlaceholder), GSAP motion, per-page SEO + sitemap/robots. The committed visual direction is persisted in `docs/DESIGN.md` and is STRICT (inherited by every new page/edit/section; redesign only on explicit request). Quality is enforced deterministically: a `PreToolUse` hook (`.claude/hooks/marketing-guard.mjs`) loads the `marketing-page` skill and injects a digest of the component catalog (`components/marketing/catalog.json`), and a `PostToolUse` lint (`.claude/hooks/marketing-lint.mjs`) checks every written file against the marketing contract (tokens, i18n, icon alias, SEO, library composition). Site identity centralized in `apps/web/src/brand.ts` (re-export of `@flyee/content`).
- `packages/design-tokens` — design system source of truth (CSS tokens + generated TS mirror). Seenaly runs a single locked palette: `theme-orange` (primary `#FE4F18`, backgrounds `#F6F5F1` light / `#171B1C` dark), light+dark modes; the runtime theme-color switcher is removed. Includes `css/marketing.css` (fluid display type scale, section rhythm, motion tokens). See `packages/design-tokens/README.md`.
- `packages/db` — Drizzle schema + SQL migrations with RLS (multi-tenant: organizations/memberships/invites). See `packages/db/README.md`.
- `packages/auth` — Supabase auth clients (browser/server/middleware). Degrades gracefully when Supabase env vars are absent. 2FA (TOTP): enroll at `/settings/security`; the middleware forces the AAL2 step-up at `/auth/two-factor` for enrolled users.
- `packages/email` — Resend + React Email templates (server-only). No-ops without `RESEND_API_KEY`; callers must offer a fallback. ACTIVE at launch (transactional email + contact form via `CONTACT_FORM_TO`).
- `packages/billing` — ACTIVE: per-org subscriptions (recurring or credits), add-on modules, coupons, trials; Stripe + Asaas behind one `PaymentProvider` interface. Superadmin console at `/admin/billing`; customer page at `/settings/billing`. See `packages/billing/README.md`.
- `packages/ai` — ACTIVE: instruction-driven assistants (superadmin-managed rows): Anthropic/Gemini/OpenRouter behind a `ChatProvider` interface, image+audio attachments, credits debited per message. Console at `/admin/ai`; chat wired at `/applications/ai-chat/new-chat`. See `packages/ai/README.md`.
- `packages/knowledge` — ACTIVE: knowledge base with trust levels + pgvector RAG; Gemini embeddings; ingestion via Inngest with inline fallback. Superadmin console at `/admin/knowledge`; assistants opt in via `config.knowledge`. See `packages/knowledge/README.md`.
- `packages/connectors` — ACTIVE: framework for per-org connections to external APIs (Seenaly's target: Meta Ads). Implement `Connector`s and register them in `apps/web/src/lib/connectors.ts`; service-role-only secret storage; sync via Inngest; customer UI at `/settings/connections`. See `packages/connectors/README.md`.
- `packages/jobs` — Inngest client + typed event map for background jobs/cron. Functions live in the owning package's `src/jobs.ts`; all served by `apps/web` at `/api/inngest`. `sendEvent` never throws — callers must fall back to inline processing. See `packages/jobs/README.md`.
- `packages/audit` — ACTIVE: compliance layer — append-only `audit_events` (wired by default across every mutation the template ships — call `recordAudit` from `apps/web/src/lib/audit.ts`), `access_events` sign-in trail (trigger on `auth.sessions`, migration 0022), immutable row versioning (opt-in per table), versioned consent terms + acceptances. See `packages/audit/README.md`.
- `packages/backup` — ACTIVE: automatic logical backups — every `public` table exported to gzipped JSONL in the private `backups` bucket, nightly via Inngest cron plus on-demand from `/admin/backups`, with retention pruning. Data only (no DDL) — Supabase's native backups/PITR remain the disaster-recovery layer. See `packages/backup/README.md`.
- `packages/fields` — pure validators/formatters/masks for semantic form fields (phone, CPF/CNPJ, CEP, currency; persist digits, never masks) + `AddressLookupProvider` interface with ViaCEP as the built-in BR provider (lookup failure degrades to manual entry, never blocks the form). Zero deps, shared web/mobile; the MUI field components live in `apps/web/src/components/product/fields/`. See `packages/fields/README.md`.
- `packages/onboarding` — activation mechanism for onboarding checklists / setup wizards: persists completed steps, dismissal and the activation moment (`onboarding_state`, migration 0011); step definitions stay in the derived project's code. Powers completion-drive UX. See `packages/onboarding/README.md`.
- `packages/organic-growth` — pure domain engine for Concierge CSV parsing, taxonomy validation, comparable cohorts, explainable scores and deterministic Organic Growth Reviews. It contains no tenant or provider I/O; the web layer persists its outputs in the Organic Growth tables.
- `packages/content` — site identity (`BRAND`) + i18n message catalogs (`messages/{de,en,es,fr,pt-BR}.json`), consumed by web via next-intl. Brand master art lives in `packages/content/brand/`; derivatives (favicons, email logo, logo component artwork) are generated from it.
- `attachments/` — input inbox: the user drops project material here (brand art, page imagery, briefs); agents route each file to its canonical home per `attachments/README.md` and the folder trends back to empty.
- Inert (kept for clean template merges, no env keys configured): `packages/documents`, `packages/transcribe`, `packages/whatsapp`. Never delete `packages/*`.
- `apps/mobile` was pruned at init; the `/add-mobile` skill restores it from the template remote if ever needed.

## Golden rules

- Visual identity (colors, themes, shadows, radii) changes ONLY in `packages/design-tokens/css/*.css` (`common.css` + `orange.css`). Never hardcode theme values in the app.
- After changing token CSS, run `npm run tokens:generate` and commit the updated `tokens.generated.ts` together.
- Icon set: Nexture (`@/icons/nexture/ni-*`). Never import an icon library directly in pages.
- Shared code lives in `packages/*`, never inside `apps/web` when another consumer is plausible.
- npm workspaces: always install dependencies from the root (`npm install`), never inside an app.

## Shared Claude/Codex harness

- `CLAUDE.md`, `apps/*/CLAUDE.md`, `.claude/rules/*`, `.claude/skills/*` and `.claude/hooks/*` are the canonical shared sources. Do not maintain a second hand-written Codex copy.
- Codex reads the generated `AGENTS.md` mirror and generated `.agents/skills/*` discovery bridges. `.codex/config.toml` points its lifecycle hooks at the same implementations under `.claude/hooks/`.
- `PostToolUse` automatically runs `scripts/sync-agent-harness.mjs` after canonical harness edits. `npm run harness:check` and `npm run harness:test` are also enforced by the pre-commit hook.
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
