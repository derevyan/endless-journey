import { Activity, Boxes, Hash, Tag } from "lucide-react";

import { ClientTagsEditor } from "@/features/crm/components/client-tags-editor";
import type { CrmClientProfile } from "@/features/crm/hooks/queries";
import { MindstatePanel } from "@/features/mindstate";
import { CollapsibleSection } from "@/shared/components/ui/collapsible-section";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Separator } from "@/shared/components/ui/separator";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { ActivityEntry } from "@/shared/lib/api/crm";
import { getDisplayName } from "@/shared/lib/utils/user-utils";

import { ProfileHeader } from "./profile-header";
import { ProfileStats } from "./profile-stats";

interface ProfilePanelProps {
  client: CrmClientProfile;
  tagColorMap: Record<string, string>;
  timeline: ActivityEntry[];
  isTimelineLoading: boolean;
}

export function ProfilePanel({ client, tagColorMap, timeline, isTimelineLoading }: ProfilePanelProps) {
  const displayName = getDisplayName(client);

  const stageName = client.stage?.stageName || "Unassigned";
  const stageColor = client.stage?.stageColor || "#6b7280";

  return (
    <div className="w-full h-full flex flex-col overflow-hidden border-l bg-background/50">
      <ScrollArea className="flex-1">
        {/* Profile Header */}
        <ProfileHeader displayName={displayName} username={client.username} platform={client.platform} stageName={stageName} stageColor={stageColor} />

        <div className="px-5 py-4 space-y-5">
          {/* Stats */}
          <ProfileStats platform={client.platform} totalSessions={client.totalSessions} lastActiveAt={client.lastActiveAt} createdAt={client.createdAt} />

          <Separator className="opacity-50" />

          {/* Tags Section */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
              <Tag className="size-4 text-muted-foreground" />
              <h3>Tags</h3>
            </div>
            <ClientTagsEditor clientId={client.id} tags={client.tags} tagColorMap={tagColorMap} />
          </section>

          <Separator className="opacity-50" />

          {/* Mindstate Section - Collapsible */}
          <CollapsibleSection label="Mindstate" icon={Boxes} chevronStyle="right">
            <div className="mt-2">
              <MindstatePanel clientId={client.id} />
            </div>
          </CollapsibleSection>

          <Separator className="opacity-50" />

          {/* Activity Timeline - Collapsible */}
          <CollapsibleSection label="Activity History" icon={Activity} defaultOpen chevronStyle="right">
            <div className="mt-2">
              <ActivityTimeline timeline={timeline} isLoading={isTimelineLoading} />
            </div>
          </CollapsibleSection>

          {/* Custom Fields - Collapsible */}
          {client.customFields.length > 0 && (
            <>
              <Separator className="opacity-50" />
              <CollapsibleSection label="Additional Info" icon={Hash} chevronStyle="right">
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {client.customFields.map((field) => (
                    <div key={field.fieldId} className="flex flex-col p-2.5 rounded-md bg-muted/40 border border-border/20">
                      <span className="text-[10px] font-medium uppercase text-muted-foreground tracking-wider mb-0.5">{field.fieldName}</span>
                      <span className="text-sm font-medium">{String(field.value) || "-"}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface ActivityTimelineProps {
  timeline: ActivityEntry[];
  isLoading: boolean;
}

function ActivityTimeline({ timeline, isLoading }: ActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 pl-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Skeleton className="size-2 rounded-full mt-1.5" />
              <div className="w-px h-full bg-border/40 my-1" />
            </div>
            <div className="flex-1 space-y-1.5 pb-2">
              <Skeleton className="h-4 w-3/4 rounded-sm" />
              <Skeleton className="h-3 w-1/3 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed text-xs">
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <div className="relative pl-1 space-y-0">
      {/* Vertical Line Background */}
      <div className="absolute left-[3.5px] top-2 bottom-2 w-px bg-border/40" />

      {timeline.slice(0, 8).map((activity) => (
        <div key={activity.id} className="relative flex gap-3 pb-4 last:pb-0 items-start group">
          {/* Dot */}
          <div className="relative z-10 mt-1.5 size-2 rounded-full bg-primary/20 ring-4 ring-background group-hover:bg-primary/60 transition-colors" />

          {/* Content */}
          <div className="flex-1 min-w-0 bg-card/50 p-2 rounded-md hover:bg-muted/40 transition-colors -mt-1">
            <p className="text-sm text-foreground/90 leading-snug line-clamp-2 font-medium">{activity.description}</p>
            <span className="text-[11px] text-muted-foreground block mt-1">
              {activity.createdAt
                ? new Date(activity.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Unknown"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
