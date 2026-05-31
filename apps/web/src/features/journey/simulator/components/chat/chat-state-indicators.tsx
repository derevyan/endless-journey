/**
 * Chat State Indicators
 *
 * Visual indicators for different chat states: empty, waiting for user, processing.
 *
 * @module features/simulator/components/chat/chat-state-indicators
 */

import { Info, MessageCircle } from "lucide-react";

// Re-export shared ProcessingIndicator for backward compatibility
export { ProcessingIndicator } from "@/shared/components/chat";

export function NoChatMessages() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
      <div className="p-2.5 rounded-full bg-muted/40">
        <MessageCircle className="size-5 text-muted-foreground/60" />
      </div>
      <p className="text-xs text-muted-foreground/60">No messages yet</p>
    </div>
  );
}

export function WaitingForUserIndicator() {
  return (
    <div className="flex items-center gap-3 mx-3 my-2 px-4 py-3">
      <div className="flex items-center justify-center size-8 shrink-0">
        <Info className="size-4 text-orange-300" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">Your turn</p>
        <p className="text-xs text-muted-foreground">Click a button or type a message</p>
      </div>
    </div>
  );
}
