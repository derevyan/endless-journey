import { X } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/shared/components/ui/sheet";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useChannels } from "@/hooks/queries/use-channels";
import { useCrmClient, useCrmClientMessages, useCrmClientTimeline } from "@/features/crm/hooks/queries";
import { getDisplayName } from "@/shared/lib/utils/user-utils";

import { ConversationPanel } from "./conversation-panel";
import { ProfilePanel } from "./profile-panel";

interface ClientDetailSheetProps {
  clientId: string | null;
  onClose: () => void;
  tagColorMap?: Record<string, string>;
}

export function ClientDetailSheet({
  clientId,
  onClose,
  tagColorMap = {},
}: ClientDetailSheetProps) {
  const { data: client, isLoading: clientLoading } = useCrmClient(clientId ?? undefined);
  const { data: timeline = [], isLoading: timelineLoading } = useCrmClientTimeline(clientId ?? undefined);
  const { refetch: refetchMessages } = useCrmClientMessages(clientId ?? undefined);
  const { data: channels = [] } = useChannels();

  const displayName = client ? getDisplayName(client) : "";

  return (
    <Sheet open={!!clientId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-[95vw] sm:w-[50vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl flex flex-col p-0 gap-0"
        hideClose
        aria-describedby={undefined}
      >
        {/* Accessibility: Hidden title and description for screen readers */}
        <SheetTitle className="sr-only">
          {displayName ? `Client Profile: ${displayName}` : "Client Profile"}
        </SheetTitle>
        <SheetDescription className="sr-only">
          View client details, send messages, and manage tags
        </SheetDescription>

        {/* Close Button */}
        {/* <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 z-50 size-8"
          onClick={onClose}
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Button> */}

        {clientLoading ? (
          <SheetDetailSkeleton />
        ) : !client ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="size-16 rounded-full bg-muted/30 flex items-center justify-center">
              <X className="size-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground">Client not found</p>
          </div>
        ) : (
          /* Split Layout Container */
          <div className="flex w-full h-full overflow-hidden bg-background">
            {/* Left: Conversation Panel (Flexible width) */}
            <div className="flex-1 min-w-0 flex flex-col border-r">
               <ConversationPanel
                clientId={client.id}
                clientName={displayName}
                channels={channels.map((c) => ({
                  id: c.id,
                  name: c.botName || c.botUsername || "Unknown",
                  platform: c.platform,
                }))}
                onMessageSent={() => refetchMessages()}
                className="h-full"
              />
            </div>

            {/* Right: Profile Panel (Fixed width) */}
            <div className="w-[35%] min-w-[320px] max-w-[400px] shrink-0 flex flex-col bg-muted/10">
              <ProfilePanel
                client={client}
                tagColorMap={tagColorMap}
                timeline={timeline}
                isTimelineLoading={timelineLoading}
              />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SheetDetailSkeleton() {
  return (
    <div className="flex h-full w-full">
      {/* Left Panel Skeleton */}
      <div className="flex-1 flex flex-col border-r">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
            <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
            </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-6 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
              <Skeleton className={`h-16 w-1/2 rounded-2xl ${i % 2 === 0 ? 'rounded-br-sm' : 'rounded-bl-sm'}`} />
            </div>
          ))}
        </div>

        {/* Composer */}
        <div className="p-4 border-t space-y-3 bg-muted/5">
          <Skeleton className="h-20 w-full rounded-md" />
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>

      {/* Right Panel Skeleton */}
      <div className="w-[35%] min-w-[320px] max-w-[400px] shrink-0 bg-muted/10">
        {/* Header */}
        <div className="p-6 flex flex-col items-center text-center space-y-4 border-b">
          <Skeleton className="size-20 rounded-full" />
          <div className="space-y-2 w-full flex flex-col items-center">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>

        {/* Stats */}
        <div className="p-4 grid grid-cols-2 gap-4">
           {[1, 2, 3, 4].map((i) => (
             <Skeleton key={i} className="h-16 w-full rounded-lg" />
           ))}
        </div>

        {/* Sections */}
        <div className="px-4 py-2 space-y-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
