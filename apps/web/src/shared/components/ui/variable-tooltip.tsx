/**
 * VariableTooltip Component
 *
 * Shows a tooltip with mocked variable value when hovering over
 * template variables in the message content editor.
 *
 * Uses centralized mock generation from @journey/schemas/mocks.
 *
 * @module components/ui/variable-tooltip
 */

import { memo, useMemo } from "react";
import { createPortal } from "react-dom";

import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { sanitizeNodeLabel } from "@/shared/lib/variables";
import type { NodeType, WorkflowNode } from "@journey/schemas";
import { generateBuiltinVariableMock, generateNodeOutputMock, generateWorkflowNodeMock, resolveMockDataPath, type BuiltinVariableCategory, type MockDataResult } from "@journey/schemas";
import { JsonHighlight } from "./json-highlight";

interface VariableTooltipProps {
  /** The variable path (e.g., "nodes.Agent.lastResponse" or "user.id") */
  variablePath: string | null;
  /** X position for tooltip */
  x: number;
  /** Y position for tooltip */
  y: number;
  /** Journey nodes for generating mock data */
  nodes: JourneyNode[];
  /** Workflow nodes for generating mock data (in workflow context) */
  workflowNodes?: WorkflowNode[];
  /** Called when mouse enters the tooltip */
  onMouseEnter?: () => void;
  /** Called when mouse leaves the tooltip */
  onMouseLeave?: () => void;
}

/**
 * Generate mock data for any variable path using centralized generators
 */
function generateMockForPath(
  variablePath: string,
  nodes: JourneyNode[],
  workflowNodes?: WorkflowNode[]
): MockDataResult | null {
  const parts = variablePath.split(".");
  const category = parts[0];

  // Node output variable: nodes.NodeName.property
  if (category === "nodes" && parts.length >= 2) {
    const nodeId = parts[1];

    // First, try to find in journey nodes (by sanitized label or id)
    const journeyNode = nodes.find((n) => sanitizeNodeLabel(n.data.label) === nodeId || n.id === nodeId);
    if (journeyNode) {
      const fullMock = generateNodeOutputMock(journeyNode.data.type as NodeType, journeyNode.data);
      if (!fullMock) return null;

      const propertyPath = parts.slice(2).join(".");
      if (propertyPath) {
        return resolveMockDataPath(fullMock, propertyPath);
      }
      return fullMock;
    }

    // Second, try to find in workflow nodes (by id - workflow uses node.id for paths)
    const workflowNode = workflowNodes?.find((n) => n.id === nodeId);
    if (workflowNode) {
      // Use workflow-specific mock generator (not journey mock)
      // Workflow nodes have different data structure and output schema
      const fullMock = generateWorkflowNodeMock(
        workflowNode.type,
        workflowNode.data as Record<string, unknown>
      );
      if (!fullMock) return null;

      const propertyPath = parts.slice(2).join(".");
      if (propertyPath) {
        return resolveMockDataPath(fullMock, propertyPath);
      }
      return fullMock;
    }

    // Node not found - return generic fallback
    return {
      data: "node_output_value",
      typeString: "unknown",
      description: "Node output",
    };
  }

  // Built-in variable categories
  const builtinCategories: BuiltinVariableCategory[] = ["user", "session", "vars", "mindstate"];
  if (builtinCategories.includes(category as BuiltinVariableCategory)) {
    const property = parts.slice(1).join(".");
    return generateBuiltinVariableMock(category as BuiltinVariableCategory, property);
  }

  // Response/userResponse variables
  if (category === "response" || category === "userResponse") {
    const property = parts.slice(1).join(".");
    return generateBuiltinVariableMock("response", property);
  }

  // Default fallback
  return {
    data: "sample_value",
    typeString: "unknown",
    description: "Variable value",
  };
}

/**
 * Tooltip showing mock value for a hovered variable
 *
 * Uses portal to escape overflow:hidden containers (like node editor panels).
 * Always positioned to the right of cursor.
 */
export const VariableTooltip = memo(function VariableTooltip({
  variablePath,
  x,
  y,
  nodes,
  workflowNodes,
  onMouseEnter,
  onMouseLeave,
}: VariableTooltipProps) {
  // Generate mock value for this variable path
  const mockData = useMemo(() => {
    if (!variablePath) return null;
    return generateMockForPath(variablePath, nodes, workflowNodes);
  }, [variablePath, nodes, workflowNodes]);

  // Transform path display to show friendly node names (same as input field)
  const displayPath = useMemo(() => {
    if (!variablePath || !workflowNodes?.length) return variablePath;

    const parts = variablePath.split(".");
    if (parts[0] !== "nodes" || parts.length < 2) return variablePath;

    const nodeId = parts[1];
    const node = workflowNodes.find((n) => n.id === nodeId);
    const nodeName = node?.data?.name;

    if (typeof nodeName === "string" && nodeName) {
      const sanitizedName = sanitizeNodeLabel(nodeName);
      if (sanitizedName) {
        parts[1] = sanitizedName;
        return parts.join(".");
      }
    }
    return variablePath;
  }, [variablePath, workflowNodes]);

  if (!variablePath || !mockData) return null;

  // Use portal to escape overflow:hidden containers (like node editor panels)
  // Always position to the left of cursor
  return createPortal(
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-[100] bg-popover border rounded-md shadow-lg p-2 text-xs w-[300px] max-h-[200px] overflow-y-auto"
      style={{
        left: x - 12,
        top: y + 12,
        transform: "translateX(-100%)",
      }}
    >
      {/* Variable path header - shows friendly name for workflow nodes */}
      <div className="font-mono text-[10px] text-muted-foreground mb-1 truncate">{displayPath}</div>

      {/* Mock value - whitespace-pre-wrap for proper JSON formatting with wrapping */}
      <div className="font-mono text-[11px] whitespace-pre-wrap break-words">
        {typeof mockData.data === "string" ? (
          <span className="text-green-600 dark:text-green-400">"{mockData.data}"</span>
        ) : (
          <JsonHighlight value={mockData.data} />
        )}
      </div>

      {/* Type badge */}
      <div className="mt-1 text-[9px] text-muted-foreground">{mockData.typeString}</div>
    </div>,
    document.body
  );
});
