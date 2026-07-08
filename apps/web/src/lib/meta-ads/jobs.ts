import { createServiceClient } from "@flyee/auth/service";
import { inngest } from "@flyee/jobs";

/**
 * Daily fan-out: queue one sync per active Meta Ads connection whose org has
 * an active subscription. The per-connection work runs in the shared
 * `connectors/connection.sync` function (packages/connectors/jobs). Churned
 * orgs are skipped here so we never sync data a customer no longer pays for.
 *
 * Subscriptions are read directly (not via org_entitlements, whose membership
 * check rejects the session-less service role); `active` mirrors that RPC:
 * status in (trialing, active) and not admin_suspended.
 */
export const metaAdsDailySync = inngest.createFunction(
  { id: "meta-ads-daily-sync" },
  { cron: "TZ=America/Sao_Paulo 0 6 * * *" },
  async ({ step }) => {
    const supabase = createServiceClient();

    const { data: connections, error } = await supabase
      .from("connections")
      .select("id, org_id")
      .eq("provider", "meta-ads")
      .neq("status", "disabled");
    if (error) throw new Error(`Listing meta-ads connections failed: ${error.message}`);
    if (!connections?.length) return { connections: 0, queued: 0 };

    const orgIds = [...new Set(connections.map((c) => c.org_id))];
    const { data: subs, error: subsError } = await supabase
      .from("subscriptions")
      .select("org_id")
      .in("org_id", orgIds)
      .eq("admin_suspended", false)
      .in("status", ["trialing", "active"]);
    if (subsError) throw new Error(`Listing subscriptions failed: ${subsError.message}`);
    const activeOrgs = new Set((subs ?? []).map((s) => s.org_id));

    const due = connections.filter((c) => activeOrgs.has(c.org_id)).map((c) => c.id);
    if (due.length > 0) {
      await step.sendEvent(
        "fan-out-meta-ads-sync",
        due.map((connectionId) => ({ name: "connectors/connection.sync" as const, data: { connectionId } })),
      );
    }
    return { connections: connections.length, queued: due.length };
  },
);

export const metaAdsFunctions = [metaAdsDailySync];
