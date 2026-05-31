/**
 * CRM Module
 *
 * Public API for the CRM domain (pipelines, stages, clients, messages).
 * Provides complete CRM functionality for managing customer relationships.
 *
 * @module modules/crm
 */

// Routes
export { crm } from "./routes";
export { clientsRouter } from "./routes/clients";
export { pipelinesRouter } from "./routes/pipelines";
export { stagesRouter } from "./routes/stages";
export { fieldsRouter } from "./routes/fields";

// Services (for cross-module use)
export * from "./services";
