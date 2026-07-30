import { runPageSpeed } from "./pagespeed";

import { logAuditEvent } from "@flyee/audit";
import { createServiceClient } from "@flyee/auth/service";
import { inngest } from "@flyee/jobs";

/**
 * PageSpeed enrichment for a persisted scan (docs/PRODUCT.md phase 7 — the
 * deferred "CWV via API oficial", closed).
 *
 * Why a job: PSI regularly takes 10–25s, far beyond what a user-facing server
 * action should hold open. The scan action inserts the row with
 * result.psi = {status:'pending'} and fires this event; the UI shows the
 * pending state and refreshes.
 *
 * Session-less, so it reads/writes with the service role — which is also the
 * ONLY way to update product_scans (the table is append-only under RLS by
 * design; this enrichment completes the same observation event, it never
 * rewrites the read signals). Idempotent: a row whose psi is already 'ok' is
 * left alone, so Inngest retries can never overwrite a finished measurement.
 */
export const readinessPageSpeed = inngest.createFunction(
  { id: "readiness-pagespeed", retries: 2, concurrency: { limit: 2 } },
  { event: "readiness/pagespeed.requested" },
  async ({ event, step }) =>
    step.run("measure-pagespeed", async () => {
      const supabase = createServiceClient();
      const { data: scan, error } = await supabase
        .from("product_scans")
        .select("id, org_id, final_url, requested_url, ok, result, created_by")
        .eq("id", event.data.scanId)
        .maybeSingle();
      if (error) throw new Error(`Loading scan failed: ${error.message}`);
      if (!scan || scan.ok !== true) return { skipped: "no-successful-scan" };

      const result = (scan.result ?? {}) as Record<string, unknown>;
      const existing = result.psi as { status?: string } | undefined;
      if (existing?.status === "ok") return { skipped: "already-measured" };

      const url = (scan.final_url as string | null) ?? (scan.requested_url as string);
      if (!url) return { skipped: "no-url" };

      const psi = await runPageSpeed(url);
      const { error: updateError } = await supabase
        .from("product_scans")
        .update({ result: { ...result, psi } })
        .eq("id", scan.id);
      if (updateError) throw new Error(`Persisting PSI failed: ${updateError.message}`);

      // Attribute the audit row to whoever requested the scan (a service
      // client has no session, so recordAudit() would silently skip).
      if (scan.created_by) {
        await logAuditEvent(supabase, {
          orgId: scan.org_id as string,
          actorId: scan.created_by as string,
          action: "readiness.pagespeed_measured",
          entityType: "product_scan",
          entityId: scan.id as string,
          metadata: { status: psi.status },
        });
      }
      return { status: psi.status };
    }),
);

export const readinessFunctions = [readinessPageSpeed];
