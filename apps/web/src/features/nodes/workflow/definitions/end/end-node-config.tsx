/**
 * End Node Config
 *
 * Configuration panel for End workflow nodes.
 * Uses TanStack Form for explicit save pattern.
 *
 * @module features/nodes/workflow/definitions/end/end-node-config
 */

import type { WorkflowNodeEditorProps } from "../../registry/types";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

export function EndNodeConfig({ form }: WorkflowNodeEditorProps) {
  return (
    <div className="space-y-3">
      {/* Output Template */}
      <div className="space-y-1.5">
        <Label>Output Template (optional)</Label>
        <form.Field name="outputTemplate">
          {(field) => (
            <Textarea
              value={(field.state.value as string) || ""}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="{{lastAgent.response}}"
              rows={4}
              className="font-mono text-sm"
            />
          )}
        </form.Field>
        <p className="text-xs text-muted-foreground">
          Handlebars template for the final output. Leave empty to use the last agent's response.
        </p>
      </div>

      {/* Examples */}
      <div className="p-3 bg-muted/50 rounded-md text-xs">
        <p className="font-medium mb-2">Template Examples:</p>
        <ul className="space-y-1.5 font-mono text-muted-foreground">
          <li>{"{{lastAgent.response}}"} - Last agent output</li>
          <li>{"{{state.summary}}"} - Stored variable</li>
          <li>{"{{agent_result.data.text}}"} - Nested field</li>
        </ul>
      </div>
    </div>
  );
}
