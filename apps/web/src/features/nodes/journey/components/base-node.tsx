/**
 * BaseNode Component
 *
 * Shared node shell that handles common functionality:
 * - Handles (input/output connections)
 * - Selection state (derived from stores via useNodeVisualization)
 * - Header with icon and label
 * - Type badge
 * - Edit mode visibility
 *
 * Visualization state is now read directly from stores via useNodeVisualization,
 * eliminating prop drilling through the component tree.
 */

import { Handle, Position, useNodeId } from "@xyflow/react";
import { useStore } from "@tanstack/react-store";
import { MessageSquare } from "lucide-react";
import { memo, useCallback, useState, type ReactNode } from "react";

import { getNodePlugins, pluginCompatibilityRegistry, type PluginNode, type PluginType } from "@journey/schemas";
import { journeyNodesActions, journeyNodesStore } from "@/stores/journey-nodes-store";
import { uiActions, uiStore } from "@/stores/ui-store";
import { BADGE_STYLES, FOCUS_STYLES, getHandleColor, HANDLE_STYLES, JOURNEY_STATES, NODE_DIMENSIONS, NODE_LAYOUT } from "../config/node-theme";
import { useNodeVisualization } from "../hooks/use-node-visualization";
import { nodeRegistry, type NodeColorScheme } from "../registry/node-registry";
import type { NodeType } from "../react-flow-types";
import { getHandleVisibility } from "../utils/node-styles";
import { PluginAddonContainer } from "./addons";

import { NodeBadge } from "./previews/node-badge";

export interface ButtonHandle {
  id: string;
  text: string;
}

/**
 * BaseNode Props - Now focused on node-specific configuration.
 *
 * Visualization state (selected, isEditMode, journey path) is now derived
 * from stores via useNodeVisualization hook, eliminating prop drilling.
 */
export interface BaseNodeProps {
  nodeType: NodeType;
  label: string;
  // Optional subtitle (displayed under header, e.g., model name for agent nodes)
  subtitle?: string;
  // Custom badges
  badges?: ReactNode;
  // Timer handle (shown on right side)
  hasTimerHandle?: boolean;
  // Error/retry handle (shown on right side, like timer but for error paths)
  hasErrorHandle?: boolean;
  // Virtual handle for follow-up sequences (shown on right side, center)
  hasVirtualHandle?: boolean;
  // Multiple output handles for condition branches
  outputHandles?: Array<{ id: string; label?: string }>;
  // Button handles (shown on left side, each button has its own connection point)
  buttonHandles?: ButtonHandle[];
  // Response type for styling handles (message nodes)
  responseType?: "auto" | "buttons" | "text" | "any";
  // Control output handle visibility (for End, Teleport nodes)
  hasOutputHandle?: boolean;
  // Control input handle visibility (for Start node - entry point shouldn't have input)
  hasInputHandle?: boolean;
  // Plugin addons attached to this node (rendered at bottom, before output handle)
  pluginAddons?: PluginNode[];
  // Content
  children: ReactNode;
  // Optional node data for extra visualization flags (journeyDroppedOff)
  // These are set dynamically by journey-canvas for specific modes
  nodeData?: { journeyDroppedOff?: boolean };
}

// Default colors fallback
const DEFAULT_COLORS: NodeColorScheme = {
  icon: "text-blue-600 dark:text-blue-400",
  iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
  border: "border-border hover:border-blue-500/50",
  header: "bg-blue-500/5 dark:bg-blue-500/10",
  selected: "border-blue-500 ring-2 ring-blue-500/20",
  badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]",
};

export const BaseNode = memo(function BaseNode({
  nodeType,
  label,
  subtitle,
  badges,
  hasTimerHandle,
  hasErrorHandle,
  hasVirtualHandle,
  outputHandles,
  responseType,
  hasOutputHandle = true,
  hasInputHandle = true,
  pluginAddons,
  children,
  nodeData,
}: BaseNodeProps) {
  // Get node ID from React Flow context
  const nodeId = useNodeId();

  // Get selected plugin ID for addon highlighting
  const selectedPluginId = useStore(uiStore, (s) => s.selectedPluginId);

  // Get visualization state from stores (eliminates prop drilling)
  const {
    isSelected: selected,
    isEditMode,
    isJourneyVisited,
    isJourneyCurrent,
    isJourneyDropped,
    journeyStep,
  } = useNodeVisualization(nodeId || "", nodeData);

  // Plugin drag-and-drop state and handlers
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!isEditMode) return;
      const hasReactFlowData = e.dataTransfer.types.includes("application/reactflow");
      if (hasReactFlowData) {
        e.preventDefault();
        setIsDragOver(true);
      }
    },
    [isEditMode]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only reset if leaving the node entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isEditMode) return;
      const hasReactFlowData = e.dataTransfer.types.includes("application/reactflow");
      if (!hasReactFlowData) return;

      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    [isEditMode]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (!isEditMode || !nodeId) return;

      const type = e.dataTransfer.getData("application/reactflow");
      if (!type?.startsWith("plugin-")) return;

      const pluginType = type.replace("plugin-", "") as PluginType;

      if (!pluginCompatibilityRegistry.isCompatible(pluginType, nodeType)) {
        return;
      }

      // Check if node already has this plugin type (embedded in node.data.plugins)
      const node = journeyNodesStore.state.nodes.find((n) => n.id === nodeId);
      const existingPlugins = node ? getNodePlugins(node.data) : [];
      const hasPluginType = existingPlugins.some((p) => p.pluginType === pluginType);
      if (hasPluginType) return; // Already has one

      const plugin = journeyNodesActions.addPlugin(nodeId, pluginType as "followup");
      if (plugin) {
        uiActions.setSelectedPlugin(plugin.id);
      }
    },
    [isEditMode, nodeId, nodeType]
  );

  const colors = nodeRegistry.getColors(nodeType) || DEFAULT_COLORS;
  const Icon = nodeRegistry.getIcon(nodeType) || MessageSquare;

  const nodeDescription = [
    label,
    `Type: ${nodeType}`,
    isJourneyCurrent && "Current position in journey",
    isJourneyVisited && "Visited in journey",
    isJourneyDropped && "Drop-off point",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Journey node: ${nodeDescription}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`
        relative ${NODE_DIMENSIONS.width} ${NODE_DIMENSIONS.borderRadius} ${NODE_DIMENSIONS.border.width}
        bg-card/90 backdrop-blur-md ${NODE_DIMENSIONS.shadow.premium}
        ${NODE_DIMENSIONS.hover}
        ${FOCUS_STYLES.ring}
        ${selected ? `${colors.selected} ${colors.glow} ${NODE_DIMENSIONS.shadow.selected}` : colors.border}
        ${isJourneyVisited && !isJourneyCurrent ? JOURNEY_STATES.visited : ""}
        ${isJourneyCurrent ? JOURNEY_STATES.current : ""}
        ${isJourneyDropped ? JOURNEY_STATES.dropped : ""}
        ${isDragOver ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-background" : ""}
      `}
    >
      {/* Input Handle */}
      {hasInputHandle && (
        <Handle
          type="target"
          position={Position.Top}
          className={`${HANDLE_STYLES.size} ${HANDLE_STYLES.colors.default} ${HANDLE_STYLES.border} ${getHandleVisibility(isEditMode)}`}
        />
      )}

      {/* Header */}
      <div
        className={`${NODE_LAYOUT.header.padding} border-b border-border/40 flex items-center ${NODE_LAYOUT.header.gap} ${NODE_LAYOUT.header.borderRadius} ${colors.header}`}
      >
        <div className={`${NODE_LAYOUT.header.iconWrapper} ${colors.iconBg}`}>
          <Icon className={`w-4 h-4 ${colors.icon}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <span className={`${NODE_LAYOUT.header.fontSize} text-foreground truncate block`}>{label}</span>
          {/* Optional subtitle (e.g., model name for agent nodes) */}
          {subtitle && <span className="text-[10px] font-medium text-muted-foreground truncate block leading-tight">{subtitle}</span>}
        </div>

        {/* Step number - shown during simulation */}
        {journeyStep !== undefined && (
          <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm shrink-0">
            <span className="text-[10px] font-bold text-primary">#{journeyStep}</span>
          </div>
        )}
      </div>

      {/* Body Content */}
      <div className={`${NODE_LAYOUT.body.padding} ${NODE_LAYOUT.body.spacing}`}>
        {children}
      </div>

      {/* Footer Section - badges then plugin addons */}
      <div className="px-4 pb-3">
        {/* Badges row */}
        <div className={`flex items-center justify-between ${NODE_LAYOUT.badge.gap}`}>
          {/* Type badge - left */}
          <NodeBadge className={`${BADGE_STYLES.variants.type}`}>
            {nodeType.toUpperCase()}
          </NodeBadge>

          {/* Custom badges (Timer, Response Type) - right */}
          {badges}
        </div>

        {/* Plugin Addons - below badges */}
        {pluginAddons && pluginAddons.length > 0 && (
          <PluginAddonContainer
            plugins={pluginAddons}
            parentNodeId={nodeId || ""}
            isEditMode={isEditMode}
            selectedPluginId={selectedPluginId}
          />
        )}
      </div>

      {/* Default Output Handle (bottom center) */}
      {hasOutputHandle && !outputHandles && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="output"
          className={`${HANDLE_STYLES.size} ${getHandleColor(responseType)} ${HANDLE_STYLES.border} ${getHandleVisibility(isEditMode)}`}
        />
      )}

      {/* Multiple Output Handles (for condition nodes) */}
      {hasOutputHandle && outputHandles && outputHandles.length > 0 && (
        <>
          {outputHandles.map((handle, index) => {
            const total = outputHandles.length;
            const leftPercent = ((index + 1) / (total + 1)) * 100;
            return (
              <Handle
                key={handle.id}
                type="source"
                position={Position.Bottom}
                id={handle.id}
                className={`${HANDLE_STYLES.size} ${HANDLE_STYLES.colors.default} ${HANDLE_STYLES.border} ${getHandleVisibility(isEditMode)}`}
                style={{ left: `${leftPercent}%` }}
              />
            );
          })}
        </>
      )}

      {/* Timer Handle (right side) */}
      {hasTimerHandle && (
        <Handle
          type="source"
          position={Position.Right}
          id="timer"
          className={`${HANDLE_STYLES.size} ${HANDLE_STYLES.border} ${getHandleVisibility(isEditMode)}`}
          style={{ ...HANDLE_STYLES.positions.timer.style, backgroundColor: HANDLE_STYLES.colors.timer }}
        />
      )}

      {/* Error Handle (right side, orange like timer) */}
      {hasErrorHandle && (
        <Handle
          type="source"
          position={Position.Right}
          id="error"
          className={`${HANDLE_STYLES.size} ${HANDLE_STYLES.border} ${getHandleVisibility(isEditMode)}`}
          style={{
            ...(hasTimerHandle ? HANDLE_STYLES.positions.error.styleWithTimer : HANDLE_STYLES.positions.error.style),
            backgroundColor: HANDLE_STYLES.colors.error,
          }}
        />
      )}

      {/* Follow-up Handle (right side, center - for follow-up sequences) */}
      {/* Always hidden - follow-up edges are configured via NodeSelectorPopover, not by dragging */}
      {hasVirtualHandle && (
        <Handle
          type="source"
          position={Position.Right}
          id="virtual"
          className={`${HANDLE_STYLES.size} ${HANDLE_STYLES.border} ${HANDLE_STYLES.hidden}`}
          style={{
            ...HANDLE_STYLES.positions.virtual.style,
            backgroundColor: HANDLE_STYLES.colors.virtual,
          }}
        />
      )}

      {/* Note: Button handles are now rendered inside node body via ButtonStack component */}
    </div>
  );
});
