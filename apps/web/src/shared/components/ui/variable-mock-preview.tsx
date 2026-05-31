/**
 * VariableMockPreview Component
 *
 * Displays mock data preview for a selected/hovered variable.
 * Shows type information, realistic example JSON, and provides
 * one-click webhook body generation.
 *
 * @module components/ui/variable-mock-preview
 */

import { memo, useMemo } from "react";
import { Copy, FileJson2, Info } from "lucide-react";
import { generateNodeOutputMock, generateWebhookBodyTemplate, resolveMockDataPath, type MockDataResult } from "@journey/schemas";
import type { NodeType } from "@journey/schemas";
import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";
import type { SelectableVariable } from "./variable-selector-popover";
import { Button } from "./button";
import { JsonHighlight } from "./json-highlight";
import { notify } from "@/shared/lib/ui/notify";
import { cn } from "@/shared/lib/utils";

interface VariableMockPreviewProps {
  /** The variable to show preview for (or null for empty state) */
  variable: SelectableVariable | null;
  /** All journey nodes for looking up node data */
  nodes: JourneyNode[];
  /** Additional CSS class name */
  className?: string;
}

/**
 * Preview panel showing mock data for a variable
 *
 * Appears in the variable selector popover when hovering over variables.
 * Shows realistic example data based on node configuration.
 */
export const VariableMockPreview = memo(function VariableMockPreview({ variable, nodes, className }: VariableMockPreviewProps) {
  // Generate mock data based on variable's source node
  const mockData = useMemo((): MockDataResult | null => {
    if (!variable) return null;

    // Check if this is a node output variable (has sourceNodeId)
    const sourceNodeId = (variable as SelectableVariable & { sourceNodeId?: string }).sourceNodeId;
    if (!sourceNodeId) {
      // For non-node variables, show a basic type hint
      return {
        data: getBuiltinVariableMock(variable.path, variable.type),
        typeString: variable.type ?? "unknown",
        description: variable.description ?? "Built-in variable",
      };
    }

    // Find the source node
    const node = nodes.find((n) => n.id === sourceNodeId);
    if (!node) return null;

    // Generate full mock for the node
    const fullMock = generateNodeOutputMock(node.data.type as NodeType, node.data);
    if (!fullMock) return null;

    // Extract property path from variable.path
    // e.g., "nodes.ProductFlow_Assistant.lastResponse" -> "lastResponse"
    // e.g., "nodes.Agent.conversationMetrics.turnCount" -> "conversationMetrics.turnCount"
    const pathParts = variable.path.split(".");
    const propertyPath = pathParts.slice(2).join("."); // Skip "nodes" and nodeId

    // If no property path, return full mock
    if (!propertyPath) return fullMock;

    // Resolve to the specific property
    return resolveMockDataPath(fullMock, propertyPath);
  }, [variable, nodes]);

  // Copy webhook body template to clipboard
  const handleCopyWebhookBody = () => {
    if (!variable) return;

    const template = generateWebhookBodyTemplate(variable.path);
    navigator.clipboard.writeText(template);
    notify.success("Webhook body template copied");
  };

  // Copy just the example JSON
  const handleCopyJson = () => {
    if (!mockData) return;

    navigator.clipboard.writeText(JSON.stringify(mockData.data, null, 2));
    notify.success("Example JSON copied");
  };

  // Empty state when no variable is hovered
  if (!variable || !mockData) {
    return (
      <div className={cn("flex items-center justify-center p-4 text-muted-foreground", className)}>
        <div className="text-center">
          <Info className="h-4 w-4 mx-auto mb-1 opacity-50" />
          <p className="text-[10px]">Hover over a variable to see preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col overflow-hidden h-full", className)}>
      {/* Header with type info - fixed height to match search input */}
      <div className="flex items-center gap-2 px-3 h-7 border-b bg-muted/30 shrink-0">
        <FileJson2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[10px] font-medium text-muted-foreground truncate">{mockData.typeString}</span>
      </div>

      {/* Description - fixed height */}
      <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b shrink-0">{mockData.description}</div>

      {/* Example JSON - fills remaining space, scrolls internally */}
      <div className="flex-1 min-h-0 overflow-auto p-2">
        <div className="text-[10px] leading-relaxed font-mono bg-muted/40 rounded p-2 whitespace-pre-wrap break-all">
          <JsonHighlight value={mockData.data} />
        </div>
      </div>

      {/* Footer with copy actions - fixed height */}
      <div className="flex items-center justify-end gap-1 px-2 py-1.5 border-t bg-muted/30 shrink-0">
        <Button size="sm" variant="ghost" onClick={handleCopyJson} className="h-6 px-2 text-[10px] gap-1">
          <Copy className="h-3 w-3" />
          JSON
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCopyWebhookBody} className="h-6 px-2 text-[10px] gap-1">
          <Copy className="h-3 w-3" />
          Webhook
        </Button>
      </div>
    </div>
  );
});

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate mock values for built-in variables (user, session, etc.)
 */
function getBuiltinVariableMock(path: string, type?: string): unknown {
  const lowerPath = path.toLowerCase();

  // User variables
  if (lowerPath.startsWith("user.")) {
    if (lowerPath.includes("id")) return "usr_abc123";
    if (lowerPath.includes("name") || lowerPath.includes("first")) return "Alex";
    if (lowerPath.includes("last")) return "Thompson";
    if (lowerPath.includes("email")) return "alex@example.com";
    if (lowerPath.includes("phone")) return "+1 555-123-4567";
    return "user_value";
  }

  // Session variables
  if (lowerPath.startsWith("session.")) {
    if (lowerPath.includes("id")) return "ses_xyz789";
    if (lowerPath.includes("started")) return "2026-01-05T10:00:00Z";
    if (lowerPath.includes("status")) return "active";
    return "session_value";
  }

  // Response variable
  if (lowerPath === "response" || lowerPath === "userresponse") {
    return "User's last message or button click";
  }

  // Type-based fallback
  switch (type) {
    case "number":
      return 42;
    case "boolean":
      return true;
    case "object":
      return { key: "value" };
    default:
      return "sample_value";
  }
}
