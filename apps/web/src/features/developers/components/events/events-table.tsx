/**
 * Events Table Component
 *
 * Table display for event logs with columns for timestamp, type, level, message, source.
 * Supports row click to open event details.
 *
 * @module components/developers/events/events-table
 */

import { useMemo } from "react";

import { LogLevelBadge } from "@/shared/components/ui/badges";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { TablePaginationFooter } from "@/shared/components/ui/table-pagination-footer";
import { cn } from "@/shared/lib/utils";

import { EventTypes, type EnrichedEvent } from "@journey/schemas";

import { formatEventTypeShort, formatTimestamp, getEventMetadata } from "./event-helpers";

// =============================================================================
// TYPES
// =============================================================================

export interface EventsTableProps {
  events: EnrichedEvent[];
  searchValue: string;
  isLoading?: boolean;
  pageSize: number;
  pageIndex: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  expandMessages?: boolean;
  onEventClick?: (event: EnrichedEvent) => void;
  selectedEventId?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function getMessageFromPayload(payload: unknown, type: string, expandMessages: boolean = false): string {
  const payloadObj = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};

  let message: string;
  if (payloadObj.text) {
    message = String(payloadObj.text);
  } else if (payloadObj.message) {
    message = String(payloadObj.message);
  } else if (payloadObj.buttonId) {
    message = `Button: ${payloadObj.buttonId}`;
  } else if (payloadObj.tagName) {
    message = `Tag: ${payloadObj.tagName}`;
  } else if (payloadObj.pipelineName) {
    message = `Pipeline: ${payloadObj.pipelineName}`;
  } else if (payloadObj.stageName) {
    message = `Stage: ${payloadObj.stageName}`;
  } else if (payloadObj.toStageName) {
    message = `${payloadObj.fromStageName || "?"} → ${payloadObj.toStageName}`;
  } else if (payloadObj.journeyName) {
    message = `Journey: ${payloadObj.journeyName}`;
  } else if (payloadObj.botName) {
    message = `Bot: ${payloadObj.botName}`;
  } else if (payloadObj.key) {
    message = `${payloadObj.key}: ${JSON.stringify(payloadObj.value)}`;
  } else if (type === EventTypes.JOURNEY_SESSION_STARTED) {
    message = "Journey session started";
  } else if (type === EventTypes.JOURNEY_SESSION_COMPLETED) {
    message = "Journey session completed";
  } else {
    message = expandMessages ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
  }

  if (!expandMessages) {
    return message.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  }

  return message;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function EventsTable({
  events,
  searchValue,
  isLoading,
  pageSize,
  pageIndex,
  onPageChange,
  onPageSizeChange,
  expandMessages = false,
  onEventClick,
  selectedEventId,
}: EventsTableProps) {
  const filteredEvents = useMemo(() => {
    if (!searchValue) return events;
    const search = searchValue.toLowerCase();
    return events.filter((event) => {
      const message = getMessageFromPayload(event.payload, event.type, true).toLowerCase();
      const type = event.type.toLowerCase();
      const meta = getEventMetadata(event.type);
      const category = meta?.category?.toLowerCase() || "";
      return message.includes(search) || type.includes(search) || category.includes(search);
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
            <TableHead>Type</TableHead>
            <TableHead>Level</TableHead>
            <TableHead className="w-full">Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="py-1 pl-4"><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell className="py-1"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="py-1"><Skeleton className="h-5 w-12" /></TableCell>
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
              <TableHead className="text-xs font-medium text-muted-foreground whitespace-nowrap">Level</TableHead>
              <TableHead className="w-full text-xs font-medium text-muted-foreground">Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No events found
                </TableCell>
              </TableRow>
            ) : (
              paginatedEvents.map((event) => {
                const meta = getEventMetadata(event.type);
                const isSelected = selectedEventId === event.id;

                return (
                  <TableRow
                    key={event.id}
                    className={cn("bg-transparent transition-colors hover:bg-muted/30 cursor-pointer", isSelected && "bg-muted/50")}
                    onClick={() => onEventClick?.(event)}
                  >
                    <TableCell className="w-40 py-1 pl-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(event.timestamp)}
                    </TableCell>
                    <TableCell className="py-1 font-mono text-xs whitespace-nowrap">{formatEventTypeShort(event.type)}</TableCell>
                    <TableCell className="py-1 whitespace-nowrap">
                      <LogLevelBadge level={meta?.level ?? "info"} size="md" />
                    </TableCell>
                    <TableCell className={cn("py-1 font-mono text-xs text-muted-foreground", expandMessages ? "whitespace-pre-wrap break-words" : "truncate max-w-0")}>
                      {getMessageFromPayload(event.payload, event.type, expandMessages)}
                    </TableCell>
                  </TableRow>
                );
              })
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
