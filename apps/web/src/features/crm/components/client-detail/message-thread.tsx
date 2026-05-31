
import { CheckCircle2, CheckCheck, Clock, MessageCircle, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { useCrmClientMessages, type DirectMessage } from "@/features/crm/hooks/queries";
import { cn } from "@/shared/lib/utils";

interface MessageThreadProps {
  clientId: string;
  className?: string;
}

export function MessageThread({ clientId, className }: MessageThreadProps) {
  const { data: messages = [], isLoading } = useCrmClientMessages(clientId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className={cn("p-4 space-y-6", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'} animate-pulse`}>
            <div className={`h-12 w-2/3 rounded-2xl bg-muted/20 ${i % 2 === 0 ? 'rounded-br-sm' : 'rounded-bl-sm'}`} />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center h-full", className)}>
        <div className="size-12 rounded-full bg-muted/30 flex items-center justify-center mb-4 ring-1 ring-border/50">
          <MessageCircle className="size-6 text-muted-foreground/60" />
        </div>
        <h3 className="font-medium text-foreground mb-1">No messages yet</h3>
        <p className="text-sm text-muted-foreground max-w-[200px]">
          Send a message to start the conversation
        </p>
      </div>
    );
  }

  // Reverse messages to show newest at bottom (assuming API returns newest first)
  // If API returns oldest first, remove reverse. Usually chat APIs return newest first for pagination.
  // Based on previous code, it was reversing.
  const sortedMessages = [...messages].reverse();

  return (
    <ScrollArea className={cn("flex-1", className)} ref={scrollRef}>
      <div className="p-4 space-y-4 min-h-full flex flex-col justify-end">
        {sortedMessages.map((message, index) => {
             // Check if previous message was from same sender to group visually
             const prevMessage = sortedMessages[index - 1];
             const isSequence = prevMessage && prevMessage.sentBy === message.sentBy;
             return (
                <ChatBubble 
                    key={message.id} 
                    message={message} 
                    isSequence={!!isSequence} 
                />
             );
        })}
      </div>
    </ScrollArea>
  );
}


interface ChatBubbleProps {
  message: DirectMessage;
  isSequence: boolean;
}

export function ChatBubble({ message, isSequence }: ChatBubbleProps) {
  // Infer direction: If sender matches the client's ID, it's inbound (from customer).
  // Otherwise it's outbound (from agent/bot).
  const isOutbound = message.sentBy !== message.clientId;
  const isSelf = isOutbound;

  const statusConfig = {
    pending: { icon: Clock, color: "text-muted-foreground" },
    sent: { icon: CheckCircle2, color: "text-primary/40" },
    delivered: { icon: CheckCircle2, color: "text-primary" },
    read: { icon: CheckCheck, color: "text-primary" },
    failed: { icon: XCircle, color: "text-destructive" },
  };

  const status = statusConfig[message.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;
  
  const timestamp = message.sentAt || message.createdAt;
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <div className={cn(
        "flex w-full",
        isSelf ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
          "flex max-w-[85%] flex-col gap-1", 
          isSelf ? "items-end" : "items-start"
      )}>
        {/* Sender Name (only if not sequence and not self, usually) */}
        {!isSequence && !isSelf && message.sentByName && (
             <span className="text-[11px] text-muted-foreground ml-3 mb-0.5">
                {message.sentByName}
             </span>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "px-4 py-2.5 shadow-sm text-sm leading-relaxed break-words relative group transition-all",
            // Shape
            "rounded-2xl",
            isSelf 
                ? "rounded-tr-sm bg-primary text-primary-foreground" 
                : "rounded-tl-sm bg-muted/80 text-foreground border border-border/40",
            // Spacing
            isSequence && (isSelf ? "rounded-tr-2xl mt-0.5" : "rounded-tl-2xl mt-0.5")
          )}
        >
          {message.content}
        </div>

        {/* Footer: Time + Status */}
        <div className={cn(
            "flex items-center gap-1.5 px-1 mt-0.5 opacity-90",
            isSelf ? "justify-end" : "justify-start"
        )}>
            <span className="text-[10px] text-muted-foreground/70">
                {formattedTime}
            </span>
            {isSelf && (
                 <StatusIcon className={cn("size-3", status.color)} />
            )}
        </div>

        {/* Error Message */}
        {message.errorMessage && (
          <p className="text-xs text-destructive font-medium px-1">{message.errorMessage}</p>
        )}
      </div>
    </div>
  );
}
