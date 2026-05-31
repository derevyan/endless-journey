/**
 * Conversation Panel Component
 *
 * Left panel with message thread and composer.
 *
 * @module components/crm/client-detail/conversation-panel
 */


import { CornerDownLeft, Loader2, MessageSquareOff, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { useSendCrmMessage } from "@/features/crm/hooks/queries";
import { notify } from "@/shared/lib/ui/notify";
import { cn } from "@/shared/lib/utils";

import { MessageThread } from "./message-thread";

interface Channel {
  id: string;
  name: string;
  platform: string;
}

interface ConversationPanelProps {
  clientId: string;
  clientName: string;
  channels: Channel[];
  onMessageSent: () => void;
  className?: string;
}

export function ConversationPanel({
  clientId,
  clientName,
  channels,
  onMessageSent,
  className,
}: ConversationPanelProps) {
  // Auto-select first channel
  const activeChannel = channels[0] ?? null;

  return (
    <div className={cn("flex-1 min-w-0 flex flex-col bg-background", className)}>
      {/* Header */}
      <div className="px-6 py-4 flex flex-col justify-center border-b min-h-[72px]">
        <h2 className="font-semibold text-base tracking-tight">{clientName}</h2>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block size-1.5 rounded-full bg-emerald-500/60" />
           {activeChannel ? `via ${activeChannel.name}` : "No channel connected"}
        </p>
      </div>

      {/* Message Thread */}
      <MessageThread clientId={clientId} className="flex-1 bg-muted/50" />

      {/* Composer */}
      <div className="p-4 border-t bg-background">
        <MessageComposer
            clientId={clientId}
            clientName={clientName}
            channel={activeChannel}
            onMessageSent={onMessageSent}
        />
      </div>
    </div>
  );
}

interface MessageComposerProps {
  clientId: string;
  clientName: string;
  channel: Channel | null;
  onMessageSent?: () => void;
}

function MessageComposer({
  clientId,
  clientName,
  channel,
  onMessageSent,
}: MessageComposerProps) {
  const [content, setContent] = useState("");

  const sendMutation = useSendCrmMessage();

  const handleSend = () => {
    if (!content.trim()) {
      notify.error("Please enter a message");
      return;
    }

    if (!channel) {
      notify.error("No channel available");
      return;
    }

    sendMutation.mutate(
      {
        clientId,
        input: {
          channelId: channel.id,
          content: content.trim(),
        },
      },
      {
        onSuccess: () => {
          setContent("");
          onMessageSent?.();
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center space-y-2 border-2 border-dashed rounded-lg bg-muted/10">
        <div className="p-2 rounded-full bg-muted/20">
             <MessageSquareOff className="size-5 text-muted-foreground" />
        </div>
        <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Messaging Unavailable</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Connect a channel to start a conversation with this client.
            </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Message Input */}
      <div className="relative shadow-sm rounded-lg border focus-within:ring-2 focus-within:ring-ring focus-within:border-primary transition-all bg-background">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${clientName}...`}
          className="min-h-[100px] w-full resize-none border-0 focus-visible:ring-0 p-3 text-sm leading-relaxed bg-transparent"
        />
        
        {/* Actions Bar */}
        <div className="flex items-center justify-between p-2 border-t bg-muted/5 rounded-b-lg">
             <div className="flex items-center gap-2">
                {/* Future attachments or templates could go here */}
             </div>
             
             <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-1">
                    <CornerDownLeft className="size-3" />
                    to send
                </span>
                <Button
                    size="sm"
                    className="h-8 px-4 rounded-md shadow-none transition-all"
                    onClick={handleSend}
                    disabled={!content.trim() || sendMutation.isPending}
                >
                    {sendMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    ) : (
                    <Send className="size-3.5 mr-1.5" />
                    )}
                    Send
                </Button>
             </div>
        </div>
      </div>
    </div>
  );
}
