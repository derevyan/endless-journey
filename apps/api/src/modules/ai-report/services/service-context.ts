/**
 * AI Report Service Context
 *
 * @module modules/ai-report/services/service-context
 */

import type { DbClient } from "@journey/db";

/**
 * Context required by ai-report service functions.
 */
export interface AiReportServiceContext {
  /** Database client for queries */
  db: DbClient;
  /** Organization ID for access control */
  organizationId: string;
}
