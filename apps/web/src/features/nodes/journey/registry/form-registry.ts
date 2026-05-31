/**
 * Form Registry
 *
 * Registry for node form handlers - parallels nodeRegistry pattern.
 * Stores schema, extractor, and builder for each node type.
 *
 * This eliminates switch statements in use-node-editor-form.ts by providing
 * a centralized, type-safe registry for form handling.
 *
 * @module features/nodes/journey/registry/form-registry
 */

import type { JourneyNode, NodeType } from "@/features/nodes/journey/react-flow-types";
import { FormRegistry, type FormHandlers as SharedFormHandlers } from "@/features/nodes/shared/form-registry";

/**
 * Form handlers for a specific node type.
 *
 * - schema: Zod schema for validation
 * - extract: Function to extract form values from node data
 * - build: Function to build node data from validated form values
 *
 * Extraction flow convention:
 * 1) Type-specific core fields are extracted first
 * 2) Capability-based fields from fieldRegistry are layered on top
 * 3) Capability values take precedence on conflicts
 */
export type FormHandlers = SharedFormHandlers<JourneyNode, Record<string, unknown>, Record<string, unknown>>;

/**
 * Singleton form registry instance.
 * Import this and use formRegistry.register() to register form handlers.
 */
export const formRegistry = new FormRegistry<NodeType, JourneyNode, Record<string, unknown>, Record<string, unknown>>();
