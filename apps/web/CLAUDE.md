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

- Routes live in `src/app/(marketing)/` (home `/`, `/pricing`, `/about`, `/contact`, `/legal/*`) with their own chrome — no admin layout. Each new public route must be added to `PUBLIC_PREFIXES` (`src/middleware.ts`) and `src/app/sitemap.ts`.
- Pages compose the primitives in `src/components/marketing/` (`Section`/`Container`/`SectionHeader`; sections like Hero, FeatureGrid, PricingSection) — never hand-tuned spacing/widths. See that folder's README and the `marketing-page` skill (load it before building/editing public pages).
- Display typography: `font-display text-display-{2xl,xl,lg,md}` (fluid clamp scale from `@flyee/design-tokens/css/marketing.css`).
- Motion: GSAP only inside marketing client components via `<Reveal>`/`useGSAP` (transforms + `autoAlpha`, honors `prefers-reduced-motion`); never in admin code.
- Public pricing reads plans through `@flyee/billing/public` (`listPublicPlans`, service-role, read-only) with i18n placeholder fallback; the contact form sends via `@flyee/email` (`CONTACT_FORM_TO`) with a graceful not-configured hint.

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
