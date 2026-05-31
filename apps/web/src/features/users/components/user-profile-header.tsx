/**
 * User Profile Header
 *
 * Displays user avatar, name, username, and platform badge.
 */

import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badges";
import { cn } from "@/shared/lib/utils";
import type { TelegramUser } from "@/shared/lib/api";

interface UserProfileHeaderProps {
  user: TelegramUser;
  className?: string;
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.trim() || "";
  const last = lastName?.trim() || "";

  if (first && last) {
    return (first[0] + last[0]).toUpperCase();
  }
  if (first) {
    return first.slice(0, 2).toUpperCase();
  }
  return "U";
}

function getDisplayName(user: TelegramUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unknown User";
}

export function UserProfileHeader({ user, className }: UserProfileHeaderProps) {
  const displayName = getDisplayName(user);
  const initials = getInitials(user.firstName, user.lastName);

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <Avatar className="size-16 ring-2 ring-border/50 shadow-sm bg-muted/50">
        <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-1">
        <h2 className="font-bold text-lg leading-tight truncate">{displayName}</h2>

        <div className="flex items-center gap-2">
          {user.username && (
            <p className="text-sm text-muted-foreground truncate font-medium">
              @{user.username}
            </p>
          )}
          <Badge variant="outline" className="shrink-0 capitalize">
            {user.platform}
          </Badge>
        </div>
      </div>
    </div>
  );
}
