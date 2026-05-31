/**
 * Matrix Cell
 *
 * Compact read-only cell showing assignment status with Lucide checkmark.
 */

import { memo } from "react";
import { Check } from "lucide-react";

import { cn } from "@/shared/lib/utils";

interface MatrixCellProps {
  agentId: string;
  parameterId: string;
  isAssigned: boolean;
  isLastColumn?: boolean;
}

export const MatrixCell = memo(function MatrixCell({
  isAssigned,
  isLastColumn = false,
}: MatrixCellProps) {
  return (
    <td
      className={cn(
        "py-1.5 px-3 text-center",
        "border-b border-border/30",
        !isLastColumn && "border-r border-border/20"
      )}
    >
      {isAssigned ? (
        <Check className="size-4 mx-auto text-primary" strokeWidth={2.5} />
      ) : (
        <span className="block size-4 mx-auto" />
      )}
    </td>
  );
});
