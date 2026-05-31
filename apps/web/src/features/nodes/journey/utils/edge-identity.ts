/**
 * Edge Identity Utilities
 *
 * Centralized logic for generating and parsing edge IDs.
 * Uses static classes for clean, discoverable API.
 *
 * Edge types:
 * - ManagedEdgeId: Button connections (stored in journey.edges)
 * - Plugin edges: See plugin-edge-identity.ts for plugin attachment,
 *   button, and exit edge formats
 *
 * All use `::` as delimiter for robust parsing (IDs may contain hyphens).
 */

import { isPluginEdge } from "./plugin-edge-identity";

/**
 * Managed Edge ID for button connections
 * Format: managed-btn::{nodeId}::{buttonId}
 *
 * These edges are stored in journey.edges and auto-synced with button targets.
 */
export class ManagedEdgeId {
  static readonly PREFIX = "managed-btn::";

  /**
   * Create a managed edge ID for a button connection
   */
  static create(nodeId: string, buttonId: string): string {
    return `${this.PREFIX}${nodeId}::${buttonId}`;
  }

  /**
   * Check if an edge ID is a managed button edge
   */
  static is(edgeId: string): boolean {
    return edgeId.startsWith(this.PREFIX);
  }

  /**
   * Parse a managed edge ID to extract node and button IDs
   */
  static parse(edgeId: string): { nodeId: string; buttonId: string } | null {
    if (!this.is(edgeId)) return null;

    const rest = edgeId.slice(this.PREFIX.length);
    const separatorIndex = rest.indexOf("::");

    if (separatorIndex === -1) return null;

    const nodeId = rest.slice(0, separatorIndex);
    const buttonId = rest.slice(separatorIndex + 2);

    if (!nodeId || !buttonId) return null;

    return { nodeId, buttonId };
  }
}

/**
 * Check if an edge is any kind of managed edge (stored, auto-synced with node data)
 */
export function isManagedEdge(edgeId: string): boolean {
  return ManagedEdgeId.is(edgeId) || isPluginEdge(edgeId);
}
