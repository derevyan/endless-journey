import type { ReactNode } from "react";

import { EventTypes, type EventTypeValue } from "@journey/schemas";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  Bot,
  Clock,
  Edit,
  GitPullRequest,
  LogIn,
  LogOut,
  MessageCircle,
  MousePointer,
  Plus,
  Star,
  Tag,
  TagIcon,
  Trash,
  User,
  Variable,
} from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { Badge, type BadgeProps } from "./badge";

type EventType = EventTypeValue;

interface EventTypeBadgeProps {
  type: EventType;
  size?: BadgeProps["size"];
  showIcon?: boolean;
  className?: string;
}

interface TypeConfig {
  label: string;
  icon: ReactNode;
  variant: BadgeProps["variant"];
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
  [EventTypes.USER_MESSAGE]: {
    label: "Message",
    icon: <User className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.USER_CLICK]: {
    label: "Click",
    icon: <MousePointer className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.ENGINE_MESSAGE]: {
    label: "Bot Message",
    icon: <Bot className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.ENGINE_TRANSITION]: {
    label: "Transition",
    icon: <ArrowRight className="h-3 w-3" />,
    variant: "success",
  },
  [EventTypes.TIMER_EXPIRED]: {
    label: "Timeout",
    icon: <Clock className="h-3 w-3" />,
    variant: "warning",
  },
  [EventTypes.ENGINE_ERROR]: {
    label: "Error",
    icon: <AlertCircle className="h-3 w-3" />,
    variant: "error",
  },
  [EventTypes.SESSION_TAGS]: {
    label: "Tags",
    icon: <Tag className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.SESSION_VARIABLES]: {
    label: "Variables",
    icon: <Variable className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.JOURNEY_TELEPORT]: {
    label: "Teleport",
    icon: <LogOut className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.MINDSTATE_UPDATED]: {
    label: "Mindstate",
    icon: <Bot className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.JOURNEY_CRM]: {
    label: "CRM",
    icon: <GitPullRequest className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.CRM_STAGE_CHANGED]: {
    label: "CRM Stage",
    icon: <GitPullRequest className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.CRM_STAGE_CREATED]: {
    label: "Stage Created",
    icon: <Plus className="h-3 w-3" />,
    variant: "success",
  },
  [EventTypes.CRM_STAGE_UPDATED]: {
    label: "Stage Updated",
    icon: <Edit className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.CRM_STAGE_DELETED]: {
    label: "Stage Deleted",
    icon: <Trash className="h-3 w-3" />,
    variant: "error",
  },
  [EventTypes.CRM_STAGES_REORDERED]: {
    label: "Stages Reordered",
    icon: <ArrowUpDown className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.CRM_PIPELINE_ENTERED]: {
    label: "CRM Enter",
    icon: <LogIn className="h-3 w-3" />,
    variant: "success",
  },
  [EventTypes.CRM_PIPELINE_EXITED]: {
    label: "CRM Exit",
    icon: <LogOut className="h-3 w-3" />,
    variant: "warning",
  },
  [EventTypes.CRM_PIPELINE_CREATED]: {
    label: "Pipeline Created",
    icon: <Plus className="h-3 w-3" />,
    variant: "success",
  },
  [EventTypes.CRM_PIPELINE_UPDATED]: {
    label: "Pipeline Updated",
    icon: <Edit className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.CRM_PIPELINE_DELETED]: {
    label: "Pipeline Deleted",
    icon: <Trash className="h-3 w-3" />,
    variant: "error",
  },
  [EventTypes.CRM_PIPELINE_DEFAULT_SET]: {
    label: "Default Set",
    icon: <Star className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.CRM_FIELD_UPDATED]: {
    label: "Field Updated",
    icon: <Edit className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.CRM_MESSAGE_SENT]: {
    label: "Message Sent",
    icon: <MessageCircle className="h-3 w-3" />,
    variant: "info",
  },
  [EventTypes.TAG_ADDED]: {
    label: "Tag Added",
    icon: <Tag className="h-3 w-3" />,
    variant: "success",
  },
  [EventTypes.TAG_REMOVED]: {
    label: "Tag Removed",
    icon: <TagIcon className="h-3 w-3" />,
    variant: "warning",
  },
};

const fallbackConfig = TYPE_CONFIG[EventTypes.ENGINE_MESSAGE];

export function EventTypeBadge({ type, size = "default", showIcon = true, className }: EventTypeBadgeProps) {
  const config = TYPE_CONFIG[type] ?? fallbackConfig;

  return (
    <Badge variant={config.variant} size={size} className={cn("gap-1", className)}>
      {showIcon && config.icon}
      {config.label}
    </Badge>
  );
}
