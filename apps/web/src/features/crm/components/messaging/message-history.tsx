/**
 * Message History Component
 *
 * Display history of direct messages sent to a CRM client.
 *
 * @module components/crm/messaging/message-history
 */

import { MessageCircle, CheckCircle2, CheckCheck, XCircle, Clock, User } from "lucide-react";

import { Badge } from "@/shared/components/ui/badges";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useCrmClientMessages, type DirectMessage } from "@/features/crm/hooks/queries";

interface MessageHistoryProps {
  clientId: string;
}

export function MessageHistory({ clientId }: MessageHistoryProps) {
  const { data: messages = [], isLoading } = useCrmClientMessages(clientId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <MessageCircle className="mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No messages sent yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}

function MessageItem({ message }: { message: DirectMessage }) {
  const statusConfig = {
    pending: { icon: Clock, label: "Pending", variant: "secondary" as const },
    sent: { icon: CheckCircle2, label: "Sent", variant: "default" as const },
    delivered: { icon: CheckCircle2, label: "Delivered", variant: "default" as const },
    read: { icon: CheckCheck, label: "Read", variant: "default" as const },
    failed: { icon: XCircle, label: "Failed", variant: "destructive" as const },
  };

  const status = statusConfig[message.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <MessageCircle className="size-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <Badge variant={status.variant} className="text-xs">
            <StatusIcon className="mr-1 size-3" />
            {status.label}
          </Badge>
          <span className="text-xs text-muted-foreground shrink-0">
            {message.sentAt
              ? new Date(message.sentAt).toLocaleString()
              : message.createdAt
                ? new Date(message.createdAt).toLocaleString()
                : "Unknown"}
          </span>
        </div>

        <pre className="text-sm whitespace-pre-wrap font-sans bg-muted rounded p-2">
          {message.content}
        </pre>

        {message.sentByName && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="size-3" />
            <span>Sent by {message.sentByName}</span>
          </div>
        )}

        {message.errorMessage && (
          <p className="text-xs text-destructive">{message.errorMessage}</p>
        )}
      </div>
    </div>
  );
}
