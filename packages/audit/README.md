# @flyee/audit

Compliance layer for projects handling sensitive data (LGPD, Lei 13.787-style requirements): audit trail, immutable row history and consent records. Row versioning and consents are **mechanism only** — the template marks no tables and defines no consent terms; each derived project opts in. The audit trail, by contrast, is **wired by default** (see below).

## 1. Audit events (`audit_events`)

Append-only by construction: RLS has insert + select policies and **no update/delete**. Org owners/admins (and superadmins) can read; anyone in the org can append their own actions. `orgId` is `null` for platform-level events (superadmin actions outside any tenant), which RLS admits through the superadmin branch.

```ts
import { logAuditEvent } from "@flyee/audit";
await logAuditEvent(supabase, { orgId, actorId: user.id, action: "patient.viewed", entityType: "patient", entityId });
```

Failures are returned, never thrown — auditing must not take the main flow down.

**In apps/web, call `recordAudit` (`src/lib/audit.ts`) instead** — it resolves the actor from the session and is fire-and-forget:

```ts
recordAudit(supabase, "org.member.role_changed", { orgId, entityType: "membership", entityId, metadata: { role } });
```

The template already records every mutation it ships: superadmin actions (`admin.user.banned` / `admin.user.mfa_reset` / `admin.org.suspended`, billing catalog, AI assistants, announcements, help, blog + comment moderation, `admin.insights.query`) and tenant actions (`org.updated`, `org.member.role_changed`, `org.member.removed`, `org.invite.created`, `org.invite.revoked`). Derived projects follow the same dotted-verb convention for their own writes. The trail is read in `/admin/audit`.

## 1b. Access log (`access_events`)

Sign-in trail: a security-definer trigger on `auth.sessions` copies every new session (user, IP, user-agent, AAL) into `public.access_events` — migration `0022_access_log.sql`, nothing to call from code. Users see their own history in `/settings/security` (Recent activity); the superadmin sees everything in `/admin/audit → Access`. Append-only: no insert/update/delete policies exist. If a Supabase project forbids triggers on the `auth` schema, drop the trigger and fall back to the dashboard's Auth logs — the table and its UI degrade to empty.

## 2. Immutable row versioning (`record_versions`)

A generic `audit_record_version()` trigger snapshots every INSERT/UPDATE/DELETE of marked tables (full row as jsonb + operation + `auth.uid()`). History is written via security definer and has **no write policies**: it cannot be edited or purged through the API.

Mark tables in the derived project's migrations:

```sql
select public.enable_row_versioning('public.patients');
select public.enable_row_versioning('public.anamnesis_records');
```

Requirements: the table has an `id uuid` primary key; an `org_id uuid` column (when present) scopes who may read its history (org owners/admins).

## 3. Consents (`consent_terms` / `consent_acceptances`)

Terms are versioned per slug (e.g. `treatment`, `audio-recording`, `ai-processing`); superadmins manage them. Acceptances record who consented (`subject_type` + `subject_id`, project-defined), which term version, when — and are revocable (`revoked_at`) but never deleted.

```ts
import { hasActiveConsent, recordConsent, revokeConsent } from "@flyee/audit";

if (!(await hasActiveConsent(supabase, { orgId, slug: "audio-recording", subjectType: "patient", subjectId }))) {
  // block the recording flow until consent is recorded
}
```

## Migrations

`packages/db/migrations/0005_audit.sql` (audit events, row versioning, consents) and `0022_access_log.sql` (access events). No env vars; no background jobs.
