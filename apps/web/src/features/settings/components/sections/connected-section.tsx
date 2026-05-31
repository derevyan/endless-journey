/**
 * Connected Accounts Section
 *
 * Manage connected messaging platforms (Telegram bots).
 *
 * @module components/settings/sections/connected-section
 */

import { useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Bot as BotIcon, Info, Loader2, MoreVertical, Plus, Power, RefreshCw, Smartphone, Trash2, Workflow, X } from "lucide-react";
import { useState } from "react";

import { notify } from "@/shared/lib/ui/notify";

import { DeactivationDialog } from "@/features/journey/builder/components/deactivation-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useActiveSessionsCount } from "@/hooks/queries/use-active-sessions-count";
import { useChannels, useDeleteChannel, useRefreshChannelWebhook, useUpdateChannel, type Channel } from "@/hooks/queries/use-channels";
import { useJourneyListManifest } from "@/hooks/queries";
import { journeysApi } from "@/shared/lib/api/journeys";
import { journeyKeys } from "@/shared/lib/query-keys";
import type { DeactivationMode } from "@journey/schemas";
import { BotSetupWizard } from "./bot-setup-wizard";

const PLATFORM_INFO: Record<
  string,
  {
    name: string;
    icon: LucideIcon;
    description: string;
  }
> = {
  telegram: {
    name: "Telegram",
    icon: BotIcon,
    description: "Connect Telegram bots to send journey messages",
  },
  whatsapp: {
    name: "WhatsApp",
    icon: Smartphone,
    description: "Connect WhatsApp Business API for messaging (coming soon)",
  },
};

function BotCard({
  bot,
  onUpdate,
  onDelete,
  onRefreshWebhook,
  isNewlyAdded: _isNewlyAdded,
}: {
  bot: Channel;
  onUpdate: (channelId: string, data: { defaultJourneyId?: string | null; isActive?: boolean }) => void;
  onDelete: (channelId: string) => void;
  onRefreshWebhook: (channelId: string) => void;
  isNewlyAdded?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: availableJourneys = [] } = useJourneyListManifest();
  const platform = PLATFORM_INFO[bot.platform as keyof typeof PLATFORM_INFO] || PLATFORM_INFO.telegram;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeactivationDialog, setShowDeactivationDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Find the assigned journey and check if it's active
  const assignedJourney = bot.defaultJourneyId ? availableJourneys.find((j) => j.id === bot.defaultJourneyId) : null;
  const hasActiveJourney = assignedJourney?.status === "active";

  // Fetch session count when deactivation dialog is shown
  const { data: activeSessionCount = 0, isLoading: isLoadingCount } = useActiveSessionsCount(bot.defaultJourneyId, showDeactivationDialog && hasActiveJourney);

  const handleJourneyChange = (value: string) => {
    const journeyId = value === "none" ? null : value;
    onUpdate(bot.id, { defaultJourneyId: journeyId });
  };

  const handleToggleActive = async () => {
    // If deactivating and has an active journey, show deactivation dialog
    if (bot.isActive && hasActiveJourney) {
      setShowDeactivationDialog(true);
    } else if (!bot.isActive && bot.defaultJourneyId) {
      // Activating bot with a journey - also set journey to active
      setIsUpdating(true);
      try {
        await journeysApi.updateJourney(bot.defaultJourneyId, { status: "active" });
        onUpdate(bot.id, { isActive: true });
        queryClient.invalidateQueries({ queryKey: journeyKeys.list() });
        // Success toast handled by SSE event
      } catch {
        notify.error("Failed to activate bot");
      } finally {
        setIsUpdating(false);
      }
    } else {
      // Direct toggle (no journey assigned)
      onUpdate(bot.id, { isActive: !bot.isActive });
    }
  };

  const handleDeactivationConfirm = async (mode: DeactivationMode) => {
    if (!bot.defaultJourneyId) return;

    setIsUpdating(true);
    try {
      // First pause/terminate the journey sessions
      await journeysApi.updateJourney(bot.defaultJourneyId, {
        status: "draft",
        deactivationMode: mode,
      });

      // Then deactivate the bot
      onUpdate(bot.id, { isActive: false });
      queryClient.invalidateQueries({ queryKey: journeyKeys.list() });
      // Success toast handled by SSE event
    } catch {
      notify.error("Failed to deactivate bot");
    } finally {
      setIsUpdating(false);
      setShowDeactivationDialog(false);
    }
  };

  return (
    <>
      <div className="group flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex size-12 items-center justify-center rounded-xl bg-primary/5 text-primary ring-1 ring-primary/10">
              <platform.icon className="h-6 w-6" />
              {bot.isActive && (
                <span className="absolute -right-1 -top-1 flex size-3">
                  {bot.defaultJourneyId ? (
                    <>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex size-3 rounded-full bg-green-500"></span>
                    </>
                  ) : (
                    <>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex size-3 rounded-full bg-orange-500"></span>
                    </>
                  )}
                </span>
              )}
            </div>
            <div>
              <TooltipProvider delayDuration={300}>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold leading-none tracking-tight">{bot.botName || bot.botUsername}</h4>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <Badge variant={bot.isActive ? "info" : "secondary"} className="h-5 px-1.5 text-[10px] font-medium uppercase tracking-wider">
                          {bot.isActive ? "Connected" : "Disconnected"}
                        </Badge>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs">
                        {bot.isActive
                          ? "Bot is active and can receive messages. Users can interact with this bot and messages will be processed through the assigned journey."
                          : "Bot is inactive and cannot receive messages. Activate the bot to enable message processing."}
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        {bot.defaultJourneyId ? (
                          <Badge variant="success" className="h-5 px-1.5 text-[10px] font-medium uppercase tracking-wider">
                            Journey Assigned
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="h-5 px-1.5 text-[10px] font-medium uppercase tracking-wider">
                            Assign Journey
                          </Badge>
                        )}
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs">
                        {bot.defaultJourneyId
                          ? "A default journey is assigned to this bot. All incoming messages will be processed through this journey unless specified otherwise."
                          : "No default journey is assigned. Assign a journey to enable message processing for this bot."}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              <a
                href={`https://t.me/${bot.botUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                @{bot.botUsername}
              </a>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleToggleActive}>
                <Power className="mr-2 h-4 w-4" />
                {bot.isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRefreshWebhook(bot.id)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Webhook
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Bot
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid gap-4 rounded-lg bg-muted/40 p-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Workflow className="h-3.5 w-3.5" />
              Default Journey
            </div>
            <Select value={bot.defaultJourneyId || "none"} onValueChange={handleJourneyChange}>
              <SelectTrigger className="h-9 bg-background/50">
                <SelectValue placeholder="Select journey" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No default journey</span>
                </SelectItem>
                {availableJourneys.map((journey) => (
                  <SelectItem key={journey.id} value={journey.id}>
                    {journey.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" />
              Webhook Status
            </div>
            <div className="flex h-9 items-center rounded-md border bg-background/50 px-3 text-xs text-muted-foreground font-mono">
              <span className="truncate">{bot.webhookUrl || "No webhook configured"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete @{bot.botUsername}? This will remove the webhook and disconnect the bot from all journeys. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(bot.id);
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivation Dialog for Active Journey */}
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

function AvailablePlatformCard({ platform, onConnect, disabled }: { platform: keyof typeof PLATFORM_INFO; onConnect?: () => void; disabled?: boolean }) {
  const info = PLATFORM_INFO[platform];

  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted/50">
          <info.icon className="h-5 w-5" />
        </div>
        <div>
          <span className="font-medium">{info.name}</span>
          <p className="text-sm text-muted-foreground">{info.description}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onConnect} disabled={disabled}>
        <Plus className="size-4 mr-1" />
        Connect
      </Button>
    </div>
  );
}

export function ConnectedSection() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newlyAddedBotIds, setNewlyAddedBotIds] = useState<Set<string>>(new Set());

  // TanStack Query hooks for channel data
  const { data: bots = [], isLoading } = useChannels();
  const updateChannelMutation = useUpdateChannel();
  const deleteChannelMutation = useDeleteChannel();
  const refreshWebhookMutation = useRefreshChannelWebhook();

  const handleUpdateBot = (channelId: string, data: { defaultJourneyId?: string | null; isActive?: boolean }) => {
    const shouldNotify = data.isActive === undefined;
    updateChannelMutation.mutate(
      { channelId, data },
      {
        onSuccess: () => {
          if (shouldNotify) {
            notify.success("Channel updated");
          }
        },
        onError: () => notify.error("Failed to update channel"),
      }
    );
  };

  const handleDeleteBot = (channelId: string) => {
    deleteChannelMutation.mutate(channelId, {
      onSuccess: () => {
        setNewlyAddedBotIds((prev) => {
          const next = new Set(prev);
          next.delete(channelId);
          return next;
        });
      },
      onError: () => notify.error("Failed to delete channel"),
    });
  };

  const handleRefreshWebhook = (channelId: string) => {
    refreshWebhookMutation.mutate(channelId, {
      onSuccess: () => notify.success("Webhook refreshed"),
      onError: () => notify.error("Failed to refresh webhook"),
    });
  };

  const handleBotAdded = (botId: string) => {
    setNewlyAddedBotIds((prev) => new Set(prev).add(botId));
  };

  const telegramBots = bots.filter((b) => b.platform === "telegram");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Connected Accounts</h2>
        <p className="text-sm text-muted-foreground">Manage your connected messaging platforms</p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Connected Bots */}
      {!isLoading && telegramBots.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Telegram Bots</h3>
          <div className="space-y-3">
            {telegramBots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                onUpdate={handleUpdateBot}
                onDelete={handleDeleteBot}
                onRefreshWebhook={handleRefreshWebhook}
                isNewlyAdded={newlyAddedBotIds.has(bot.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available Platforms */}
      {!isLoading && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{telegramBots.length > 0 ? "Add More" : "Available Platforms"}</h3>
          <div className="space-y-2">
            <AvailablePlatformCard platform="telegram" onConnect={() => setShowAddDialog(true)} />
            <AvailablePlatformCard platform="whatsapp" disabled />
          </div>
        </div>
      )}

      {/* Bot Setup Wizard */}
      <BotSetupWizard open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={handleBotAdded} />
    </div>
  );
}
