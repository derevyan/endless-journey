/**
 * Shared types for node editors
 *
 * Note: EditorBase now self-manages most state:
 * - readOnly is derived from isEditMode store
 * - close action uses uiActions.clearSelection()
 * - delete action uses deleteNodeWithSync()
 *
 * Props are optional overrides that allow customization when needed.
 */

import type { PluginData } from "@journey/schemas";
import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";

/**
 * Common props interface for all node editors.
 *
 * Only `node` is required. Other props are optional overrides:
 * - EditorBase derives readOnly from isEditMode if not provided
 * - EditorBase uses store actions for close/delete if not provided
 */
export interface NodeEditorProps {
  node: JourneyNode;
  onClose?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
  // Note: sidebarOpen removed - EditorBase doesn't use it
}

/**
 * Props for plugin editors.
 *
 * Unlike NodeEditorProps which wraps a node, plugin editors receive
 * plugin-specific data directly for type safety.
 */
export interface PluginEditorProps {
  /** Plugin ID from the PluginNode */
  pluginId: string;
  /** Plugin data (narrowed in specific editors) */
  pluginData: PluginData;
  /** Parent node ID the plugin is attached to */
  parentNodeId: string;
  /** Close handler */
  onClose?: () => void;
  /** Delete handler */
  onDelete?: () => void;
  /** Read-only mode */
  readOnly?: boolean;
}

