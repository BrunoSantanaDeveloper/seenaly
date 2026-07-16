# Seenaly Web (apps/web)

Next.js 15 (App Router) + React 19 — Seenaly's web app (admin + public marketing site).

## Stack and conventions

- **UI**: MUI v9 is the base — before building a component from scratch, check for an existing MUI or MUI X equivalent (DataGrid Premium, Charts Pro, Date Pickers Pro, Tree View are already installed). Icons: individual named imports from `@mui/icons-material`.
- **Styling**: MUI theme driven by CSS variables (`hsl(var(--token))`) defined in `@flyee/design-tokens`. MUI component overrides live in `src/style/**/*.css` (organized by category), inside CSS layers (`theme, base, mui, components, utilities`). Tailwind 4 only for layout utilities; classes merged with `tailwind-merge`.
- **Themes**: single locked palette `theme-orange` × light/dark, switched via classes on `<html>` (`theme-orange dark`) by the `ThemeProvider` (`src/theme/theme-provider.tsx`). The theme-color switcher was removed at init; only the light/dark mode toggle remains.
- **Forms**: Formik + Yup.
- **i18n**: next-intl — every UI string goes through messages, never hardcoded. Default locale: `pt-BR`; available: `de,en,es,fr,pt-BR`; catalogs live in `packages/content/messages/`; public-site copy lives in the `marketing` namespace.
- **Path alias**: `@/*` → `./src/*`.
- **Brand**: site identity (name, tagline, siteUrl, favicon paths) comes from `@flyee/content` (`src/brand.ts` is a re-export shim); the logo is the single component `src/components/logo/logo.tsx` (used by admin AND marketing chrome).

## Marketing layer (public site)

- Routes live in `src/app/(marketing)/` (home `/`, `/pricing`, `/about`, `/contact`, `/help`, `/blog`, `/legal/*`) with their own chrome — no admin layout. Each new public route must be added to `PUBLIC_PREFIXES` (`src/middleware.ts`) and `src/app/sitemap.ts`.
- `/help` and `/blog` render DB-managed content (superadmin writes it in `/admin/help` and `/admin/blog`) through `src/lib/public-content.ts` (anon client, published rows only, locale with EN fallback); the sitemap includes their published slugs and degrades to the static list without Supabase env. Markdown renders via `components/marketing/markdown-prose.tsx` (react-markdown, raw HTML ignored).
- Pages compose the primitives in `src/components/marketing/` (`Section`/`Container`/`SectionHeader`; sections like Hero, FeatureGrid, PricingSection) — never hand-tuned spacing/widths. See that folder's README and the `marketing-page` skill (load it before building/editing public pages).
- Display typography: `font-display text-display-{2xl,xl,lg,md}` (fluid clamp scale from `@flyee/design-tokens/css/marketing.css`).
- Motion: GSAP only inside marketing client components via `<Reveal>`/`useGSAP` (transforms + `autoAlpha`, honors `prefers-reduced-motion`); never in admin code.
- Public pricing reads plans through `@flyee/billing/public` (`listPublicPlans`, service-role, read-only) with i18n placeholder fallback; the contact form sends via `@flyee/email` (`CONTACT_FORM_TO`) with a graceful not-configured hint.

## Platform admin & account

- Superadmin area at `src/app/(dashboard)/admin`: `layout.tsx` is a server gate on `profiles.is_superadmin` (RLS remains the real defense); the Admin menu group renders only for superadmins (`hooks/use-is-superadmin.ts`). Consoles: `/admin` (metrics via `admin_metrics()`), `/admin/organizations` (tenants + users; ban/unban, 2FA state and 2FA reset need `SUPABASE_SERVICE_ROLE_KEY`), `/admin/billing`, `/admin/ai`, `/admin/knowledge`, `/admin/audit` (audit_events + access_events + wa_messages), `/admin/insights`, `/admin/backups`, `/admin/announcements`, `/admin/help`, `/admin/blog`. Admin console UI is intentionally EN-only (platform operator surface); everything user-facing stays i18n.
- Every mutation records an audit event through `lib/audit.ts` (`recordAudit`) — keep that up when adding admin/tenant writes. Sign-ins are logged automatically by a DB trigger (migration 0016); users see their own in `/settings/security`.
- `/admin/insights` (`api/admin/insights/route.ts`): the model writes SQL from an `information_schema` catalog and each statement executes inside a postgres-js `sql.begin("read only", …)` transaction with a 5s `statement_timeout` — **the read-only transaction is the safety boundary, not the prompt**. Every executed query is audited and shown in the UI. Needs `DATABASE_URL` + one AI provider key; degrades to a 503 hint otherwise.
- `/admin/backups` (`@flyee/backup`): nightly Inngest cron + "Run backup now" (falls back to an inline run without Inngest keys, bounded by the function timeout). Archives land in the private `backups` bucket; downloads are service-role signed URLs.
- Real account plumbing: header bell reads the `notifications` table (create rows server-side with `lib/notifications.ts` or DB triggers — see migration 0012); announcements banner in the dashboard layout (per-user dismissal); `/settings` edits the real profile (display name + avatar → `avatars` bucket, migration 0013) and credentials (email/password); the user menu shows the real session and signs out for real.
- Floating quick-support widget (`components/support/support-widget.tsx`, mounted in both layouts) reads `BRAND.support` from `@flyee/content` — configure WhatsApp/email there; it renders nothing until a human channel is set.
- Cookie consent + analytics (`components/consent/cookie-consent.tsx`, mounted in both layouts; `lib/analytics.ts`): the template ships NO analytics provider, so the banner never renders (essential cookies are consent-exempt). Derived projects assign `ANALYTICS_PROVIDER` (PostHog/Plausible/GA4… behind the `AnalyticsProvider` interface) — that single assignment activates the banner, and the SDK's `init()` runs only after the user grants consent. Bump `CONSENT_VERSION` on material privacy-policy changes to re-ask. Projects needing durable acceptance records can additionally call `recordConsent` (`@flyee/audit`) for signed-in users.

## Commands (run from the monorepo root)

- `npm run dev` — dev server with turbopack
- `npm run build` — production build
- `npm run lint:fix` / `npm run prettier` — lint and formatting

## Auth

- Supabase via `@flyee/auth` (`client`/`server`/`middleware` entry points). `src/middleware.ts` refreshes the session and protects everything except `/` and the public prefixes (`/auth`, `/verify`, `/pricing`, `/about`, `/contact`, `/legal`).
- Without `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` the middleware no-ops and auth screens show a configuration hint — a fresh clone stays browsable.
- Signup metadata (`display_name`, `company`) drives profile + first organization creation in the database trigger (`packages/db/migrations/0000_init.sql`).

## Watch out

- `src/style/global.css` imports tokens from `@flyee/design-tokens/css/*` — do not recreate tokens locally.
- Deployment target is Vercel (native Next.js runtime).
- Server-only secrets (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) must never reach client components.
