/**
 * CRM Activity Detail Sheet
 *
 * Side panel showing full CRM activity details and metadata.
 *
 * @module components/developers/events/crm-activity-detail-sheet
 */

import { format } from "date-fns";
import { Copy, ExternalLink, X } from "lucide-react";

import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { JsonHighlight } from "@/shared/components/ui/json-highlight";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Separator } from "@/shared/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/shared/components/ui/sheet";
import { notify } from "@/shared/lib/ui/notify";

import type { CrmActivity } from "@/hooks/queries/use-events";

import { getCrmActivityLabel, getCrmActivityVariant } from "@journey/schemas";

import { getClientName } from "./crm-activity-helpers";
import { InfoRow, Section } from "./detail-sheet-helpers";

// =============================================================================
// PROPS
// =============================================================================

interface CrmActivityDetailSheetProps {
  activity: CrmActivity | null;
  open: boolean;
  onClose: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CrmActivityDetailSheet({ activity, open, onClose }: CrmActivityDetailSheetProps) {
  if (!activity) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(activity.id);
    notify.success("Activity ID copied");
  };

  const handleCopyMetadata = () => {
    navigator.clipboard.writeText(JSON.stringify(activity.metadata, null, 2));
    notify.success("Metadata copied");
  };

  const hasMetadata = !!(activity.metadata && typeof activity.metadata === "object" && Object.keys(activity.metadata).length > 0);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[500px] max-w-[95vw] p-0 gap-0" hideClose>
        <SheetTitle className="sr-only">Activity Details: {getCrmActivityLabel(activity.activityType)}</SheetTitle>
        <SheetDescription className="sr-only">View full CRM activity details including metadata</SheetDescription>

        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{getCrmActivityLabel(activity.activityType)}</h2>
              <Badge variant={getCrmActivityVariant(activity.activityType)} className="text-xs">
                {activity.activityType}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{activity.description}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <ScrollArea className="flex-1 h-[calc(100vh-80px)]">
          <div className="p-4 space-y-6">
            {/* Activity Info */}
            <Section title="Activity Info">
              <InfoRow label="Activity ID">
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[200px]">{activity.id}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyId}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </InfoRow>
              <InfoRow label="Timestamp">{format(new Date(activity.createdAt), "yyyy-MM-dd HH:mm:ss.SSS")}</InfoRow>
              <InfoRow label="Type">
                <Badge variant={getCrmActivityVariant(activity.activityType)} className="text-xs">
                  {(activity.activityType)}
                </Badge>
              </InfoRow>
              {activity.performedBy && <InfoRow label="Performed By">{activity.performedBy}</InfoRow>}
            </Section>

            <Separator />

            {/* Client Info */}
            <Section title="Client">
              <InfoRow label="Client ID">
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[180px]">{activity.clientId}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <a href={`/crm/clients/${activity.clientId}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </InfoRow>
              <InfoRow label="Name">{getClientName(activity)}</InfoRow>
              {activity.clientUsername && <InfoRow label="Username">@{activity.clientUsername}</InfoRow>}
            </Section>

            <Separator />

            {/* Description */}
            <Section title="Description">
              <p className="text-sm text-muted-foreground">{activity.description || "No description available"}</p>
            </Section>

            {/* Metadata (if present) */}
            {hasMetadata && (
              <>
                <Separator />
                <Section
                  title="Metadata"
                  action={
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleCopyMetadata}>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  }
                >
                  <div className="bg-muted/10 rounded-md border border-border/50 overflow-hidden">
                    <pre className="text-[11px] p-3 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                      <JsonHighlight value={activity.metadata} />
                    </pre>
                  </div>
                </Section>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

