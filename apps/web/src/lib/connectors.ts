/**
 * Connector registration point. Derived projects register their external
 * API connectors here so every server context (settings actions, Inngest
 * functions) sees the same registry — see packages/connectors/README.md.
 */
import { metaAdsConnector } from "./meta-ads/connector";

import { registerConnector } from "@flyee/connectors";

registerConnector(metaAdsConnector);
