/**
 * Node Label Utilities
 *
 * Pure utility functions for working with node labels.
 * Used by validation logic to check for reserved prefixes and sanitize labels.
 *
 * @module schemas/validation/node-label
 */

/**
 * Reserved key prefixes for internal node output storage.
 * User node labels should not start with these prefixes to avoid collisions.
 */
export const RESERVED_NODE_OUTPUT_PREFIXES = ["__state_", "node_"] as const;

/**
 * Sanitize node label to valid key
 *
 * Removes special characters and replaces with underscores.
 * Ensures consistent, valid property names for dot notation access.
 *
 * @param label - Node label to sanitize
 * @returns Sanitized key (e.g., "Get Customer" → "Get_Customer")
 *
 * @example
 * ```ts
 * sanitizeNodeLabel("Get Customer");     // "Get_Customer"
 * sanitizeNodeLabel("API Call (v2)");    // "API_Call_v2"
 * sanitizeNodeLabel("Validate User!");   // "Validate_User"
 * ```
 */
export function sanitizeNodeLabel(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, ""); // Trim leading/trailing underscores
}
