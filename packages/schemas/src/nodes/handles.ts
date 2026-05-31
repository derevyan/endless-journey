/**
 * Node Handle Definitions
 *
 * Explicit handle metadata for node input/output connections.
 * Used by node descriptors to document supported edge handles.
 */

/**
 * Single handle definition (input or output).
 */
export interface HandleDefinition {
  /** Handle identifier (matches edge sourceHandle or targetHandle) */
  id: string;
  /** Optional display label */
  label?: string;
  /** Optional condition hint for when the handle is active */
  condition?: string;
}

/**
 * Node handle configuration (inputs/outputs).
 */
export interface NodeHandleConfig {
  inputs: HandleDefinition[];
  outputs: HandleDefinition[];
}

