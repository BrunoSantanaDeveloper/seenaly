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
        .select("id, org_id, product_id, created_by, created_at")
        .lte("next_review_at", now)
        .is("review_notified_at", null)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Listing due diagnoses failed: ${error.message}`);
      if (!due?.length) return { due: 0, notified: 0 };

      // A product may have several due rows; only its most recent diagnosis is
      // still "current" — older ones are superseded and get stamped silently.
      const currentByProduct = new Map<string, (typeof due)[number]>();
      for (const row of due) {
        if (!currentByProduct.has(row.product_id)) currentByProduct.set(row.product_id, row);
      }

      // If an even newer (not-yet-due) diagnosis exists for the product, the
      // user already moved on — don't nag about the older one.
      const productIds = [...currentByProduct.keys()];
      const { data: latest } = await supabase
        .from("diagnoses")
        .select("id, product_id, created_at")
        .in("product_id", productIds)
        .order("created_at", { ascending: false });
      const latestIdByProduct = new Map<string, string>();
      for (const row of latest ?? []) {
        if (!latestIdByProduct.has(row.product_id)) latestIdByProduct.set(row.product_id, row.id);
      }

      // Product names make the notification specific ("Curso X: hora de reavaliar").
      const { data: products } = await supabase.from("products").select("id, name").in("id", productIds);
      const productName = new Map((products ?? []).map((p) => [p.id, p.name as string]));

      let notified = 0;
      for (const [productId, row] of currentByProduct) {
        if (latestIdByProduct.get(productId) !== row.id) continue; // superseded

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
        const name = productName.get(productId);
        const result = await notifyUsers(recipients, {
          type: "system",
          title: "Hora de reavaliar um diagnóstico",
          body: name
            ? `${name}: revise o diagnóstico e registre o que mudou desde a última leitura.`
            : "Revise o diagnóstico e registre o que mudou desde a última leitura.",
          href: "/diagnosis",
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
