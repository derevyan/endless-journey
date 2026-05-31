/**
 * CRM Activity Table Component
 *
 * Table display for CRM activity logs with columns for timestamp, type, client, description.
 *
 * @module components/developers/events/crm-activity-table
 */

import { useMemo } from "react";

import { Skeleton } from "@/shared/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { TablePaginationFooter } from "@/shared/components/ui/table-pagination-footer";
import { cn } from "@/shared/lib/utils";

import type { CrmActivity } from "@/hooks/queries/use-events";

import { getCrmActivityLabel } from "@journey/schemas";

import { getClientName } from "./crm-activity-helpers";
import { formatTimestamp } from "./event-helpers";

// =============================================================================
// TYPES
// =============================================================================

export interface CrmActivityTableProps {
  activities: CrmActivity[];
  searchValue: string;
  isLoading?: boolean;
  pageSize: number;
  pageIndex: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onActivityClick?: (activity: CrmActivity) => void;
  selectedActivityId?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CrmActivityTable({
  activities,
  searchValue,
  isLoading,
  pageSize,
  pageIndex,
  onPageChange,
  onPageSizeChange,
  onActivityClick,
  selectedActivityId,
}: CrmActivityTableProps) {
  const filteredActivities = useMemo(() => {
    if (!searchValue) return activities;
    const search = searchValue.toLowerCase();
    return activities.filter((activity) => {
      const description = activity.description?.toLowerCase() || "";
      const type = activity.activityType.toLowerCase();
      const clientName = getClientName(activity).toLowerCase();
      return description.includes(search) || type.includes(search) || clientName.includes(search);
    });
  }, [activities, searchValue]);

  const pageCount = Math.max(1, Math.ceil(filteredActivities.length / pageSize));
  const currentPageIndex = Math.min(pageIndex, pageCount - 1);
  const start = currentPageIndex * pageSize;
  const paginatedActivities = filteredActivities.slice(start, start + pageSize);

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Timestamp</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="w-full">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="py-1 pl-4"><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell className="py-1"><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell className="py-1"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="py-1"><Skeleton className="h-4 w-64" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border border-border/60">
        <Table>
          <TableHeader className="bg-transparent">
            <TableRow>
              <TableHead className="w-40 pl-4 text-xs font-medium text-muted-foreground whitespace-nowrap">Timestamp</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground whitespace-nowrap">Type</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground whitespace-nowrap">Client</TableHead>
              <TableHead className="w-full text-xs font-medium text-muted-foreground">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedActivities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No CRM activity found
                </TableCell>
              </TableRow>
            ) : (
              paginatedActivities.map((activity) => (
                <TableRow
                  key={activity.id}
                  className={cn(
                    "bg-transparent transition-colors cursor-pointer hover:bg-muted/30",
                    selectedActivityId === activity.id && "bg-muted/50"
                  )}
                  onClick={() => onActivityClick?.(activity)}
                >
                  <TableCell className="w-40 py-1 pl-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(activity.createdAt)}
                  </TableCell>
                  <TableCell className="py-1 font-mono text-xs whitespace-nowrap">{getCrmActivityLabel(activity.activityType)}</TableCell>
                  <TableCell className="py-1 text-xs whitespace-nowrap">{getClientName(activity)}</TableCell>
                  <TableCell className="py-1 truncate max-w-0 font-mono text-xs text-muted-foreground">
                    {activity.description}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePaginationFooter
        totalCount={filteredActivities.length}
        currentPageIndex={currentPageIndex}
        pageCount={pageCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        itemLabel="activity"
      />
    </div>
  );
}
