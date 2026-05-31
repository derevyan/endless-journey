/**
 * CRM Client Card
 *
 * Card content for a client in the pipeline kanban view.
 * Name and username are clickable to open client detail sheet.
 * Entire card is draggable via asHandle on parent Kanban.Item.
 *
 * @module components/crm/pipeline/client-card
 */

import { MessageCircle } from "lucide-react";

import { Badge } from "@/shared/components/ui/badges";
import { TagBadge } from "@/shared/components/ui/badges";
import type { CrmClient } from "@/shared/lib/api";
import { getDisplayName } from "@/shared/lib/utils/user-utils";

interface ClientCardProps {
  client: CrmClient;
  tagColorMap?: Record<string, string>;
  onClientClick?: (clientId: string) => void;
}

export function ClientCard({ client, tagColorMap = {}, onClientClick }: ClientCardProps) {
  const displayName = getDisplayName(client);

  const formattedLastActive = client.lastActiveAt ? new Date(client.lastActiveAt).toLocaleDateString() : "Never";

  // Shared click handler props to prevent drag while allowing clicks
  const clickableProps = {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      onClientClick?.(client.id);
    },
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
  };

  return (
    <div className="group relative rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-1.5">
        {/* Name and Date Row */}
        <div className="flex items-start justify-between gap-2">
          <button type="button" className="cursor-pointer line-clamp-1 font-semibold text-sm leading-tight text-left hover:underline" {...clickableProps}>
            {displayName}
          </button>
          <time className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{formattedLastActive}</time>
        </div>

        {/* Username - also clickable */}
        {client.username && (
          <button type="button" className="cursor-pointer line-clamp-1 text-[11px] text-muted-foreground text-left hover:underline w-fit" {...clickableProps}>
            {client.username}
          </button>
        )}

        {/* Bottom Row - Sessions and Tags */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MessageCircle className="size-3" />
            <span>{client.totalSessions}</span>
          </div>

          {/* Tags - Show first 2, then count */}
          {client.tags.length > 0 && (
            <div className="flex items-center gap-1">
              {client.tags.slice(0, 2).map((tag) => (
                <TagBadge key={tag} tag={tag} color={tagColorMap[tag]} className="pointer-events-none h-5 text-[10px]" />
              ))}
              {client.tags.length > 2 && (
                <Badge variant="secondary" className="pointer-events-none h-4 px-1 text-[10px]">
                  +{client.tags.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
