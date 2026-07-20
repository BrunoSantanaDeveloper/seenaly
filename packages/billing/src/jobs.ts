import { createServiceClient } from "@flyee/auth/service";
import { inngest } from "@flyee/jobs";

import { grantMonthlyCredits } from "./credits";

/**
 * Monthly credit refill for recurring paid plans.
 *
 * Runs daily and is idempotent per org per month (see grantMonthlyCredits), so
 * a subscription that becomes active mid-month is topped up on the next run,
 * and re-runs are safe. Read/write with the service role: the credit RPCs are
 * membership-gated and cannot run in a session-less cron.
 */
export const billingMonthlyCredits = inngest.createFunction(
  { id: "billing-monthly-credits", retries: 1, concurrency: { limit: 1 } },
  { cron: "TZ=America/Sao_Paulo 0 4 * * *" },
  async ({ step }) =>
    step.run("grant-monthly-credits", async () => {
      const supabase = createServiceClient();
      return grantMonthlyCredits(supabase);
    }),
);

export const billingFunctions = [billingMonthlyCredits];
