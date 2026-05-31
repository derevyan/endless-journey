/**
 * Tags Module
 *
 * Public API for the tags domain.
 * Includes both user tag assignments and tag definitions (registry).
 *
 * @module modules/tags
 */

// Routes
export { tags } from "./routes/user-tags";
export { tagDefinitions } from "./routes/definitions";

// Services (for cross-module use)
export * from "./services";
