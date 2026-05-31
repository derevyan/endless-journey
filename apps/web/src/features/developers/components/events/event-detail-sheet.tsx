/**
 * Event Detail Sheet
 *
 * Side panel showing full event details, payload, and context.
 * Displays version, correlation ID, causedBy for event tracing.
 *
 * @module components/developers/events/event-detail-sheet
 */

import { format } from "date-fns";
import { Copy, ExternalLink, GitBranch, Link2, X } from "lucide-react";

import type { EnrichedEvent } from "@journey/schemas";

import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { JsonHighlight } from "@/shared/components/ui/json-highlight";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Separator } from "@/shared/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/shared/components/ui/sheet";
import { notify } from "@/shared/lib/ui/notify";

import { InfoRow, Section } from "./detail-sheet-helpers";
import { formatEventTypeLabel, getCategoryLabel, getEventMetadata } from "./event-helpers";

// =============================================================================
// PROPS
// =============================================================================

interface EventDetailSheetProps {
  event: EnrichedEvent | null;
  open: boolean;
  onClose: () => void;
  /** Callback to view related events by correlation ID */
  onViewRelated?: (correlationId: string) => void;
  /** Callback to view parent event (causedBy) */
  onViewParent?: (eventId: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function EventDetailSheet({ event, open, onClose, onViewRelated, onViewParent }: EventDetailSheetProps) {
  if (!event) return null;

  const metadata = getEventMetadata(event.type);

  const handleCopyId = () => {
    navigator.clipboard.writeText(event.id);
    notify.success("Event ID copied");
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(event.payload, null, 2));
    notify.success("Payload copied");
  };

  const handleCopyCorrelationId = () => {
    if (event.correlationId) {
      navigator.clipboard.writeText(event.correlationId);
      notify.success("Correlation ID copied");
    }
  };

  // EnrichedEvent extends BaseEvent which includes version, sequence, correlationId, causedBy
  const hasTracing = !!(event.correlationId || event.causedBy);
  const hasMetadata: boolean = !!(event.metadata && typeof event.metadata === "object" && Object.keys(event.metadata as object).length > 0);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[500px] max-w-[95vw] p-0 gap-0" hideClose>
        <SheetTitle className="sr-only">Event Details: {event.type}</SheetTitle>
        <SheetDescription className="sr-only">View full event details including payload and metadata</SheetDescription>

        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{formatEventTypeLabel(event.type)}</h2>
            <p className="text-sm text-muted-foreground font-mono">{event.type}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <ScrollArea className="flex-1 h-[calc(100vh-80px)]">
          <div className="p-4 space-y-6">
            {/* Basic Info */}
            <Section title="Event Info">
              <InfoRow label="Event ID">
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">{event.id}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyId}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </InfoRow>
              <InfoRow label="Timestamp">{format(new Date(event.timestamp), "yyyy-MM-dd HH:mm:ss.SSS")}</InfoRow>
              {event.version && (
                <InfoRow label="Version">
                  <Badge variant="outline" className="text-xs font-mono">
                    v{event.version}
                  </Badge>
                </InfoRow>
              )}
              {event.sequence !== undefined && (
                <InfoRow label="Sequence">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">#{event.sequence}</code>
                </InfoRow>
              )}
              {metadata && (
                <>
                  <InfoRow label="Category">{getCategoryLabel(metadata.category)}</InfoRow>
                  <InfoRow label="Level">{metadata.level.toUpperCase()}</InfoRow>
                  <InfoRow label="Description">
                    <span className="text-muted-foreground">{metadata.description}</span>
                  </InfoRow>
                </>
              )}
              <InfoRow label="Node ID">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">{event.nodeId}</code>
              </InfoRow>
            </Section>

            {/* Tracing (if present) */}
            {hasTracing && (
              <>
                <Separator />
                <Section title="Event Tracing" icon={<GitBranch className="h-4 w-4" />}>
                  {event.correlationId && (
                    <InfoRow label="Correlation ID">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[150px]">
                          {event.correlationId.slice(0, 8)}...
                        </code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyCorrelationId}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        {onViewRelated && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onViewRelated(event.correlationId!)}
                            title="View related events"
                          >
                            <Link2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </InfoRow>
                  )}
                  {event.causedBy && (
                    <InfoRow label="Caused By">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[150px]">
                          {event.causedBy.slice(0, 8)}...
                        </code>
                        {onViewParent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => onViewParent(event.causedBy!)}
                          >
                            View Parent
                          </Button>
                        )}
                      </div>
                    </InfoRow>
                  )}
                </Section>
              </>
            )}

            <Separator />

            {/* Context */}
            <Section title="Context">
              <InfoRow label="Journey ID">
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[180px]">{event.journeyId}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <a href={`/journeys/${event.journeyId}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </InfoRow>
              {event.journeyName && <InfoRow label="Journey">{event.journeyName}</InfoRow>}
              <InfoRow label="Session">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">{event.sessionId}</code>
              </InfoRow>
              <InfoRow label="Client">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">{event.clientId}</code>
              </InfoRow>
            </Section>

            <Separator />

            {/* Payload */}
            <Section
              title="Payload"
              action={
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleCopyPayload}>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              }
            >
              <div className="bg-muted/10 rounded-md border border-border/50 overflow-hidden">
                <pre className="text-[11px] p-3 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                  <JsonHighlight value={event.payload} />
                </pre>
              </div>
            </Section>

            {/* Metadata (if present) */}
            {hasMetadata && (
              <>
                <Separator />
                <Section title="Metadata">
                  <div className="bg-muted/10 rounded-md border border-border/50 overflow-hidden">
                    <pre className="text-[11px] p-3 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                      <JsonHighlight value={event.metadata} />
                    </pre>
                  </div>
                </Section>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

