/**
 * Matrix View
 *
 * Container for Agent × Parameter matrix.
 * Shows which agents are responsible for which parameters.
 */

import { memo } from "react";
import { useStore } from "@tanstack/react-store";
import { Grid3X3 } from "lucide-react";

import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { builderStore } from "../../../stores/builder-store";
import { MatrixGrid } from "./matrix-grid";

export const MatrixView = memo(function MatrixView() {
  // Granular selectors - only re-render when these specific values change
  const agents = useStore(builderStore, (s) => s.definition?.defaultAgents ?? []);
  const parameters = useStore(builderStore, (s) => s.definition?.defaultParameters ?? []);
  const categories = useStore(builderStore, (s) => s.definition?.categories ?? []);

  if (agents.length === 0 || parameters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
        <Grid3X3 className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No agents or parameters</p>
        <p className="text-xs mt-1 max-w-[200px]">
          Add agents and parameters in the Edit tab to see the assignment matrix
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <MatrixGrid
        agents={agents}
        parameters={parameters}
        categories={categories}
      />
    </ScrollArea>
  );
});
