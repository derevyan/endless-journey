/**
 * Section Registry (Unified)
 *
 * Single registry for all node editor sections.
 * Sections are filtered by node capabilities and optional scope.
 *
 * Sections self-register on import using the singleton pattern.
 *
 * @module features/nodes/journey/registry/section-registry
 */

import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

import { createLogger } from "@journey/logger";
import type { NodeCapabilities } from "@journey/schemas";

import type { NodeEditorFormApi } from "../forms/form-types";
import type { JourneyNode, JourneyEdge } from "../react-flow-types";

const log = createLogger("section-registry");

// =============================================================================
// SECTION PROP TYPES
// =============================================================================

/**
 * Unified props passed to all editor sections.
 * Supports both capability-based and feature-based section patterns.
 */
export interface SectionProps {
  /** TanStack Form instance */
  form: NodeEditorFormApi;
  /** Node ID being edited */
  nodeId: string;
  /** Read-only mode */
  readOnly?: boolean;

  // Capability-based section props (optional)
  /** Current node being edited - for capability-based sections */
  node?: JourneyNode;
  /** Whether section is expanded - for externally-managed collapse state */
  open?: boolean;
  /** Callback when expansion changes - for externally-managed collapse state */
  onOpenChange?: (open: boolean) => void;

  // Feature-based section props (optional)
  /** Journey UUID - for fetching journey-scoped data */
  journeyId?: string | null;
  /** All nodes in journey - for graph traversal (e.g., tag accumulation) */
  nodes?: JourneyNode[];
  /** All edges in journey - for graph traversal */
  edges?: JourneyEdge[];

  // Validation error props
  /** Validation errors from form-level validation (path -> message) */
  validationErrors?: Map<string, string>;
}

/**
 * Unified section definition for registry.
 * Supports both capability-based and feature-based section discovery.
 */
export interface SectionDefinition {
  /** Unique section identifier */
  id: string;
  /** Display label (shown in section header or for debugging) */
  label: string;
  /** The section component */
  component: ComponentType<SectionProps>;
  /** Order priority (lower = renders first) */
  order: number;

  // Section visibility
  /** Callback to determine if section renders */
  shouldRender?: (node: JourneyNode, capabilities: NodeCapabilities) => boolean;

  /** Icon shown in collapsed header (capability-based sections) */
  icon?: LucideIcon;

  /** Optional scope to separate common vs node-specific sections */
  scope?: SectionScope;
}

export type SectionScope = "common" | "node";

// =============================================================================
// SECTION ORDER CONSTANTS
// =============================================================================

/**
 * Standard section ordering.
 * Use these constants for consistent ordering across sections.
 *
 * Sections are ordered from top to bottom of the editor panel.
 */
export const SectionOrder = {
  /** Content sections (text, media) - shown first */
  CONTENT: 10,
  /** Media section */
  MEDIA: 15,
  /** Buttons/interactions */
  BUTTONS: 20,
  /** Timer section */
  TIMER: 30,
  /** Follow-up sequence */
  FOLLOW_UP: 35,
  /** Response capture */
  RESPONSE: 40,
  /** Variables section */
  VARIABLES: 50,
  /** Tags section */
  TAGS: 55,
  /** CRM actions */
  CRM: 60,
  /** Webhook/integration */
  WEBHOOK: 70,
  /** Conditions/logic */
  CONDITIONS: 80,
  /** Metadata/notes - shown last */
  METADATA: 100,
} as const;

// =============================================================================
// REGISTRY IMPLEMENTATION
// =============================================================================

class SectionRegistry {
  private sections = new Map<string, SectionDefinition>();

  /**
   * Register a section definition.
   * Called on module import (side effect).
   */
  register(def: SectionDefinition): void {
    if (this.sections.has(def.id)) {
      // Expected in React Strict Mode (double-invokes module side effects in dev)
      log.debug({ sectionId: def.id, label: def.label }, "sectionRegistry:duplicateRegistration:skipped");
      return;
    }
    this.sections.set(def.id, def);
  }

  /**
   * Unregister a section.
   * Useful for HMR during development.
   */
  unregister(id: string): void {
    this.sections.delete(id);
  }

  /**
   * Get section by ID.
   */
  get(id: string): SectionDefinition | undefined {
    return this.sections.get(id);
  }

  /**
   * Get sections for capability-based discovery.
   * Returns sections whose shouldRender callback returns true.
   */
  getSectionsForNode(
    node: JourneyNode,
    capabilities: NodeCapabilities,
    scope: SectionScope = "node"
  ): SectionDefinition[] {
    return Array.from(this.sections.values())
      .filter((section) => (section.scope ?? "node") === scope)
      .filter((section) => section.shouldRender?.(node, capabilities))
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get all registered sections (sorted by order).
   */
  getAll(): SectionDefinition[] {
    return Array.from(this.sections.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Check if a section is registered.
   */
  has(id: string): boolean {
    return this.sections.has(id);
  }

  /**
   * Get number of registered sections.
   */
  get size(): number {
    return this.sections.size;
  }

  /**
   * Clear all registered sections.
   * Useful for testing.
   */
  clear(): void {
    this.sections.clear();
  }
}

/** Singleton registry instance */
export const sectionRegistry = new SectionRegistry();
