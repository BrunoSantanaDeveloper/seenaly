import { inngest } from "@flyee/jobs";

import { runBackup } from "./index";

/** Nightly logical backup — 03:00 UTC, one run at a time. */
export const backupCronFunction = inngest.createFunction(
  { id: "backup-run-cron", retries: 1, concurrency: { limit: 1 } },
  { cron: "0 3 * * *" },
  async ({ step }) =>
    step.run("run-backup", async () => {
      const result = await runBackup({ trigger: "cron" });
      if (!result.ok) throw new Error(result.hint);
      return result;
    }),
);

/** On-demand run, requested from /admin/backups. */
export const backupManualFunction = inngest.createFunction(
  { id: "backup-run-manual", retries: 1, concurrency: { limit: 1 } },
  { event: "backup/run.requested" },
  async ({ step }) =>
    step.run("run-backup", async () => {
      const result = await runBackup({ trigger: "manual" });
      if (!result.ok) throw new Error(result.hint);
      return result;
    }),
);

export const backupFunctions = [backupCronFunction, backupManualFunction];
