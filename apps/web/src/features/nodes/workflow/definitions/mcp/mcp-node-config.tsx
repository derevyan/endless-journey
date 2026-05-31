/**
 * MCP Node Config
 *
 * Configuration panel for MCP Tool workflow nodes.
 * Uses TanStack Form for explicit save pattern.
 *
 * @module features/nodes/workflow/definitions/mcp/mcp-node-config
 */

import type { MCPNodeConfig as MCPNodeConfigType } from "@journey/schemas";
import type { WorkflowNodeEditorProps } from "../../registry/types";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useWorkflowFormFieldValue } from "@/features/nodes/workflow/hooks/use-workflow-node-form";
import { MCP_ERROR_ACTIONS } from "@/features/agent-workflows/constants/node-config-options";

export function MCPNodeConfig({ form }: WorkflowNodeEditorProps) {
  // Subscribe to onError for conditional rendering
  const onError = useWorkflowFormFieldValue<MCPNodeConfigType["onError"]>(form, "onError");
  // Subscribe to params for textarea display
  const params = useWorkflowFormFieldValue<Record<string, string>>(form, "params") ?? {};

  const handleParamsChange = (value: string) => {
    const newParams: Record<string, string> = {};
    value.split("\n").forEach((line) => {
      const [key, ...valueParts] = line.split(":");
      if (key && valueParts.length > 0) {
        newParams[key.trim()] = valueParts.join(":").trim();
      }
    });
    form.setFieldValue("params", newParams);
  };

  return (
    <div className="space-y-3">
      {/* Server */}
      <div className="space-y-1.5">
        <Label>MCP Server</Label>
        <form.Field name="server">
          {(field) => (
            <Input
              value={(field.state.value as string) ?? ""}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="calendar-server"
            />
          )}
        </form.Field>
        <p className="text-xs text-muted-foreground">
          Name of the MCP server to call.
        </p>
      </div>

      {/* Tool */}
      <div className="space-y-1.5">
        <Label>Tool Name</Label>
        <form.Field name="tool">
          {(field) => (
            <Input
              value={(field.state.value as string) ?? ""}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="create_event"
            />
          )}
        </form.Field>
        <p className="text-xs text-muted-foreground">
          Name of the tool to invoke on the MCP server.
        </p>
      </div>

      {/* Params (JSON) */}
      <div className="space-y-1.5">
        <Label>Parameters</Label>
        <Textarea
          value={Object.entries(params)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")}
          onChange={(e) => handleParamsChange(e.target.value)}
          placeholder={`title: {{event_title}}
date: {{event_date}}`}
          rows={4}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Key: value pairs, one per line. Use {"{{variable}}"} for dynamic values.
        </p>
      </div>

      {/* Timeout */}
      <div className="space-y-1.5">
        <Label>Timeout (ms)</Label>
        <form.Field name="timeout">
          {(field) => (
            <Input
              type="number"
              min={1000}
              max={60000}
              step={1000}
              value={(field.state.value as number) ?? 30000}
              onChange={(e) => field.handleChange(parseInt(e.target.value) || 30000)}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>
      </div>

      {/* Error Handling */}
      <div className="space-y-1.5">
        <Label>On Error</Label>
        <form.Field name="onError">
          {(field) => (
            <Select
              value={(field.state.value as string) ?? "fail"}
              onValueChange={(value) => field.handleChange(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MCP_ERROR_ACTIONS.map((action) => (
                  <SelectItem key={action.value} value={action.value}>
                    {action.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </form.Field>
      </div>

      {/* Max Retries (only if retry is selected) */}
      {onError === "retry" && (
        <div className="space-y-1.5">
          <Label>Max Retries</Label>
          <form.Field name="maxRetries">
            {(field) => (
              <Input
                type="number"
                min={0}
                max={3}
                value={(field.state.value as number) ?? 1}
                onChange={(e) => field.handleChange(parseInt(e.target.value) || 1)}
                onBlur={field.handleBlur}
              />
            )}
          </form.Field>
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
        <p className="font-medium mb-1">About MCP Tools</p>
        <p>
          MCP (Model Context Protocol) allows calling external tools like calendars,
          databases, and APIs. Configure server connections in organization settings.
        </p>
      </div>
    </div>
  );
}
