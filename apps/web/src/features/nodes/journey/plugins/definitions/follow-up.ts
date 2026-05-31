/**
 * Follow-Up Plugin Definition
 *
 * Complete configuration for the Follow-Up plugin.
 * Consolidates all follow-up specific logic into one file:
 * - Icon and colors
 * - Type guard
 * - Default data factory
 * - Handle generation
 * - Edge specification
 * - Editor and Addon components
 *
 * @module plugins/definitions/follow-up
 */

import { MessageCircle } from "lucide-react";

import { followUpPluginDescriptor, type FollowUpPluginData } from "@journey/schemas";
import { PluginButtonEdgeId, PluginExitEdgeId } from "../../utils/plugin-edge-identity";
import { FollowUpPluginEditor } from "../../editors/plugin-editors/follow-up-plugin-editor";
import { FollowUpAddon } from "../../components/addons/follow-up-addon";
import { pluginRegistry, type FrontendPluginDescriptor } from "../registry";
import type { PluginHandle, PluginEdgeSpec, PluginColorScheme } from "../types";

// =============================================================================
// COLOR SCHEME
// =============================================================================

/**
 * Amber color scheme for follow-up plugin.
 * Matches the Timer/Wait node visual language.
 */
const followUpColors: PluginColorScheme = {
  icon: "text-amber-600 dark:text-amber-400",
  iconBg: "bg-amber-500/10",
  borderDefault: "border-amber-400/50 dark:border-amber-600/50",
  borderHover: "hover:border-amber-500",
  borderSelected: "border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]",
  shadowSelected: "shadow-md shadow-amber-500/20",
  handle: "bg-amber-400",
};

// =============================================================================
// HANDLE GENERATION
// =============================================================================

/**
 * Generate source handles for follow-up plugin.
 * Creates handles for each step button + exit path.
 *
 * @param data - Follow-up plugin data
 * @returns Array of handle configurations
 */
function getFollowUpHandles(data: FollowUpPluginData): PluginHandle[] {
  const handles: PluginHandle[] = [];

  // Add handles for each step's buttons
  data.steps?.forEach((step, stepIdx) => {
    step.buttons?.forEach((button) => {
      handles.push({
        type: "button",
        id: PluginButtonEdgeId.getSourceHandle(stepIdx, button.id),
        label: button.text,
        targetNodeId: button.targetNodeId,
      });
    });
  });

  // Add exit path handle if configured
  if (data.exitPath?.nodeId) {
    handles.push({
      type: "exit",
      id: PluginExitEdgeId.getSourceHandle(),
      label: "Exit",
      targetNodeId: data.exitPath.nodeId,
    });
  }

  return handles;
}

// =============================================================================
// EDGE SPECIFICATION
// =============================================================================

/**
 * Generate expected edges for follow-up plugin.
 * Used by edge sync to reconcile actual edges with expected.
 *
 * @param pluginId - Plugin node ID
 * @param data - Follow-up plugin data
 * @returns Array of expected edge specifications
 */
function getFollowUpExpectedEdges(pluginId: string, data: FollowUpPluginData): PluginEdgeSpec[] {
  const edges: PluginEdgeSpec[] = [];

  // Button edges
  data.steps?.forEach((step, stepIdx) => {
    step.buttons?.forEach((button) => {
      if (button.targetNodeId) {
        edges.push({
          id: PluginButtonEdgeId.create(pluginId, stepIdx, button.id),
          sourceHandle: PluginButtonEdgeId.getSourceHandle(stepIdx, button.id),
          target: button.targetNodeId,
          label: `Step ${stepIdx + 1}: ${button.text}`,
        });
      }
    });
  });

  // Exit edge
  if (data.exitPath?.nodeId) {
    edges.push({
      id: PluginExitEdgeId.create(pluginId),
      sourceHandle: PluginExitEdgeId.getSourceHandle(),
      target: data.exitPath.nodeId,
      label: "Exit",
    });
  }

  return edges;
}

// =============================================================================
// PLUGIN DEFINITION
// =============================================================================

/**
 * Complete Follow-Up plugin descriptor.
 * Self-registers with the plugin registry on import.
 */
export const followUpPluginFrontendDescriptor: FrontendPluginDescriptor<FollowUpPluginData> = {
  ...followUpPluginDescriptor,
  icon: MessageCircle,
  colors: followUpColors,
  Editor: FollowUpPluginEditor,
  Addon: FollowUpAddon,
  getHandles: getFollowUpHandles,
  getExpectedEdges: getFollowUpExpectedEdges,
};

// =============================================================================
// SELF-REGISTRATION
// =============================================================================

// Register on import
pluginRegistry.register(followUpPluginFrontendDescriptor);
