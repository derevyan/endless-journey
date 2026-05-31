/**
 * Session Selection Dialog
 *
 * Dialog for selecting which session to impersonate when a user has multiple sessions.
 * Only shown when user has more than one session.
 *
 * Includes download button for each session to export as JSON.
 *
 * @module components/users/session-selection-dialog
 */

import { formatDistanceToNow } from "date-fns";
import { Clock, Download, Play, Route, User } from "lucide-react";

import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import type { TelegramUserSession } from "@/shared/lib/api";

interface SessionSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: TelegramUserSession[];
  onSelectSession: (sessionId: string) => void;
  onDownloadSession: (sessionId: string) => void;
  isLoading?: boolean;
  userName?: string;
}

function getStatusColor(status: string | null): string {
  switch (status) {
    case "active":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "completed":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "dropped":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "paused":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Unknown";
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

export function SessionSelectionDialog({
  open,
  onOpenChange,
  sessions,
  onSelectSession,
  onDownloadSession,
  isLoading = false,
  userName = "Unknown User",
}: SessionSelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Select Session to Replay
          </DialogTitle>
          <DialogDescription>
            {userName} has {sessions.length} sessions. Select which one to replay.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading sessions...</div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">No sessions found</div>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2 pr-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="w-full rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-start gap-4">
                    {/* Session Info */}
                    <div className="flex-1 space-y-2 min-w-0">
                      {/* Journey name */}
                      <div className="flex items-center gap-2 min-w-0">
                        <Route className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold truncate">{session.journeyName}</span>
                      </div>

                      {/* Status badge and timestamp */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge
                          variant="outline"
                          className={getStatusColor(session.status)}
                        >
                          {session.status || "unknown"}
                        </Badge>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(session.updatedAt)}
                        </span>
                      </div>

                      {/* Current node */}
                      <div className="text-xs text-muted-foreground">
                        Node: <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">{session.currentNodeId}</code>
                      </div>
                    </div>

                    {/* Action buttons - Vertical stack on right */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {/* Play button - Top */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onSelectSession(session.id)}
                        disabled={isLoading}
                        title="Play this session"
                        className="h-9 w-9"
                      >
                        <Play className="h-5 w-5" />
                      </Button>

                      {/* Download button - Bottom */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDownloadSession(session.id)}
                        disabled={isLoading}
                        title="Download session as JSON"
                        className="h-9 w-9"
                      >
                        <Download className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
