/**
 * Plugin System Type Definitions
 *
 * Core types for the frontend plugin registry system.
 * Enables declarative plugin configuration instead of scattered switch statements.
 *
 * Key types:
 * - PluginHandle: Declarative handle configuration for connections
 * - PluginEdgeSpec: Expected edge specification for sync
 *
 * @module plugins/types
 */

import type { PluginData } from "@journey/schemas";

// =============================================================================
// HANDLE TYPES
// =============================================================================

/**
 * Plugin handle types for source connections
 */
export type PluginHandleType = "button" | "exit" | "output";

/**
 * Declarative handle configuration for plugin connections.
 * Used by plugin definitions to specify what handles to render.
 *
 * @example
 * ```ts
 * const handles: PluginHandle[] = [
 *   { type: "button", id: "step-0-btn-abc123", label: "Yes", targetNodeId: "node-1" },
 *   { type: "exit", id: "plugin-exit", targetNodeId: "node-2" },
 * ];
 * ```
 */
export interface PluginHandle {
  /** Handle type determines styling and behavior */
  type: PluginHandleType;
  /** Unique handle ID (used in edge sourceHandle) */
  id: string;
  /** Display label for the handle */
  label?: string;
  /** Connected target node ID (if connected) */
  targetNodeId?: string;
}

// =============================================================================
// EDGE TYPES
// =============================================================================

/**
 * Expected edge specification for plugin edge sync.
 * Plugins declare what edges should exist based on their data.
 *
 * @example
 * ```ts
 * const expectedEdges: PluginEdgeSpec[] = [
 *   { id: "plugin-btn::abc::0::def", sourceHandle: "step-0-btn-def", target: "node-1" },
 * ];
 * ```
 */
export interface PluginEdgeSpec {
  /** Deterministic edge ID */
  id: string;
  /** Source handle ID on the plugin node */
  sourceHandle: string;
  /** Target node ID */
  target: string;
  /** Edge label for display (e.g., "Step 1: Yes", "Exit") */
  label?: string;
}

// =============================================================================
// COLOR SCHEME
// =============================================================================

/**
 * Plugin color scheme for visual styling.
 * Matches the amber theme used by Wait/Timer nodes.
 */
export interface PluginColorScheme {
  /** Icon color class (e.g., "text-amber-600 dark:text-amber-400") */
  icon: string;
  /** Icon background class (e.g., "bg-amber-500/10") */
  iconBg: string;
  /** Border color for default state */
  borderDefault: string;
  /** Border color on hover */
  borderHover: string;
  /** Border color when selected */
  borderSelected: string;
  /** Shadow when selected */
  shadowSelected: string;
  /** Handle color */
  handle: string;
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

/**
 * Props passed to plugin addon components.
 * Rendered as compact inline attachments on parent nodes.
 */
export interface PluginAddonProps<T extends PluginData = PluginData> {
  /** Plugin data (narrowed by definition.isType) */
  data: T;
  /** Plugin ID */
  pluginId: string;
  /** Whether canvas is in edit mode */
  isEditMode: boolean;
  /** Whether this plugin is selected */
  isSelected?: boolean;
  /** Handler for selecting this plugin */
  onSelect?: () => void;
}

/**
 * Props passed to plugin editor components.
 * Rendered in the right panel when plugin is selected.
 */
export interface PluginEditorComponentProps<T extends PluginData = PluginData> {
  /** Plugin ID */
  pluginId: string;
  /** Plugin data (narrowed by definition.isType) */
  pluginData: T;
  /** Parent node ID this plugin is attached to */
  parentNodeId: string;
  /** Close handler */
  onClose?: () => void;
  /** Delete handler */
  onDelete?: () => void;
  /** Read-only mode */
  readOnly?: boolean;
}
