/**
 * User Approval Node Config
 *
 * Configuration panel for User Approval workflow nodes.
 * Uses TanStack Form for explicit save pattern.
 *
 * @module features/nodes/workflow/definitions/user-approval/user-approval-node-config
 */

import type { UserApprovalNodeConfig as UserApprovalNodeConfigType } from "@journey/schemas";
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
import { TIMEOUT_PRESETS, TIMEOUT_ACTIONS } from "@/features/agent-workflows/constants/node-config-options";

export function UserApprovalNodeConfig({ form }: WorkflowNodeEditorProps) {
  // Subscribe to timeoutSeconds for conditional rendering
  const timeoutSeconds = useWorkflowFormFieldValue<number | undefined>(form, "timeoutSeconds");
  const isCustomTimeout = timeoutSeconds !== undefined && !TIMEOUT_PRESETS.some((p) => p.value === timeoutSeconds);

  const handleTimeoutChange = (value: string) => {
    if (value === "none") {
      form.setFieldValue("timeoutSeconds", undefined);
    } else if (value !== "custom") {
      form.setFieldValue("timeoutSeconds", parseInt(value));
    }
    // If "custom" is selected, we just wait for them to enter a value
  };

  return (
    <div className="space-y-3">
      {/* Message */}
      <div className="space-y-1.5">
        <Label>Approval Message</Label>
        <form.Field name="message">
          {(field) => (
            <Textarea
              value={(field.state.value as string) ?? ""}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="Please review and approve this action."
              rows={4}
            />
          )}
        </form.Field>
        <p className="text-xs text-muted-foreground">
          Message shown to the user when requesting approval.
        </p>
      </div>

      {/* Timeout */}
      <div className="space-y-1.5">
        <Label>Timeout</Label>
        <Select
          value={timeoutSeconds === undefined ? "none" : isCustomTimeout ? "custom" : String(timeoutSeconds)}
          onValueChange={handleTimeoutChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No timeout</SelectItem>
            {TIMEOUT_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={String(preset.value)}>
                {preset.label}
              </SelectItem>
            ))}
            <SelectItem value="custom">Custom...</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isCustomTimeout && (
        <div className="space-y-1.5">
          <Label>Custom Timeout (seconds)</Label>
          <form.Field name="timeoutSeconds">
            {(field) => (
              <Input
                type="number"
                min={30}
                max={86400}
                value={(field.state.value as number) ?? 300}
                onChange={(e) => field.handleChange(parseInt(e.target.value) || 300)}
                onBlur={field.handleBlur}
              />
            )}
          </form.Field>
        </div>
      )}

      {/* Timeout Action */}
      <div className="space-y-1.5">
        <Label>On Timeout</Label>
        <form.Field name="timeoutAction">
          {(field) => (
            <Select
              value={(field.state.value as string) ?? "skip"}
              onValueChange={(value) =>
                field.handleChange(value as UserApprovalNodeConfigType["timeoutAction"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEOUT_ACTIONS.map((action) => (
                  <SelectItem key={action.value} value={action.value}>
                    {action.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </form.Field>
        <p className="text-xs text-muted-foreground">
          Action to take if the user doesn't respond within the timeout.
        </p>
      </div>

      {/* Note about branches */}
      <div className="p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
        <p className="font-medium mb-1">Branches:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Approved</strong> - User approved the action</li>
          <li><strong>Rejected</strong> - User rejected (or timeout with reject)</li>
        </ul>
      </div>
    </div>
  );
}
