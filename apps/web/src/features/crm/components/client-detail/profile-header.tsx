
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badges";
import { cn } from "@/shared/lib/utils";

interface ProfileHeaderProps {
  displayName: string;
  username: string | null;
  platform: string;
  stageName: string;
  stageColor: string;
  avatarUrl?: string;
  className?: string;
}

/**
 * Get initials from a display name
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileHeader({
  displayName,
  username,
  stageName,
  stageColor,
  avatarUrl,
  className,
}: ProfileHeaderProps) {
  return (
    <div className={cn("px-5 py-4 flex items-center gap-4 pr-14", className)}>
      {/* Avatar */}
      <Avatar className="size-16 ring-2 ring-border/50 shadow-sm bg-muted/50">
        <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />
        <AvatarFallback
          className="text-lg font-bold"
          style={{ backgroundColor: stageColor, color: "#fff" }}
        >
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <h2 className="font-bold text-lg leading-tight truncate">{displayName}</h2>
        
        <div className="flex items-center gap-2">
            {username && (
            <p className="text-sm text-muted-foreground truncate font-medium">@{username}</p>
            )}
            <Badge
                variant="outline"
                className="shrink-0 rounded-full px-1.5 py-0 text-[10px] h-4 font-medium border"
                style={{
                    backgroundColor: `${stageColor}10`,
                    color: stageColor,
                    borderColor: `${stageColor}30`,
                }}
            >
                {stageName}
            </Badge>
        </div>
      </div>
    </div>
  );
}
