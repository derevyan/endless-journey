import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  Braces,
  Brain,
  Globe,
  Hand,
  LogIn,
  LogOut,
  MessageCircle,
  MousePointerClick,
  Route,
  Shield,
  Shuffle,
  Sparkles,
  Tag,
  Timer,
} from "lucide-react";

import { useUserActivity } from "@/hooks/queries";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { UserActivityEventType } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";

interface UserActivityTimelineProps {
  userId: string;
  className?: string;
}

interface TypeVisual {
  label: string;
  icon: React.ReactNode;
  color: string;
}

// Simplified color scheme - just icon colors
const TYPE_CONFIG: Record<UserActivityEventType, TypeVisual> = {
  session_started: {
    label: "Started",
    icon: <LogIn className="size-3.5" />,
    color: "text-emerald-600",
  },
  session_completed: {
    label: "Ended",
    icon: <LogOut className="size-3.5" />,
    color: "text-emerald-600",
  },
  user_message: {
    label: "Message",
    icon: <MessageCircle className="size-3.5" />,
    color: "text-sky-600",
  },
  user_click: {
    label: "Click",
    icon: <MousePointerClick className="size-3.5" />,
    color: "text-sky-600",
  },
  bot_message: {
    label: "Bot",
    icon: <Bot className="size-3.5" />,
    color: "text-indigo-600",
  },
  node_transition: {
    label: "Transition",
    icon: <Route className="size-3.5" />,
    color: "text-purple-600",
  },
  timeout: {
    label: "Timeout",
    icon: <Timer className="size-3.5" />,
    color: "text-amber-600",
  },
  error: {
    label: "Error",
    icon: <AlertTriangle className="size-3.5" />,
    color: "text-rose-600",
  },
  tags: {
    label: "Tags",
    icon: <Tag className="size-3.5" />,
    color: "text-teal-600",
  },
  variables: {
    label: "Variables",
    icon: <Braces className="size-3.5" />,
    color: "text-slate-600",
  },
  teleport: {
    label: "Teleport",
    icon: <Shuffle className="size-3.5" />,
    color: "text-fuchsia-600",
  },
  mindstate: {
    label: "Mindstate",
    icon: <Brain className="size-3.5" />,
    color: "text-cyan-600",
  },
  crm: {
    label: "CRM",
    icon: <Sparkles className="size-3.5" />,
    color: "text-green-600",
  },
  webhook: {
    label: "Webhook",
    icon: <Globe className="size-3.5" />,
    color: "text-violet-600",
  },
  system: {
    label: "System",
    icon: <Activity className="size-3.5" />,
    color: "text-muted-foreground",
  },
  followup: {
    label: "Follow-up",
    icon: <Bell className="size-3.5" />,
    color: "text-amber-600",
  },
  hitl: {
    label: "HITL",
    icon: <Hand className="size-3.5" />,
    color: "text-orange-600",
  },
  guard_blocked: {
    label: "Blocked",
    icon: <Shield className="size-3.5" />,
    color: "text-rose-600",
  },
  guard_fallback: {
    label: "Fallback",
    icon: <Shield className="size-3.5" />,
    color: "text-amber-600",
  },
};

const FALLBACK_TYPE: TypeVisual = {
  label: "Event",
  icon: <Activity className="size-3.5" />,
  color: "text-muted-foreground",
};

export function UserActivityTimeline({ userId, className }: UserActivityTimelineProps) {
  const activityQuery = useUserActivity(userId, 200);
  // Reverse to show most recent activity first (user sees latest interactions at top)
  const activities = [...(activityQuery.data ?? [])].reverse();

  if (activityQuery.isLoading) {
    return (
      <div className={cn("space-y-1", className)}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    );
  }

  if (activityQuery.isError) {
    return (
      <div className={cn("flex items-center justify-between rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground", className)}>
        <span>Failed to load activity</span>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => activityQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/20 px-4 py-4 text-center text-xs text-muted-foreground", className)}>
        <p>No activity yet</p>
      </div>
    );
  }

  // Fill available space with scroll
  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="space-y-0.5 pr-2">
        {activities.map((activity) => {
          const visuals = TYPE_CONFIG[activity.eventType] || FALLBACK_TYPE;

          return (
            <div key={activity.id} className="rounded px-2 py-1.5">
              {/* Main row: icon + type + title + time */}
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn("shrink-0", visuals.color)}>{visuals.icon}</span>
                <span className="text-[11px] font-medium text-muted-foreground shrink-0">{visuals.label}</span>
                <span className="text-[11px] text-muted-foreground/50">·</span>
                <span className="text-[11px] font-medium text-foreground/90 truncate flex-1">{activity.title}</span>
                {activity.timeSincePrevMs !== null && (
                  <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">+{formatDuration(activity.timeSincePrevMs)}</span>
                )}
              </div>

              {/* Description row (if exists) */}
              {activity.description && <p className="text-[10px] text-muted-foreground/70 truncate pl-6 mt-0.5">{activity.description}</p>}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    const mins = minutes % 60;
    return `${hours}h${mins > 0 ? ` ${mins}m` : ""}`;
  }
  if (minutes > 0) {
    return `${minutes}m${seconds > 0 ? ` ${seconds}s` : ""}`;
  }
  return `${seconds}s`;
}
