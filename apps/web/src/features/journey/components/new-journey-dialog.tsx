/**
 * New Journey Dialog
 *
 * Dialog for creating a new journey from the list page.
 *
 * @module features/journey/components/new-journey-dialog
 */

import { useState, useCallback } from "react";
import { z } from "zod";

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
import { Textarea } from "@/shared/components/ui/textarea";

// =============================================================================
// TYPES
// =============================================================================

interface NewJourneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: { name: string; description?: string }) => void;
  isLoading?: boolean;
}

// =============================================================================
// VALIDATION
// =============================================================================

const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(200, "Name must be 200 characters or less");

// =============================================================================
// COMPONENT
// =============================================================================

export function NewJourneyDialog({ open, onOpenChange, onCreate, isLoading }: NewJourneyDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ name?: string }>({});

  const handleSubmit = useCallback(() => {
    // Validate
    const nameResult = nameSchema.safeParse(name);

    if (!nameResult.success) {
      setErrors({ name: nameResult.error.issues[0].message });
      return;
    }

    setErrors({});
    onCreate({
      name,
      description: description || undefined,
    });
  }, [name, description, onCreate]);

  const handleClose = useCallback(() => {
    setName("");
    setDescription("");
    setErrors({});
    onOpenChange(false);
  }, [onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="new-journey-dialog">
        <DialogHeader>
          <DialogTitle>Create New Journey</DialogTitle>
          <DialogDescription>
            Create a new customer journey with a visual canvas for building conversational flows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Onboarding Journey"
              autoFocus
              data-testid="journey-name-input"
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this journey does..."
              rows={3}
              data-testid="journey-description-input"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading} data-testid="dialog-cancel-button">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading} data-testid="dialog-create-button">
            {isLoading ? "Creating..." : "Create Journey"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
