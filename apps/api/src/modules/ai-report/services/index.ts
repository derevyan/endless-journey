/**
 * AI Report Services
 *
 * @module modules/ai-report/services
 */

export type { AiReportServiceContext } from "./service-context";

// Core service functions
export {
  generateReport,
  getSessionJourneyId,
  type GenerateReportParams,
  type GenerateReportResult,
} from "./ai-report-service";

// State derivation helpers (exported for testing)
export { deriveContextFromInteractions, deriveTagsFromInteractions } from "./ai-report-service";
