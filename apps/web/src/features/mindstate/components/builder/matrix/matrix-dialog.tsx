/**
 * Matrix Dialog
 *
 * Compact read-only modal showing Agent × Parameter assignment overview.
 * Displays which agents are responsible for which parameters.
 */

import { memo } from "react";
import { useStore } from "@tanstack/react-store";
import { Grid3X3 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { builderStore } from "../../../stores/builder-store";
import { MatrixGrid } from "./matrix-grid";

interface MatrixDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MatrixDialog = memo(function MatrixDialog({
  open,
  onOpenChange,
}: MatrixDialogProps) {
  // Granular selectors - only re-render when these specific values change
  const agents = useStore(builderStore, (s) => s.definition?.defaultAgents ?? []);
  const parameters = useStore(builderStore, (s) => s.definition?.defaultParameters ?? []);
  const categories = useStore(builderStore, (s) => s.definition?.categories ?? []);
  const definitionName = useStore(builderStore, (s) => s.definition?.name ?? "MindState");

  const hasData = agents.length > 0 && parameters.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-[95vw] sm:max-w-[95vw] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Agent × Parameter Matrix
          </DialogTitle>
          <DialogDescription>
            {definitionName} — Overview of parameter assignments
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-lg border bg-background">
          {hasData ? (
            <MatrixGrid
              agents={agents}
              parameters={parameters}
              categories={categories}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
              <Grid3X3 className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-base font-medium">No agents or parameters</p>
              <p className="text-sm mt-2 max-w-[300px]">
                Add agents and parameters first to see the assignment matrix
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
