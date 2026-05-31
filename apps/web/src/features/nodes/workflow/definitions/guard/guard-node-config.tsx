/**
 * Guard Node Config
 *
 * Configuration panel for Guard workflow nodes.
 * Uses TanStack Form for explicit save pattern.
 *
 * @module features/nodes/workflow/definitions/guard/guard-node-config
 */

import type { GuardWorker } from "@journey/schemas";
import type { WorkflowNodeEditorProps } from "../../registry/types";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Switch } from "@/shared/components/ui/switch";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { GUARD_WORKERS } from "@/features/agent-workflows/constants/node-config-options";
import { useWorkflowFormFieldValue } from "@/features/nodes/workflow/hooks/use-workflow-node-form";

export function GuardNodeConfig({ form }: WorkflowNodeEditorProps) {
  // Subscribe to workers array for reactive checkbox rendering
  const workers = (useWorkflowFormFieldValue<GuardWorker[]>(form, "workers") ?? ["safety_guard"]);

  const handleWorkerToggle = (workerId: GuardWorker, checked: boolean) => {
    const currentWorkers = form.getFieldValue<GuardWorker[]>("workers") ?? ["safety_guard"];
    const newWorkers = checked
      ? [...currentWorkers, workerId]
      : currentWorkers.filter((w) => w !== workerId);
    // Ensure at least one worker is selected
    if (newWorkers.length > 0) {
      form.setFieldValue("workers", newWorkers);
    }
  };

  return (
    <div className="space-y-3">
      {/* Workers */}
      <div className="space-y-3">
        <Label>Guard Workers</Label>
        <div className="space-y-1.5">
          {GUARD_WORKERS.map((worker) => (
            <div key={worker.id} className="flex items-start gap-3">
              <Checkbox
                id={worker.id}
                checked={workers.includes(worker.id)}
                onCheckedChange={(checked) => handleWorkerToggle(worker.id, checked as boolean)}
              />
              <div className="grid gap-0.5">
                <label htmlFor={worker.id} className="text-sm font-medium cursor-pointer">
                  {worker.label}
                </label>
                <p className="text-xs text-muted-foreground">{worker.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Terminate on Block */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label>Terminate on Block</Label>
          <p className="text-xs text-muted-foreground">
            End workflow when content is blocked
          </p>
        </div>
        <form.Field name="terminateOnBlock">
          {(field) => (
            <Switch
              checked={(field.state.value as boolean) ?? true}
              onCheckedChange={field.handleChange}
            />
          )}
        </form.Field>
      </div>

      {/* Blocked Message */}
      <div className="space-y-1.5">
        <Label>Blocked Message</Label>
        <form.Field name="blockedMessage">
          {(field) => (
            <Textarea
              value={(field.state.value as string) || "I can't help with that request."}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="I cannot help with that request."
              rows={3}
            />
          )}
        </form.Field>
        <p className="text-xs text-muted-foreground">
          Message shown when content is blocked.
        </p>
      </div>
    </div>
  );
}
