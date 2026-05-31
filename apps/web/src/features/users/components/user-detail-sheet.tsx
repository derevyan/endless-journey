/**
 * User Detail Sheet
 *
 * Sheet panel for viewing user details and performing actions.
 * Matches the CRM client-detail-sheet design.
 */

import { Activity, Boxes, Tag, Trash2, UserRoundSearch } from "lucide-react";

import { MindstatePanel } from "@/features/mindstate";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/shared/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { TagBadge } from "@/shared/components/ui/badges";
import type { TelegramUser } from "@/shared/lib/api";
import { formatRelativeTime } from "@/shared/lib/utils/date-utils";

import { UserProfileHeader } from "./user-profile-header";
import { UserActivityTimeline } from "./user-activity-timeline";

interface UserDetailSheetProps {
  user: TelegramUser | null;
  onClose: () => void;
  onDelete: () => void;
  onImpersonate: () => void;
  tagDefinitions?: Map<string, { color?: string | null; description?: string | null }>;
  isDeleting?: boolean;
}

export function UserDetailSheet({ user, onClose, onDelete, onImpersonate, tagDefinitions, isDeleting }: UserDetailSheetProps) {
  const displayName = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unknown User" : "";

  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[95vw] sm:w-[420px] sm:max-w-md flex flex-col p-0 gap-0">
        {/* Accessibility */}
        <SheetTitle className="sr-only">{displayName ? `User Profile: ${displayName}` : "User Profile"}</SheetTitle>
        <SheetDescription className="sr-only">View user details, sessions, and perform actions</SheetDescription>

        {user && (
          <div className="flex flex-col h-full overflow-hidden border-l bg-background/50">
            {/* Upper content - takes natural height */}
            <div className="flex-shrink-0">
              {/* Profile Header */}
              <UserProfileHeader user={user} className="px-5 py-4 pr-14" />

              {/* Impersonate Button - moved to top after nickname and channel */}
              <div className="px-5 pb-4">
                <Button
                  onClick={onImpersonate}
                  variant="outline"
                  className="w-full gap-1.5"
                  size="sm"
                  title="Impersonate this user"
                >
                  <UserRoundSearch className="size-4" />
                  Impersonate
                </Button>
              </div>

              <div className="px-5 py-4 space-y-5">
                {/* Stats - CRM style 4-column grid */}
                <ProfileStats platform={user.platform} totalSessions={user.sessionCount} lastActiveAt={user.lastActiveAt} createdAt={user.createdAt} />

                <Separator className="opacity-50" />

                {/* Tags Section */}
                <section className="space-y-2.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
                    <Tag className="size-4 text-muted-foreground" />
                    <h3>Tags</h3>
                  </div>
                  {user.tags.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No tags assigned</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {user.tags.map((tag) => {
                        const tagDef = tagDefinitions?.get(tag);
                        return <TagBadge key={tag} tag={tag} color={tagDef?.color} />;
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* Activity & Mindstate Tabs - fills remaining space */}
            <div className="flex-1 min-h-0 flex flex-col px-5">
              <Tabs defaultValue="activity" className="flex min-h-0 flex-1 flex-col">
                <TabsList className="w-full h-9 mb-3 shrink-0">
                  <TabsTrigger value="activity" className="flex-1 gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    Activity
                  </TabsTrigger>
                  <TabsTrigger value="mindstate" className="flex-1 gap-1.5">
                    <Boxes className="h-3.5 w-3.5" />
                    Mindstate
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="flex-1 min-h-0 m-0 overflow-hidden">
                  <UserActivityTimeline userId={user.id} className="h-full" />
                </TabsContent>

                <TabsContent value="mindstate" className="flex-1 min-h-0 m-0 overflow-hidden">
                  <MindstatePanel clientId={user.id} />
                </TabsContent>
              </Tabs>
            </div>

            {/* Footer with Delete Button */}
            <div className="border-t px-5 py-3 flex-shrink-0">
              <Button
                onClick={onDelete}
                disabled={isDeleting}
                variant="outline"
                className="w-full gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                size="sm"
              >
                <Trash2 className="size-4" />
                {isDeleting ? "Deleting..." : "Delete User"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Stats component matching CRM's ProfileStats design
interface ProfileStatsProps {
  platform: string;
  totalSessions: number;
  lastActiveAt: string | null;
  createdAt: string | null;
}

function ProfileStats({ platform, totalSessions, lastActiveAt, createdAt }: ProfileStatsProps) {
  const stats = [
    {
      label: "Platform",
      value: platform.charAt(0).toUpperCase() + platform.slice(1),
    },
    {
      label: "Sessions",
      value: totalSessions.toString(),
    },
    {
      label: "Last active",
      value: lastActiveAt ? formatRelativeTime(lastActiveAt) : "Never",
    },
    {
      label: "First seen",
      value: createdAt ? formatRelativeTime(createdAt) : "Unknown",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 flex flex-col">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium truncate mb-0.5 opacity-80">{stat.label}</p>
          <p className="text-xs font-semibold truncate text-foreground/90 leading-tight" title={stat.value}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
