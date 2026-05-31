/**
 * Field Registry
 *
 * Provides declarative field definitions for auto-building and auto-extracting
 * form values from node data. Eliminates manual mapping code by registering
 * field behavior once and applying it consistently across node types.
 *
 * Key features:
 * - Auto-extract: Pull form values from node data based on field definitions
 * - Auto-build: Convert form values back to node data
 * - hasValue: Check if a field has content (for conditional UI rendering)
 * - Capability-aware: Uses node capabilities to determine field applicability
 *
 * FieldRegistry is intended for common, capability-based fields shared across
 * multiple node types (timer, tags, variables, CRM). Node-specific fields are
 * handled by type-specific extractors in node-form-extractors.ts.
 *
 * @module nodes/forms/field-registry
 */

import type { NodeType, NodeCapabilities } from "@journey/schemas";
import { getNodeCapabilities } from "@journey/schemas";
import { createLogger } from "@journey/logger";
import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";

const log = createLogger("field-registry");

// =============================================================================
// TYPES
// =============================================================================

/**
 * Represents the shape of form values for node editing.
 * This is a generic record since different nodes have different fields.
 */
export type FormState = Record<string, unknown>;

/**
 * Represents the shape of node data.
 * This is a generic record since different nodes have different data structures.
 */
export type NodeData = Record<string, unknown>;

/**
 * Definition for a form field.
 *
 * Each field definition describes:
 * - Which capability it requires (from NodeCapabilities)
 * - How to extract its value from node data
 * - How to build node data from form values
 * - How to check if it has a value set
 */
export interface FieldDefinition {
  /** Unique identifier for this field (e.g., "timer", "media", "buttons") */
  id: string;

  /** The capability this field requires (e.g., "hasTimer") */
  capability: keyof NodeCapabilities;

  /**
   * Extract form values from node data.
   * Returns partial form state with this field's values.
   *
   * @param node - The journey node to extract from
   * @returns Partial form state containing this field's values
   */
  extract: (node: JourneyNode) => Partial<FormState>;

  /**
   * Build node data from form values.
   * Returns partial node data with this field's values.
   *
   * @param form - The form state to build from
   * @returns Partial node data containing this field's values
   */
  build: (form: FormState) => Partial<NodeData>;

  /**
   * Check if this field has a value set.
   * Used for conditional UI rendering (e.g., expanding collapsed sections).
   *
   * @param node - The journey node to check
   * @returns Whether the field has a value
   */
  hasValue: (node: JourneyNode) => boolean;
}

// =============================================================================
// FIELD REGISTRY CLASS
// =============================================================================

/**
 * Registry for form field definitions.
 *
 * Usage:
 * ```ts
 * // Register a field
 * fieldRegistry.register({
 *   id: "timer",
 *   capability: "hasTimer",
 *   extract: (node) => extractTimerFields(node),
 *   build: (form) => buildTimerFields(form),
 *   hasValue: (node) => hasTimerSet(node),
 * });
 *
 * // Get fields for a node type
 * const fields = fieldRegistry.getFieldsForNodeType("message");
 *
 * // Extract all values
 * const formState = fieldRegistry.extractAll(node);
 *
 * // Build node data
 * const nodeData = fieldRegistry.buildAll("message", formState);
 * ```
 */
class FieldRegistry {
  private fields = new Map<string, FieldDefinition>();

  /**
   * Register a field definition.
   *
   * @param field - The field definition to register
   */
  register(field: FieldDefinition): void {
    if (this.fields.has(field.id)) {
      log.warn({ fieldId: field.id, capability: field.capability }, "fieldRegistry:duplicateRegistration");
    }
    this.fields.set(field.id, field);
  }

  /**
   * Unregister a field definition.
   *
   * @param fieldId - The field ID to unregister
   * @returns Whether the field was found and removed
   */
  unregister(fieldId: string): boolean {
    return this.fields.delete(fieldId);
  }

  /**
   * Get all registered field definitions.
   *
   * @returns Array of all field definitions
   */
  getAll(): FieldDefinition[] {
    return [...this.fields.values()];
  }

  /**
   * Get a specific field definition by ID.
   *
   * @param fieldId - The field ID to look up
   * @returns The field definition or undefined
   */
  get(fieldId: string): FieldDefinition | undefined {
    return this.fields.get(fieldId);
  }

  /**
   * Get fields applicable to a node type.
   * Filters fields based on the node type's capabilities.
   *
   * @param nodeType - The node type to get fields for
   * @returns Array of applicable field definitions
   */
  getFieldsForNodeType(nodeType: NodeType): FieldDefinition[] {
    const capabilities = getNodeCapabilities(nodeType);
    return [...this.fields.values()].filter(
      (field) => capabilities[field.capability]
    );
  }

  /**
   * Get fields applicable to a node.
   * Convenience method that extracts node type from the node.
   *
   * @param node - The journey node
   * @returns Array of applicable field definitions
   */
  getFieldsForNode(node: JourneyNode): FieldDefinition[] {
    return this.getFieldsForNodeType(node.data.type as NodeType);
  }

  /**
   * Extract all applicable field values from a node.
   *
   * @param node - The journey node to extract from
   * @returns Form state with all applicable field values
   */
  extractAll(node: JourneyNode): FormState {
    const fields = this.getFieldsForNode(node);
    const result: FormState = {};

    for (const field of fields) {
      const extracted = field.extract(node);
      Object.assign(result, extracted);
    }

    return result;
  }

  /**
   * Build node data from form values for a node type.
   *
   * @param nodeType - The node type to build for
   * @param form - The form state to build from
   * @returns Node data with all applicable field values
   */
  buildAll(nodeType: NodeType, form: FormState): NodeData {
    const fields = this.getFieldsForNodeType(nodeType);
    const result: NodeData = {};

    for (const field of fields) {
      const built = field.build(form);
      Object.assign(result, built);
    }

    return result;
  }

  /**
   * Check which fields have values set in a node.
   *
   * @param node - The journey node to check
   * @returns Map of field IDs to whether they have values
   */
  checkAllHasValue(node: JourneyNode): Map<string, boolean> {
    const fields = this.getFieldsForNode(node);
    const result = new Map<string, boolean>();

    for (const field of fields) {
      result.set(field.id, field.hasValue(node));
    }

    return result;
  }

  /**
   * Check if a specific field has a value in a node.
   *
   * @param node - The journey node to check
   * @param fieldId - The field ID to check
   * @returns Whether the field has a value, or undefined if field not found/applicable
   */
  hasValue(node: JourneyNode, fieldId: string): boolean | undefined {
    const field = this.fields.get(fieldId);
    if (!field) return undefined;

    // Check if this field is applicable to the node type
    const capabilities = getNodeCapabilities(node.data.type as NodeType);
    if (!capabilities[field.capability]) return undefined;

    return field.hasValue(node);
  }

  /**
   * Get field IDs that have values set in a node.
   * Useful for determining which sections to expand in the UI.
   *
   * @param node - The journey node to check
   * @returns Array of field IDs that have values
   */
  getFieldsWithValues(node: JourneyNode): string[] {
    const valueMap = this.checkAllHasValue(node);
    return [...valueMap.entries()]
      .filter(([, hasValue]) => hasValue)
      .map(([id]) => id);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global field registry instance.
 *
 * @example
 * ```ts
 * import { fieldRegistry } from "@/features/nodes/journey/forms/field-registry";
 *
 * // Register fields (typically done at module load)
 * fieldRegistry.register(timerField);
 * fieldRegistry.register(mediaField);
 *
 * // Use in components
 * const formState = fieldRegistry.extractAll(selectedNode);
 * const nodeData = fieldRegistry.buildAll(nodeType, formValues);
 * ```
 */
export const fieldRegistry = new FieldRegistry();

// =============================================================================
// FIELD DEFINITION HELPERS
// =============================================================================

/**
 * Create a field definition with type safety.
 * Helper function that ensures proper typing.
 *
 * @param def - The field definition
 * @returns The same definition (type-narrowed)
 */
export function defineField(def: FieldDefinition): FieldDefinition {
  return def;
}

/**
 * Create multiple field definitions and register them.
 *
 * @param definitions - Array of field definitions
 */
export function registerFields(definitions: FieldDefinition[]): void {
  for (const def of definitions) {
    fieldRegistry.register(def);
  }
}
