/**
 * CRM Services Index
 *
 * Re-exports all CRM service modules for convenient importing.
 * This replaces the old services/crm/index.ts
 *
 * @module modules/crm/services
 */

export { ApiCrmService } from "./api-crm-service";
export { createCrmEngineAdapter } from "./engine-adapter";
export {
  buildActivityDescription,
  getCrmEventTypes,
  mapActivityTypesToEventTypes,
  mapEventTypeToActivityType,
} from "./description-generator";
