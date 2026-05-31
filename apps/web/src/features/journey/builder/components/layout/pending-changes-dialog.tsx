import { AlertTriangle, Rocket, RotateCcw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

interface PendingChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAndContinue: () => void;
  onDiscardAndContinue: () => void;
  title?: string;
  description?: string;
}

export function PendingChangesDialog({
  open,
  onOpenChange,
  onSaveAndContinue,
  onDiscardAndContinue,
  title = "Unsaved Changes",
  description = "You have unsaved changes. What would you like to do before continuing?",
}: PendingChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex gap-2 w-full">
            <Button
              variant="default"
              onClick={() => {
                onSaveAndContinue();
                onOpenChange(false);
              }}
              className="flex-1"
            >
              <Rocket className="h-4 w-4 mr-2" />
              Publish & Simulate
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onDiscardAndContinue();
                onOpenChange(false);
              }}
              className="flex-1"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Discard & Simulate
            </Button>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
