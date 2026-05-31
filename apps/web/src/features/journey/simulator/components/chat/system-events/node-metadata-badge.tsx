/**
 * Node Metadata Badge
 *
 * Displays node ID with optional type and label in simulator chat events.
 * Renamed from node-badge.tsx to avoid confusion with the generic node badge
 * in features/nodes/journey/components/previews/node-badge.tsx
 *
 * @module features/simulator/components/chat/system-events/node-metadata-badge
 */

import { cn } from "@/shared/lib/utils";

interface NodeMetadataBadgeProps {
  /** Node ID */
  nodeId: string;
  /** Node metadata (type and label) */
  nodeMetadata?: {
    type: string;
    label: string;
  };
  /** Additional class names */
  className?: string;
}

/**
 * Node metadata badge component showing @nodeId (Type)
 * Used in simulator chat to display node information in system events
 */
export function NodeMetadataBadge({ nodeId, nodeMetadata, className }: NodeMetadataBadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-mono", className)}>
      <span className="text-muted-foreground/60">@</span>
      <span className="text-foreground/80">{nodeMetadata?.label || nodeId}</span>
      {nodeMetadata?.type && (
        <span className="text-muted-foreground/50">({nodeMetadata.type})</span>
      )}
    </span>
  );
}
