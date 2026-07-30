import { type DueReviewRow, type LatestRow, selectDueReviewTargets } from "@/lib/diagnosis/review-select";
import { notifyUsers } from "@/lib/notifications";
import { createServiceClient } from "@flyee/auth/service";
import { inngest } from "@flyee/jobs";

/**
 * Daily review-due reminder: the diagnosis loop only compounds if the user
 * comes back to re-read and record what changed. Each diagnosis carries a
 * next_review_at (set from the model's next_review_days); when it falls due we
 * ping the person who ran it — or the org's owners — via the header bell.
 *
 * Session-less, so it reads/writes with the service role (the notification
 * insert already does). Idempotent: every due row is stamped review_notified_at
 * in the same run, whether or not it was the one we notified about, so a
 * superseded diagnosis never nags and nothing fires twice.
 */
export const diagnosisReviewReminders = inngest.createFunction(
  { id: "diagnosis-review-reminders", retries: 1, concurrency: { limit: 1 } },
  { cron: "TZ=America/Sao_Paulo 0 9 * * *" },
  async ({ step }) =>
    step.run("notify-due-diagnoses", async () => {
      const supabase = createServiceClient();
      const now = new Date().toISOString();

      const { data: due, error } = await supabase
        .from("diagnoses")
        .select("id, org_id, product_id, scope, created_by, created_at")
        .lte("next_review_at", now)
        .is("review_notified_at", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Listing due diagnoses failed: ${error.message}`);
      if (!due?.length) return { due: 0, notified: 0 };

      // Supersession is per product AND scope (selectDueReviewTargets): a
      // newer campaign diagnosis must not suppress a due readiness reminder —
      // they are different conversations about the same product.
      const productIds = [...new Set(due.map((row) => row.product_id as string))];
      const { data: latest } = await supabase
        .from("diagnoses")
        .select("id, product_id, scope, created_at")
        .in("product_id", productIds)
        .order("created_at", { ascending: false });
      const targets = selectDueReviewTargets(due as DueReviewRow[], (latest ?? []) as LatestRow[]);

      // Product names make the notification specific ("Curso X: hora de reavaliar").
      const { data: products } = await supabase.from("products").select("id, name").in("id", productIds);
      const productName = new Map((products ?? []).map((p) => [p.id, p.name as string]));

      let notified = 0;
      for (const row of targets) {
        // Recipients: whoever ran it; fall back to the org's owners/admins.
        let recipients: string[] = row.created_by ? [row.created_by] : [];
        if (recipients.length === 0) {
          const { data: owners } = await supabase
            .from("memberships")
            .select("user_id")
            .eq("org_id", row.org_id)
            .in("role", ["owner", "admin"]);
          recipients = (owners ?? []).map((m) => m.user_id as string);
        }
        const name = productName.get(row.product_id);
        // Scope-aware copy/route: a readiness verdict re-checks STRUCTURE at
        // its own surface; every other scope keeps the original wording.
        // (pt-BR by platform precedent — notification rows store rendered text.)
        const isReadiness = row.scope === "readiness";
        const result = await notifyUsers(recipients, {
          type: "system",
          title: isReadiness ? "Hora de reconferir a prontidão" : "Hora de reavaliar um diagnóstico",
          body: isReadiness
            ? name
              ? `${name}: refaça a verificação de prontidão e registre o que mudou na estrutura.`
              : "Refaça a verificação de prontidão e registre o que mudou na estrutura."
            : name
              ? `${name}: revise o diagnóstico e registre o que mudou desde a última leitura.`
              : "Revise o diagnóstico e registre o que mudou desde a última leitura.",
          href: isReadiness ? `/products/${row.product_id}/readiness` : "/diagnosis",
        });
        if (result.sent) notified += 1;
      }

      // Stamp every due row (current + superseded) so none fires again.
      const { error: stampError } = await supabase
        .from("diagnoses")
        .update({ review_notified_at: now })
        .in(
          "id",
          due.map((r) => r.id),
        );
      if (stampError) throw new Error(`Stamping reminders failed: ${stampError.message}`);

      return { due: due.length, notified };
    }),
);

export const diagnosisFunctions = [diagnosisReviewReminders];
