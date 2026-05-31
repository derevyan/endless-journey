/**
 * Plugin Definitions Barrel Export
 *
 * Import this module to trigger self-registration of all plugin definitions.
 * Add new plugin definitions here as they are created.
 *
 * @example
 * ```ts
 * // Import to trigger registration side effects
 * import "@/features/nodes/journey/plugins/definitions";
 *
 * // Or import specific definitions
 * import { followUpPluginFrontendDescriptor } from "@/features/nodes/journey/plugins/definitions";
 * ```
 *
 * @module plugins/definitions
 */

// Follow-up plugin (Phase 1)
export { followUpPluginFrontendDescriptor } from "./follow-up";

// Future plugins added here:
// export { analyticsPluginDefinition } from "./analytics";
// export { rateLimitPluginDefinition } from "./rate-limit";
