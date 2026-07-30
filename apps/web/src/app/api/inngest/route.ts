import "@/lib/connectors";

import { diagnosisFunctions } from "@/lib/diagnosis/jobs";
import { metaAdsFunctions } from "@/lib/meta-ads/jobs";
import { readinessFunctions } from "@/lib/readiness/jobs";
import { backupFunctions } from "@flyee/backup/jobs";
import { billingFunctions } from "@flyee/billing/jobs";
import { connectorFunctions } from "@flyee/connectors/jobs";
import { inngest } from "@flyee/jobs";
import { serve } from "@flyee/jobs/next";
import { knowledgeFunctions } from "@flyee/knowledge/jobs";
import { transcribeFunctions } from "@flyee/transcribe/jobs";
import { whatsappFunctions } from "@flyee/whatsapp/jobs";

// Register every Inngest function exposed by packages/* and this app here.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    ...knowledgeFunctions,
    ...connectorFunctions,
    ...transcribeFunctions,
    ...whatsappFunctions,
    ...metaAdsFunctions,
    ...backupFunctions,
    ...billingFunctions,
    ...diagnosisFunctions,
    ...readinessFunctions,
  ],
});
