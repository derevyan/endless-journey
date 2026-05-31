/**
 * Question Understanding Node Config
 *
 * Configuration panel for Question Understanding workflow nodes.
 * This node synthesizes unanswered questions from conversation history
 * and automatically passes them to connected Agent nodes.
 *
 * Uses TanStack Form for explicit save pattern.
 *
 * @module features/nodes/workflow/definitions/question-understanding/question-understanding-node-config
 */

import { useState } from "react";
import { Globe, InfoIcon } from "lucide-react";
import type { WorkflowNodeEditorProps } from "../../registry/types";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { CollapsibleSection } from "@/shared/components/ui/collapsible-section";

export function QuestionUnderstandingNodeConfig({ form }: WorkflowNodeEditorProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/* Info Alert */}
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>Auto-Integration with Agent</AlertTitle>
        <AlertDescription>
          When connected to an Agent node, the synthesized question automatically becomes the user
          message — no manual wiring needed.
        </AlertDescription>
      </Alert>

      {/* Advanced Settings */}
      <CollapsibleSection
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        icon={Globe}
        label="Advanced"
      >
        <div className="space-y-3">
          {/* Include Reasoning Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Include Reasoning</Label>
              <p className="text-xs text-muted-foreground">Store detailed metadata for debugging</p>
            </div>
            <form.Field name="includeReasoning">
              {(field) => (
                <Switch
                  checked={(field.state.value as boolean) ?? false}
                  onCheckedChange={field.handleChange}
                />
              )}
            </form.Field>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
