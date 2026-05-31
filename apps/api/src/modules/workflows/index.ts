/**
 * Workflows Module
 *
 * Public API for the workflows domain.
 * Provides workflow CRUD, versions, and approvals management.
 *
 * @module modules/workflows
 */

// Routes
export { workflows } from "./routes";
export { workflowVersions } from "./routes/versions";
export { workflowApprovalsRouter } from "./routes/approvals";

// Services (for cross-module use)
export * from "./services";
