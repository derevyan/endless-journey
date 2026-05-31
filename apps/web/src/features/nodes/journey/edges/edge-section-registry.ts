/**
 * Edge Section Registry
 *
 * Registry pattern for edge editor sections. Sections self-register on import,
 * enabling dynamic section discovery for edge editing.
 *
 * Similar to section-registry.ts but specialized for edges rather than nodes.
 *
 * @module features/nodes/journey/edges/edge-section-registry
 */

import type { LucideIcon } from "lucide-react";
import { createLogger } from "@journey/logger";
import type { JourneyEdge, JourneyNode } from "../react-flow-types";

const log = createLogger("edge-section-registry");

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props passed to edge section components.
 */
export interface EdgeSectionProps {
  /** Current edge being edited */
  edge: JourneyEdge;
  /** Form field value (type depends on section) */
  value: unknown;
  /** Callback when value changes */
  onChange: (value: unknown) => void;
  /** Read-only mode (disables inputs) */
  readOnly?: boolean;
  /** Journey nodes for variable resolution */
  nodes?: JourneyNode[];
  /** Journey edges for variable resolution */
  edges?: JourneyEdge[];
  /** Journey ID for fetching journey/global variables */
  journeyId?: string | null;
}

/**
 * Edge section definition for registry.
 */
export interface EdgeSectionDefinition {
  /** Unique identifier for the section */
  id: string;
  /** Display label shown in section header */
  label: string;
  /** Description shown below label */
  description?: string;
  /** Icon shown in section header */
  icon: LucideIcon;
  /** Sort order (lower = higher priority, shown first) */
  order: number;
  /** Form field name this section manages */
  fieldName: string;
  /** Determines when this section should render */
  shouldRender: (edge: JourneyEdge, sourceNode?: JourneyNode) => boolean;
  /** Section component to render */
  component: React.ComponentType<EdgeSectionProps>;
}

/**
 * Edge section with computed render status.
 */
export interface ResolvedEdgeSection extends EdgeSectionDefinition {
  /** Whether the section should currently render */
  shouldShow: boolean;
}

// =============================================================================
// REGISTRY CLASS
// =============================================================================

/**
 * Registry for edge editor sections.
 *
 * Sections self-register on import using the singleton pattern.
 *
 * @example
 * ```tsx
 * // In a section file (e.g., guard-section.tsx)
 * edgeSectionRegistry.register({
 *   id: "guard",
 *   label: "Guard Condition",
 *   icon: Shield,
 *   order: 10,
 *   fieldName: "guard",
 *   shouldRender: (edge) => true,
 *   component: GuardSectionAdapter,
 * });
 *
 * // In the edge editor component
 * const sections = edgeSectionRegistry.getSectionsForEdge(edge);
 * ```
 */
class EdgeSectionRegistry {
  private sections = new Map<string, EdgeSectionDefinition>();

  /**
   * Register a section. Called on module import.
   *
   * @param section - Section definition to register
   */
  register(section: EdgeSectionDefinition): void {
    if (this.sections.has(section.id)) {
      log.warn({ sectionId: section.id, label: section.label }, "edgeSectionRegistry:duplicateRegistration");
    }
    this.sections.set(section.id, section);
  }

  /**
   * Unregister a section.
   * Useful for HMR (Hot Module Replacement) during development.
   *
   * @param id - Section ID to unregister
   */
  unregister(id: string): void {
    this.sections.delete(id);
  }

  /**
   * Get sections that should render for an edge.
   * Filters by shouldRender and sorts by order.
   *
   * @param edge - Current edge being edited
   * @param sourceNode - Optional source node for context
   * @returns Array of section definitions that should render
   */
  getSectionsForEdge(edge: JourneyEdge, sourceNode?: JourneyNode): EdgeSectionDefinition[] {
    return [...this.sections.values()]
      .filter((section) => section.shouldRender(edge, sourceNode))
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get all registered sections with render status.
   *
   * @param edge - Current edge being edited
   * @param sourceNode - Optional source node for context
   * @returns Array of sections with shouldShow computed
   */
  getAllWithStatus(edge: JourneyEdge, sourceNode?: JourneyNode): ResolvedEdgeSection[] {
    return [...this.sections.values()]
      .map((section) => ({
        ...section,
        shouldShow: section.shouldRender(edge, sourceNode),
      }))
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get all registered sections.
   * Returns sections sorted by order.
   *
   * @returns Array of all registered section definitions
   */
  getAll(): EdgeSectionDefinition[] {
    return [...this.sections.values()].sort((a, b) => a.order - b.order);
  }

  /**
   * Get a section by ID.
   *
   * @param id - Section ID
   * @returns Section definition or undefined
   */
  get(id: string): EdgeSectionDefinition | undefined {
    return this.sections.get(id);
  }

  /**
   * Check if a section is registered.
   *
   * @param id - Section ID
   * @returns Whether the section exists
   */
  has(id: string): boolean {
    return this.sections.has(id);
  }

  /**
   * Get the number of registered sections.
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

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global edge section registry instance.
 * Import and use this in section files for registration.
 */
export const edgeSectionRegistry = new EdgeSectionRegistry();

// =============================================================================
// EDGE SECTION ORDER CONSTANTS
// =============================================================================

/**
 * Standard edge section ordering.
 * Use these constants for consistent ordering across sections.
 */
export const EdgeSectionOrder = {
  /** Guard condition */
  GUARD: 10,
  /** Fallback toggle */
  FALLBACK: 20,
  /** Metadata/notes */
  METADATA: 100,
} as const;
