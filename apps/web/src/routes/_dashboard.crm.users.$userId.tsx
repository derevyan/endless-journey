/**
 * CRM User Detail Route
 *
 * Detailed view of a single client profile.
 *
 * @module routes/_dashboard.crm.users.$userId
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Tag, Clock, User, Hash, Send } from "lucide-react";

import { MessageComposer, MessageHistory } from "@/features/crm/components/messaging";
import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useCrmClient, useCrmClientTimeline, useCrmClientMessages } from "@/features/crm/hooks/queries";
import { useChannels } from "@/hooks/queries/use-channels";
import { getDisplayName } from "@/shared/lib/utils/user-utils";

export const Route = createFileRoute("/_dashboard/crm/users/$userId")({
  component: CrmUserDetail,
});

function CrmUserDetail() {
  const { userId } = Route.useParams();

  const { data: client, isLoading: clientLoading } = useCrmClient(userId);
  const { data: timeline = [], isLoading: timelineLoading } = useCrmClientTimeline(userId);
  const { refetch: refetchMessages } = useCrmClientMessages(userId);
  const { data: channels = [] } = useChannels();

  if (clientLoading) {
    return <UserDetailSkeleton />;
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">Client not found</p>
        <Button asChild variant="link">
          <Link to="/crm">Back to Pipeline</Link>
        </Button>
      </div>
    );
  }

  const displayName = getDisplayName(client);

  const stageName = client.stage?.stageName || "Unassigned";
  const stageColor = client.stage?.stageColor || "#6b7280";

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to="/crm">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <p className="text-muted-foreground">
            @{client.username || client.platformUserId}
          </p>
        </div>
        <Badge
          style={{ backgroundColor: stageColor, color: "#fff" }}
          className="text-sm"
        >
          {stageName}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <User className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Platform</p>
                  <p className="font-medium">{client.platform}</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">First Name</span>
                  <span>{client.firstName || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Name</span>
                  <span>{client.lastName || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username</span>
                  <span>@{client.username || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform User ID</span>
                  <span className="font-mono text-xs">{client.platformUserId}</span>
                </div>
              </div>

              <Separator />

              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Sessions</span>
                  <span>{client.totalSessions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Active</span>
                  <span>
                    {client.lastActiveAt
                      ? new Date(client.lastActiveAt).toLocaleString()
                      : "Never"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>
                    {client.createdAt
                      ? new Date(client.createdAt).toLocaleDateString()
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tags Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="size-5" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {client.tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags assigned</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {client.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom Fields Card */}
        {client.customFields.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="size-5" />
                Custom Fields
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                {client.customFields.map((field) => (
                  <div key={field.fieldId} className="flex justify-between">
                    <span className="text-muted-foreground">{field.fieldName}</span>
                    <span>{String(field.value) || "-"}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Messaging Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="size-5" />
              Direct Messaging
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="compose" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="compose">Compose</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="compose">
                <MessageComposer
                  clientId={userId}
                  clientName={displayName}
                  channels={channels.map((c) => ({
                    id: c.id,
                    name: c.botName || c.botUsername || "Unknown",
                    platform: c.platform,
                  }))}
                  onMessageSent={() => refetchMessages()}
                />
              </TabsContent>
              <TabsContent value="history">
                <MessageHistory clientId={userId} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Activity Timeline Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5" />
              Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timelineLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded</p>
            ) : (
              <div className="space-y-4">
                {timeline.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      {activity.source === "message" ? (
                        <MessageCircle className="size-4" />
                      ) : activity.source === "journey" ? (
                        <Clock className="size-4" />
                      ) : (
                        <Tag className="size-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{activity.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {activity.createdAt
                            ? new Date(activity.createdAt).toLocaleString()
                            : "Unknown"}
                        </span>
                        {activity.performedByName && (
                          <span className="text-xs text-muted-foreground">
                            by {activity.performedByName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UserDetailSkeleton() {
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="col-span-2 h-60 rounded-lg" />
      </div>
    </div>
  );
}
