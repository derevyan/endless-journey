/**
 * Message Bubble
 *
 * Displays a single chat message with styling based on role.
 * For assistant messages, also displays insights and state changes.
 */

import { Activity, ChevronDown, ChevronRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { cn } from "@/shared/lib/utils";
import { getAgentColorClasses } from "../../../lib/colors";
import type { PreviewMessage } from "../../../lib/types";
import { DynamicIcon } from "../../common/dynamic-icon";

interface MessageBubbleProps {
  message: PreviewMessage;
  agentName?: string;
  agentAvatar?: string;
  agentColor?: string;
}

export function MessageBubble({ message, agentName = "Assistant", agentAvatar = "Bot", agentColor = "indigo" }: MessageBubbleProps) {
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const theme = getAgentColorClasses(agentColor);

  const hasInsights = message.insights && message.insights.length > 0;
  const hasStateChanges = message.stateChanges && message.stateChanges.length > 0;
  const hasAnalysisData = hasInsights || hasStateChanges;

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">{message.content}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {/* Agent Avatar (only for assistant) */}
      {!isUser && (
        <Avatar className={cn("h-8 w-8 border", theme.border)}>
          <AvatarFallback className={cn(theme.softBg, theme.text)}>
            <DynamicIcon name={agentAvatar} size={16} />
          </AvatarFallback>
        </Avatar>
      )}

      <div className="max-w-[80%] space-y-2">
        {/* Message Bubble */}
        <div className={cn("rounded-2xl px-4 py-2.5", isUser ? "border rounded-tr-xs" : "bg-primary-foreground border rounded-tl-xs")}>
          {/* Agent Name (only for assistant) */}
          {!isUser && <div className={cn("text-[10px] font-medium mb-1", theme.text)}>{agentName}</div>}

          {/* Message Content */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>

          {/* Timestamp */}
          <div className={cn("text-[10px] mt-1", isUser ? "text-zinc-500 dark:text-primary-foreground/70" : "text-muted-foreground")}>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>

        {/* Analysis Insights (only for assistant messages with data) */}
        {!isUser && hasAnalysisData && (
          <Collapsible open={isInsightsOpen} onOpenChange={setIsInsightsOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors group">
              {isInsightsOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              <Sparkles className="size-3" />
              <span>
                {hasStateChanges ? `${message.stateChanges!.length} state change${message.stateChanges!.length > 1 ? "s" : ""}` : ""}
                {hasStateChanges && hasInsights ? " • " : ""}
                {hasInsights ? `${message.insights!.length} agent insight${message.insights!.length > 1 ? "s" : ""}` : ""}
              </span>
            </CollapsibleTrigger>

            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2">
              <div className="mt-2 space-y-2">
                {/* State Changes */}
                {hasStateChanges && (
                  <div className="bg-muted/30 border border-border/30 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      <Activity className="size-3" />
                      State Updates
                    </div>
                    {message.stateChanges!.map((change, idx) => (
                      <StateChangeItem key={`${change.parameterId}-${idx}`} change={change} />
                    ))}
                  </div>
                )}

                {/* Agent Insights */}
                {hasInsights && (
                  <div className="space-y-1.5">
                    {message.insights!.map((insight) => (
                      <InsightBadge key={insight.id} insight={insight} />
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

/**
 * State Change Item - displays a single parameter change
 */
function StateChangeItem({ change }: { change: NonNullable<PreviewMessage["stateChanges"]>[number] }) {
  const prev = typeof change.previousValue === "number" ? change.previousValue : String(change.previousValue);
  const next = typeof change.newValue === "number" ? change.newValue : String(change.newValue);
  const isIncrease = typeof change.newValue === "number" && typeof change.previousValue === "number" && change.newValue > change.previousValue;
  const isDecrease = typeof change.newValue === "number" && typeof change.previousValue === "number" && change.newValue < change.previousValue;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="font-medium text-foreground">{change.parameterName}</span>
      <span className="text-muted-foreground">{prev}</span>
      <span className="text-muted-foreground">→</span>
      <span
        className={cn(
          "font-medium",
          isIncrease && "text-emerald-600 dark:text-emerald-400",
          isDecrease && "text-rose-600 dark:text-rose-400",
          !isIncrease && !isDecrease && "text-foreground"
        )}
      >
        {next}
        {isIncrease && <TrendingUp className="inline size-3 ml-0.5" />}
        {isDecrease && <TrendingDown className="inline size-3 ml-0.5" />}
      </span>
    </div>
  );
}

/**
 * Insight Badge - displays analysis from a single agent
 */
function InsightBadge({ insight }: { insight: NonNullable<PreviewMessage["insights"]>[number] }) {
  const theme = getAgentColorClasses(insight.agentColor || "blue");

  return (
    <div className={cn("flex items-start gap-2 p-2 rounded-lg border", theme.softBg, theme.border)}>
      <Avatar className={cn("h-5 w-5 border", theme.bg)}>
        <AvatarFallback className="bg-transparent text-white">
          <DynamicIcon name={insight.agentAvatar || "Bot"} size={10} />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className={cn("text-[10px] font-medium", theme.text)}>{insight.agentName}</div>
        {insight.analysis.length > 0 && (
          <ul className="mt-0.5 space-y-0.5">
            {insight.analysis.map((point, idx) => (
              <li key={idx} className="text-[10px] text-muted-foreground leading-tight">
                • {point}
              </li>
            ))}
          </ul>
        )}
        {insight.updatesMade.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {insight.updatesMade.map((update) => (
              <span key={update.id} className="text-[9px] bg-background/50 px-1 py-0.5 rounded border border-border/50">
                {update.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
