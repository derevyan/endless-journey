/**
 * LLM Usage Detail Sheet
 *
 * Side panel showing full LLM usage event details including I/O content,
 * tokens, cost, and performance metrics.
 *
 * @module components/developers/events/llm-usage-detail-sheet
 */

import { format } from "date-fns";
import { ChevronDown, ChevronRight, Copy, ExternalLink, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { ExpandableTextEditor } from "@/shared/components/ui/expandable-text-editor";
import { JsonHighlight } from "@/shared/components/ui/json-highlight";
import { Progress } from "@/shared/components/ui/progress";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Separator } from "@/shared/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/shared/components/ui/sheet";
import { notify } from "@/shared/lib/ui/notify";

import type { LlmUsageEvent } from "@/hooks/queries/use-events";

import {
  formatCostUSD,
  formatDuration,
  formatTokenCount,
  getLlmProviderLabel,
  getLlmServiceLabel,
  getLlmServiceVariant,
} from "@journey/schemas";

import { InfoRow, Section } from "./detail-sheet-helpers";

// =============================================================================
// HELPERS
// =============================================================================

/** Calculate tokens per second */
function calculateTokensPerSecond(tokens: number, durationMs: number | null): string {
  if (!durationMs || durationMs === 0) return "-";
  const tokensPerSecond = (tokens / durationMs) * 1000;
  if (tokensPerSecond >= 1000) return `${(tokensPerSecond / 1000).toFixed(1)}K`;
  return tokensPerSecond.toFixed(0);
}

/** Calculate cost per 1K tokens */
function calculateCostPer1K(costUSD: string, tokens: number): string {
  if (tokens === 0) return "-";
  const cost = parseFloat(costUSD);
  if (isNaN(cost)) return "-";
  const per1K = (cost / tokens) * 1000;
  return `$${per1K.toFixed(4)}`;
}

/** Collapsible section for I/O content */
function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number | string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-1 hover:bg-muted/30 rounded px-2 -mx-2 text-sm font-medium">
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span>{title}</span>
        {count !== undefined && <span className="text-muted-foreground font-normal">({count})</span>}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** Read-only text box with expand button (uses ExpandableTextEditor) */
function ReadOnlyTextBox({ content, title }: { content: string; title: string }) {
  const isJson = useMemo(() => {
    if (!content || typeof content !== "string") return false;
    const trimmed = content.trim();
    return (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));
  }, [content]);

  return (
    <ExpandableTextEditor value={content} title={title}>
      <div className="group relative bg-muted/20 hover:bg-muted/30 transition-colors rounded-lg border border-border/50 overflow-hidden">
        <pre className="text-[11px] p-4 pr-10 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
          {isJson ? <JsonHighlight value={content} /> : content}
        </pre>
      </div>
    </ExpandableTextEditor>
  );
}

/** Format input messages as simple text */
function formatInputMessagesAsText(messages: Array<{ role: string; content: string; toolCallId?: string }>): string {
  return messages
    .map((msg) => {
      const prefix = msg.role.toUpperCase();
      return `[${prefix}]\n${msg.content}`;
    })
    .join("\n\n");
}

// =============================================================================
// PROPS
// =============================================================================

interface LlmUsageDetailSheetProps {
  event: LlmUsageEvent | null;
  open: boolean;
  onClose: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function LlmUsageDetailSheet({ event, open, onClose }: LlmUsageDetailSheetProps) {
  if (!event) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(event.id);
    notify.success("Event ID copied");
  };

  const handleCopyMetadata = () => {
    navigator.clipboard.writeText(JSON.stringify(event.metadata, null, 2));
    notify.success("Metadata copied");
  };

  const hasMetadata = !!(
    event.metadata &&
    typeof event.metadata === "object" &&
    Object.keys(event.metadata).length > 0
  );

  // Pre-format input messages as text for display and modal
  const inputMessagesText = event.inputMessages ? formatInputMessagesAsText(event.inputMessages) : "";
  const inputMessagesCharCount = inputMessagesText.length;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[500px] max-w-[95vw] p-0 gap-0" hideClose>
        <SheetTitle className="sr-only">LLM Usage: {getLlmServiceLabel(event.service)}</SheetTitle>
        <SheetDescription className="sr-only">
          View full LLM usage event details including tokens and cost
        </SheetDescription>

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b bg-muted/5">
          <div className="space-y-1.5 font-sans">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight">{getLlmServiceLabel(event.service)}</h2>
              <Badge
                variant={getLlmServiceVariant(event.service)}
                className="px-2 py-0 h-5 text-[10px] font-bold uppercase tracking-wider"
              >
                {event.service}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <span className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono border border-border/40">
                {event.model}
              </span>
              <span>via</span>
              <span className="text-foreground/80">{getLlmProviderLabel(event.provider)}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0 -mr-2 -mt-2 hover:bg-muted/50 rounded-full"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <ScrollArea className="flex-1 h-[calc(100vh-80px)]">
          <div className="p-4 space-y-6">
            {/* Event Info */}
            <Section title="Event Info">
              <InfoRow label="Event ID">
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">
                    {event.id}
                  </code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyId}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </InfoRow>
              <InfoRow label="Timestamp">{format(new Date(event.createdAt), "yyyy-MM-dd HH:mm:ss.SSS")}</InfoRow>
              <InfoRow label="Service">
                <Badge variant={getLlmServiceVariant(event.service)} className="text-xs">
                  {event.service}
                </Badge>
              </InfoRow>
              {event.module && <InfoRow label="Module">{event.module}</InfoRow>}
              {event.tool && <InfoRow label="Tool">{event.tool}</InfoRow>}
            </Section>

            <Separator />

            {/* Model Info */}
            <Section title="Model">
              <InfoRow label="Model">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{event.model}</code>
              </InfoRow>
              <InfoRow label="Provider">
                <span>{getLlmProviderLabel(event.provider)}</span>
              </InfoRow>
              {event.finishReason && (
                <InfoRow label="Finish Reason">
                  <Badge variant={event.finishReason === "error" ? "destructive" : "outline"} className="text-xs">
                    {event.finishReason}
                  </Badge>
                </InfoRow>
              )}
              {event.errorMessage && (
                <InfoRow label="Error">
                  <span className="text-destructive text-xs">{event.errorMessage}</span>
                </InfoRow>
              )}
            </Section>

            <Separator />

            {/* I/O Content - System Prompt */}
            {event.systemPrompt && (
              <>
                <CollapsibleSection title="System Prompt" count={`${event.systemPrompt.length.toLocaleString()} chars`}>
                  <ReadOnlyTextBox content={event.systemPrompt} title="System Prompt" />
                </CollapsibleSection>
                <Separator />
              </>
            )}

            {/* I/O Content - Input Messages */}
            {event.inputMessages && event.inputMessages.length > 0 && (
              <>
                <CollapsibleSection title="Input Messages" count={`${inputMessagesCharCount.toLocaleString()} chars`}>
                  <ReadOnlyTextBox content={inputMessagesText} title="Input Messages" />
                </CollapsibleSection>
                <Separator />
              </>
            )}

            {/* I/O Content - Model Response / Transcript Output */}
            {event.outputContent && (
              <>
                <CollapsibleSection
                  title={
                    event.service === "audio-service" && event.module === "stt" ? "Transcript Output" : "Model Response"
                  }
                  count={`${event.outputContent.length.toLocaleString()} chars`}
                >
                  <ReadOnlyTextBox
                    content={event.outputContent}
                    title={
                      event.service === "audio-service" && event.module === "stt"
                        ? "Transcript Output"
                        : "Model Response"
                    }
                  />
                </CollapsibleSection>
                <Separator />
              </>
            )}

            {/* I/O Content - Tool Calls */}
            {event.outputToolCalls && event.outputToolCalls.length > 0 && (
              <>
                <CollapsibleSection title="Tool Calls" count={event.outputToolCalls.length} defaultOpen={true}>
                  <div className="space-y-3">
                    {event.outputToolCalls.map((tc, idx) => (
                      <div
                        key={idx}
                        className="group relative bg-muted/20 hover:bg-muted/30 transition-colors rounded-lg border border-border/50 overflow-hidden"
                      >
                        {/* Header */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/40 font-sans">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-xs font-bold text-foreground/90 break-all">{tc.name}</span>
                          </div>
                        </div>

                        {/* Arguments */}
                        <div className="relative">
                          <pre className="text-[11px] p-4 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap max-h-[250px] overflow-y-auto">
                            <JsonHighlight value={tc.args} />
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
                <Separator />
              </>
            )}

            {/* TTS Input Text - for audio-service events */}
            {event.service === "audio-service" && typeof event.metadata?.prompt === "string" && (
              <>
                <CollapsibleSection
                  title="TTS Input Text"
                  count={`${event.metadata.prompt.length.toLocaleString()} chars`}
                >
                  <ReadOnlyTextBox content={event.metadata.prompt} title="TTS Input Text" />
                </CollapsibleSection>
                <Separator />
              </>
            )}

            {/* Token Usage with Progress Bar */}
            <Section title="Token Usage">
              {/* Progress bar showing prompt vs completion ratio */}
              <div className="mb-4 bg-muted/30 p-3 rounded-lg border border-border/40">
                <div className="flex justify-between text-[11px] font-medium text-muted-foreground mb-2 px-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full bg-primary/60" />
                    <span>
                      Prompt ({event.totalTokens > 0 ? Math.round((event.promptTokens / event.totalTokens) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-right">
                    <span>
                      Completion (
                      {event.totalTokens > 0 ? Math.round((event.completionTokens / event.totalTokens) * 100) : 0}%)
                    </span>
                    <div className="size-2 rounded-full bg-primary" />
                  </div>
                </div>
                <Progress
                  value={event.totalTokens > 0 ? (event.promptTokens / event.totalTokens) * 100 : 0}
                  className="h-1.5 bg-primary/20"
                />
              </div>
              <InfoRow label="Prompt Tokens">
                <span className="font-mono">{formatTokenCount(event.promptTokens)}</span>
                <span className="text-muted-foreground ml-1">({event.promptTokens.toLocaleString()})</span>
              </InfoRow>
              <InfoRow label="Completion Tokens">
                <span className="font-mono">{formatTokenCount(event.completionTokens)}</span>
                <span className="text-muted-foreground ml-1">({event.completionTokens.toLocaleString()})</span>
              </InfoRow>
              <InfoRow label="Total Tokens">
                <span className="font-mono font-medium">{formatTokenCount(event.totalTokens)}</span>
                <span className="text-muted-foreground ml-1">({event.totalTokens.toLocaleString()})</span>
              </InfoRow>
            </Section>

            <Separator />

            {/* Cost & Performance */}
            <Section title="Performance">
              <InfoRow label="Duration">
                <span className="font-mono">{formatDuration(event.durationMs)}</span>
              </InfoRow>
              <InfoRow label="Speed">
                <span className="font-mono">{calculateTokensPerSecond(event.totalTokens, event.durationMs)} tok/s</span>
              </InfoRow>
              <InfoRow label="Cost">
                <span className="font-mono font-medium">{formatCostUSD(event.costUSD)}</span>
              </InfoRow>
              <InfoRow label="Cost per 1K tokens">
                <span className="font-mono text-muted-foreground">
                  {calculateCostPer1K(event.costUSD, event.totalTokens)}
                </span>
              </InfoRow>
            </Section>

            {/* Journey Context (if linked) */}
            {event.journeyId && (
              <>
                <Separator />
                <Section title="Journey Context">
                  {event.journeyName && (
                    <InfoRow label="Journey">
                      <div className="flex items-center gap-2">
                        <span>{event.journeyName}</span>
                        {event.journeySlug && (
                          <Button variant="ghost" size="icon" className="h-5 w-5" asChild>
                            <a href={`/journeys/${event.journeySlug}`} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </InfoRow>
                  )}
                  <InfoRow label="Journey ID">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">
                      {event.journeyId}
                    </code>
                  </InfoRow>
                  {event.journeySessionId && (
                    <InfoRow label="Session ID">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[180px]">
                        {event.journeySessionId}
                      </code>
                    </InfoRow>
                  )}
                  {event.clientId && (
                    <InfoRow label="Client ID">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[180px]">
                          {event.clientId}
                        </code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                          <a href={`/crm/clients/${event.clientId}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </InfoRow>
                  )}
                  <div className="h-4" />
                </Section>
              </>
            )}

            {/* Metadata (if present) */}
            {hasMetadata && (
              <>
                <Separator />
                <Section
                  title="Metadata"
                  action={
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleCopyMetadata}>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  }
                >
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
