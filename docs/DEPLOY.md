# Deploy — Vercel via GitHub Actions

Deploys are driven by `.github/workflows/deploy.yml`, using the Vercel CLI "prebuilt" flow:
the build runs on the GitHub runner (`vercel build`) and only the build output is uploaded
(`vercel deploy --prebuilt`). Vercel's own Git integration stays **disabled**
(`apps/web/vercel.json` → `git.deploymentEnabled: false`) so nothing deploys twice.

- **Pull request** → quality gate (harness check, typecheck, lint) + **preview** deploy. The URL lands in the job summary.
- **Push to `main`** → quality gate + **production** deploy.
- PRs from forks run the quality gate only (no access to secrets).

## One-time setup

### 1. Create/link the Vercel project

From the repo root:

```bash
npx vercel link
```

Pick the team/scope and a project name (e.g. `seenaly`). Then in the Vercel dashboard
(**Project → Settings**):

- **Root Directory**: `apps/web` (keep "Include source files outside of the Root Directory" enabled — the build needs the workspace `packages/*`).
- **Framework Preset**: Next.js (auto-detected).
- **Node.js Version**: 22.x (matches `.nvmrc`).
- Do **not** connect the GitHub repository (Git tab) — GitHub Actions is the only deploy path.

### 2. GitHub repository secrets

`npx vercel link` writes `.vercel/project.json` (gitignored) containing `orgId` and `projectId`.
Create a token at **Vercel → Account Settings → Tokens**, then add three secrets in
**GitHub → Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `VERCEL_TOKEN` | the token you created |
| `VERCEL_ORG_ID` | `orgId` from `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `projectId` from `.vercel/project.json` |

### 3. Environment variables on Vercel

App env vars live in **Vercel → Project → Settings → Environment Variables** (Production and
Preview) — `vercel pull` fetches them into the CI build. Mirror what `apps/web/.env` uses,
with `apps/web/.env.example` as the reference. Minimum for a real deployment:

- `NEXT_PUBLIC_MUI_X_LICENSE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL` (pooled, port 6543), `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CDN_URL`, `NEXT_PUBLIC_TITLE`, `NEXT_PUBLIC_STORAGE_PREFIX`, `ENV`

Optional per feature (all degrade gracefully when absent): billing (`STRIPE_*`, `ASAAS_*`),
AI (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`), jobs (`INNGEST_*`),
email (`RESEND_API_KEY`, `EMAIL_FROM`, `CONTACT_FORM_TO`), backups (`BACKUP_RETENTION_DAYS`),
WhatsApp (`WHATSAPP_*`, `EVOLUTION_*`).

## Notes

- **Database migrations are not part of the pipeline.** Apply them deliberately with
  `npm run db:migrate` before shipping a build that depends on them.
- The workflow installs `vercel@latest`; pin a major in the workflow if a CLI release ever breaks the flow.
- A build with no env vars still succeeds (the template degrades gracefully) — a preview
  deploy without Supabase keys is browsable but has no auth/data.
