/**
 * New Agent Workflow Dialog
 *
 * Dialog for creating a new agent workflow.
 *
 * @module features/agent-workflows/components/new-agent-workflow-dialog
 */

import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

// =============================================================================
// TYPES
// =============================================================================

interface NewAgentWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: { key: string; name: string; description?: string }) => void;
  isLoading?: boolean;
}

// =============================================================================
// VALIDATION
// =============================================================================

const keySchema = z
  .string()
  .min(1, "Key is required")
  .max(100, "Key must be 100 characters or less")
  .regex(
    /^[a-z][a-z0-9-]*$/,
    "Key must be lowercase, start with a letter, and contain only letters, numbers, and hyphens"
  );

const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(200, "Name must be 200 characters or less");

// =============================================================================
// COMPONENT
// =============================================================================

export function NewAgentWorkflowDialog({ open, onOpenChange, onCreate, isLoading }: NewAgentWorkflowDialogProps) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ key?: string; name?: string }>({});

  // Auto-generate key from name
  const handleNameChange = useCallback((value: string) => {
    setName(value);
    // Generate key from name: lowercase, replace spaces/special chars with hyphens
    const generatedKey = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 100);
    setKey(generatedKey);
  }, []);

  const handleSubmit = useCallback(() => {
    // Validate
    const keyResult = keySchema.safeParse(key);
    const nameResult = nameSchema.safeParse(name);

    const newErrors: { key?: string; name?: string } = {};
    if (!keyResult.success) {
      newErrors.key = keyResult.error.issues[0].message;
    }
    if (!nameResult.success) {
      newErrors.name = nameResult.error.issues[0].message;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onCreate({
      key,
      name,
      description: description || undefined,
    });
  }, [key, name, description, onCreate]);

  const handleClose = useCallback(() => {
    setName("");
    setKey("");
    setDescription("");
    setErrors({});
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="new-agent-dialog">
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
          <DialogDescription>
            Create a new agent with a visual canvas for chaining logic and actions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Research Workflow"
              autoFocus
              data-testid="agent-name-input"
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase())}
              placeholder="my-research-workflow"
              className="font-mono text-sm"
              data-testid="agent-key-input"
            />
            <p className="text-xs text-muted-foreground">
              URL-safe identifier. Auto-generated from name.
            </p>
            {errors.key && <p className="text-sm text-destructive">{errors.key}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              rows={3}
              data-testid="agent-description-input"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading} data-testid="dialog-cancel-button">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading} data-testid="dialog-create-button">
            {isLoading ? "Creating..." : "Create Agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
