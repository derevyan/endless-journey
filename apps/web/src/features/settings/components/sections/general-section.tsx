/**
 * General Settings Section
 *
 * General application settings including journeys overview.
 *
 * @module components/settings/sections/general-section
 */

import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Link2, Loader2, Workflow } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { notify } from "@/shared/lib/ui/notify";

import { DeactivationDialog } from "@/features/journey/builder/components/deactivation-dialog";
import { useActiveSessionsCount } from "@/hooks/queries/use-active-sessions-count";
import { useChannels } from "@/hooks/queries/use-channels";
import { useJourneyListManifest } from "@/hooks/queries";
import { Badge, EntityStatusBadge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Switch } from "@/shared/components/ui/switch";
import { journeysApi } from "@/shared/lib/api/journeys";
import { journeyKeys } from "@/shared/lib/query-keys";
import type { DeactivationMode } from "@journey/schemas";

interface ChannelConnection {
  count: number;
  botNames: string[];
}

function JourneyItem({
  id,
  name,
  description,
  status,
  connection,
}: {
  id: string;
  name: string;
  description: string;
  status: "active" | "draft";
  connection?: ChannelConnection;
}) {
  const switchId = useId();
  const queryClient = useQueryClient();
  const [showDeactivationDialog, setShowDeactivationDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch session count when deactivation dialog is shown
  const { data: activeSessionCount = 0, isLoading: isLoadingCount } = useActiveSessionsCount(id, showDeactivationDialog && status === "active");

  const isActive = status === "active";

  const handleToggleStatus = async (checked: boolean) => {
    if (!checked && status === "active") {
      // Deactivating - show dialog
      setShowDeactivationDialog(true);
    } else if (checked && status === "draft") {
      // Activating directly
      setIsUpdating(true);
      try {
        await journeysApi.updateJourney(id, { status: "active" });
        queryClient.invalidateQueries({ queryKey: journeyKeys.list() });
        // Success toast handled by SSE event
      } catch {
        notify.error("Failed to activate journey");
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleDeactivationConfirm = async (mode: DeactivationMode) => {
    setIsUpdating(true);
    try {
      await journeysApi.updateJourney(id, { status: "draft", deactivationMode: mode });
      queryClient.invalidateQueries({ queryKey: journeyKeys.list() });
      // Success toast handled by SSE event
    } catch {
      notify.error("Failed to deactivate journey");
    } finally {
      setIsUpdating(false);
      setShowDeactivationDialog(false);
    }
  };

  return (
    <>
      <div className="flex flex-col rounded-md border bg-card/50 min-h-[100px]">
        {/* Header: Title + Switch */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60">
          <span className="truncate font-bold text-md leading-tight">{name}</span>
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          ) : (
            <Switch
              id={switchId}
              checked={isActive}
              onCheckedChange={handleToggleStatus}
              disabled={isUpdating}
              aria-describedby={`${switchId}-description`}
              className="shrink-0 h-4 w-6 [&_span]:size-3 data-[state=checked]:[&_span]:translate-x-2 data-[state=checked]:[&_span]:rtl:-translate-x-2"
            />
          )}
        </div>

        {/* Content: Description + Footer */}
        <div className="flex flex-1 flex-col px-3 py-2 gap-1.5 justify-between">
          <p className="text-xs text-muted-foreground line-clamp-2 opacity-80 leading-snug" id={`${switchId}-description`}>
            {description}
          </p>
          <div className="flex items-center justify-between gap-2 mt-auto">
            {connection && connection.count > 0 ? (
              <Badge variant="outline" className="text-xs gap-1 shrink-0">
                <Link2 className="h-3 w-3 text-emerald-400 animate-pulse" />
                {connection.count === 1 ? connection.botNames[0] || "1 bot" : `${connection.count} bots`}
              </Badge>
            ) : (
              <span />
            )}
            <EntityStatusBadge status={status} size="sm" className="px-0" hideTextOnMobile entityType="journey" />
          </div>
        </div>
      </div>

      <DeactivationDialog
        open={showDeactivationDialog}
        onOpenChange={setShowDeactivationDialog}
        onConfirm={handleDeactivationConfirm}
        activeSessionCount={activeSessionCount}
        isLoading={isLoadingCount || isUpdating}
        targetStatus="draft"
      />
    </>
  );
}

export function GeneralSettingsForm() {
  const { data: journeys, isLoading: journeysLoading } = useJourneyListManifest();
  const { data: channels = [] } = useChannels();

  // Build map of journeyId -> channel connection info
  const connectionMap = useMemo(() => {
    const map: Record<string, ChannelConnection> = {};
    channels.forEach((channel) => {
      if (channel.defaultJourneyId) {
        if (!map[channel.defaultJourneyId]) {
          map[channel.defaultJourneyId] = { count: 0, botNames: [] };
        }
        map[channel.defaultJourneyId].count++;
        const botName = channel.botName || channel.botUsername;
        if (botName) {
          map[channel.defaultJourneyId].botNames.push(botName);
        }
      }
    });
    return map;
  }, [channels]);

  // Sort journeys: active+connected first, then active, then connected, then draft
  const sortedJourneys = useMemo(() => {
    if (!journeys) return [];
    return [...journeys].sort((a, b) => {
      const aActive = a.status === "active" ? 1 : 0;
      const bActive = b.status === "active" ? 1 : 0;
      const aConnected = connectionMap[a.id]?.count > 0 ? 1 : 0;
      const bConnected = connectionMap[b.id]?.count > 0 ? 1 : 0;
      // Primary: active status, Secondary: has connection
      const aScore = aActive * 2 + aConnected;
      const bScore = bActive * 2 + bConnected;
      return bScore - aScore;
    });
  }, [journeys, connectionMap]);

  return (
    <div className="space-y-6">
      {/* Journeys Overview */}
      <Card className="bg-transparent shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Your Journeys</CardTitle>
            </div>
          </div>
          <CardDescription>Manage the status of your journeys and their channel connections</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {journeysLoading ? (
            <p className="text-sm text-muted-foreground">Loading journeys...</p>
          ) : sortedJourneys.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {sortedJourneys.map((journey) => (
                <JourneyItem
                  key={journey.id}
                  id={journey.id}
                  name={journey.name}
                  description={journey.description || "No description"}
                  status={journey.status === "active" ? "active" : "draft"}
                  connection={connectionMap[journey.id]}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Workflow className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No journeys yet</p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link to="/journeys">Create your first journey</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Section */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            More general settings will be available in future updates. Use the sidebar to navigate to specific settings sections.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
