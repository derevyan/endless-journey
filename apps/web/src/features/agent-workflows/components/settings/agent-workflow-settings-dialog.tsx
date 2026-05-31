/**
 * Agent Workflow Settings Dialog
 *
 * Dialog for configuring agent workflow-level settings.
 * Contains name, description, and status settings.
 *
 * @module features/agent-workflows/components/settings
 */

import { useCallback } from "react";
import { useStore } from "@tanstack/react-store";
import { Settings, X } from "lucide-react";
import type { WorkflowStatus } from "@journey/schemas";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { EntityStatusBadge } from "@/shared/components/ui/badges";
import {
  agentWorkflowStore,
  agentWorkflowActions,
  type WorkflowUISettings,
} from "../../stores/agent-workflow-store";

export function AgentWorkflowSettingsDialog() {
  const isOpen = useStore(agentWorkflowStore, (s) => s.settingsDialogOpen);
  const settings = useStore(agentWorkflowStore, (s) => s.settings);

  const handleClose = useCallback(() => {
    agentWorkflowActions.closeSettingsDialog();
  }, []);

  const handleSave = useCallback(() => {
    // Settings are already saved to store, just close
    agentWorkflowActions.closeSettingsDialog();
  }, []);

  const updateField = useCallback(<K extends keyof WorkflowUISettings>(
    field: K,
    value: WorkflowUISettings[K]
  ) => {
    agentWorkflowActions.updateSettings({ [field]: value });
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md" data-testid="workflow-settings-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Workflow Settings
          </DialogTitle>
          <DialogDescription>
            Configure general settings for this workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* General Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-name">Name</Label>
              <Input
                id="settings-name"
                value={settings.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Workflow name"
                data-testid="settings-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-description">Description</Label>
              <Textarea
                id="settings-description"
                value={settings.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Describe what this workflow does..."
                className="min-h-[100px]"
                data-testid="settings-description-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-status">Status</Label>
              <Select
                value={settings.status}
                onValueChange={(value) => updateField("status", value as WorkflowStatus)}
              >
                <SelectTrigger id="settings-status" data-testid="settings-status-select">
                  <SelectValue>
                    <EntityStatusBadge status={settings.status} size="sm" entityType="workflow" />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">
                    <div className="flex items-center gap-2">
                      <EntityStatusBadge status="draft" size="sm" entityType="workflow" />
                      <span className="text-xs text-muted-foreground">Work in progress</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <EntityStatusBadge status="active" size="sm" entityType="workflow" />
                      <span className="text-xs text-muted-foreground">Ready for production</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="archived">
                    <div className="flex items-center gap-2">
                      <EntityStatusBadge status="archived" size="sm" entityType="workflow" />
                      <span className="text-xs text-muted-foreground">No longer in use</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Controls whether this workflow is active and can be executed.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="settings-save-button">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
