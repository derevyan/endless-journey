/**
 * LLM Usage Table Component
 *
 * Table display for LLM usage events with columns for timestamp, service, model, tokens, cost.
 *
 * @module components/developers/events/llm-usage-table
 */

import { useMemo } from "react";

import { Skeleton } from "@/shared/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { TablePaginationFooter } from "@/shared/components/ui/table-pagination-footer";
import { cn } from "@/shared/lib/utils";

import type { LlmUsageEvent } from "@/hooks/queries/use-events";

import { formatCostUSD, formatDuration, formatTokenCount, getLlmProviderLabel, getLlmServiceLabel } from "@journey/schemas";

import { formatTimestamp } from "./event-helpers";

// =============================================================================
// TYPES
// =============================================================================

export interface LlmUsageTableProps {
  events: LlmUsageEvent[];
  searchValue: string;
  isLoading?: boolean;
  pageSize: number;
  pageIndex: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onEventClick?: (event: LlmUsageEvent) => void;
  selectedEventId?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function LlmUsageTable({
  events,
  searchValue,
  isLoading,
  pageSize,
  pageIndex,
  onPageChange,
  onPageSizeChange,
  onEventClick,
  selectedEventId,
}: LlmUsageTableProps) {
  const filteredEvents = useMemo(() => {
    if (!searchValue) return events;
    const search = searchValue.toLowerCase();
    return events.filter((event) => {
      const service = event.service.toLowerCase();
      const model = event.model.toLowerCase();
      const provider = event.provider.toLowerCase();
      const journeyName = event.journeyName?.toLowerCase() || "";
      return service.includes(search) || model.includes(search) || provider.includes(search) || journeyName.includes(search);
    });
  }, [events, searchValue]);

  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const currentPageIndex = Math.min(pageIndex, pageCount - 1);
  const start = currentPageIndex * pageSize;
  const paginatedEvents = filteredEvents.slice(start, start + pageSize);

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Timestamp</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead className="text-right">Prompt</TableHead>
            <TableHead className="text-right">Compl</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead className="w-full">Journey</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="py-1 pl-4"><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell className="py-1"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-1"><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell className="py-1"><Skeleton className="h-4 w-14" /></TableCell>
              <TableCell className="py-1 text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
              <TableCell className="py-1 text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
              <TableCell className="py-1 text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
              <TableCell className="py-1 text-right"><Skeleton className="h-4 w-14 ml-auto" /></TableCell>
              <TableCell className="py-1 text-right"><Skeleton className="h-4 w-14 ml-auto" /></TableCell>
              <TableCell className="py-1"><Skeleton className="h-4 w-32" /></TableCell>
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
              <TableHead className="text-xs font-medium text-muted-foreground whitespace-nowrap">Service</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground whitespace-nowrap">Model</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground whitespace-nowrap">Provider</TableHead>
              <TableHead className="text-right text-xs font-medium text-muted-foreground whitespace-nowrap">Prompt</TableHead>
              <TableHead className="text-right text-xs font-medium text-muted-foreground whitespace-nowrap">Compl</TableHead>
              <TableHead className="text-right text-xs font-medium text-muted-foreground whitespace-nowrap">Total</TableHead>
              <TableHead className="text-right text-xs font-medium text-muted-foreground whitespace-nowrap">Cost</TableHead>
              <TableHead className="text-right text-xs font-medium text-muted-foreground whitespace-nowrap">Duration</TableHead>
              <TableHead className="w-full text-xs font-medium text-muted-foreground">Journey</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  No LLM usage events found
                </TableCell>
              </TableRow>
            ) : (
              paginatedEvents.map((event) => (
                <TableRow
                  key={event.id}
                  className={cn(
                    "bg-transparent transition-colors cursor-pointer hover:bg-muted/30",
                    selectedEventId === event.id && "bg-muted/50"
                  )}
                  onClick={() => onEventClick?.(event)}
                >
                  <TableCell className="w-40 py-1 pl-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(event.createdAt)}
                  </TableCell>
                  <TableCell className="py-1 font-mono text-xs whitespace-nowrap">{getLlmServiceLabel(event.service)}</TableCell>
                  <TableCell className="py-1 font-mono text-xs whitespace-nowrap">{event.model}</TableCell>
                  <TableCell className="py-1 font-mono text-xs text-muted-foreground whitespace-nowrap">{getLlmProviderLabel(event.provider)}</TableCell>
                  <TableCell className="py-1 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {formatTokenCount(event.promptTokens)}
                  </TableCell>
                  <TableCell className="py-1 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {formatTokenCount(event.completionTokens)}
                  </TableCell>
                  <TableCell className="py-1 text-right font-mono text-xs whitespace-nowrap">
                    {formatTokenCount(event.totalTokens)}
                  </TableCell>
                  <TableCell className="py-1 text-right font-mono text-xs whitespace-nowrap">{formatCostUSD(event.costUSD)}</TableCell>
                  <TableCell className="py-1 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {formatDuration(event.durationMs)}
                  </TableCell>
                  <TableCell className="py-1 truncate max-w-0 text-xs text-muted-foreground">
                    {event.journeyName || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePaginationFooter
        totalCount={filteredEvents.length}
        currentPageIndex={currentPageIndex}
        pageCount={pageCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        itemLabel="event"
      />
    </div>
  );
}
