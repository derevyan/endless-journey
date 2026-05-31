/**
 * Bot Setup Wizard
 *
 * 2-step dialog for setting up a Telegram bot:
 * 1. Enter bot token from @BotFather
 * 2. Select a journey to assign (required, auto-skipped if no journeys)
 *
 * Bot auto-activates upon completion.
 *
 * @module components/settings/sections/bot-setup-wizard
 */

import { useQueryClient } from "@tanstack/react-query";
import { Bot, Check, ChevronRight, Loader2, Workflow } from "lucide-react";
import { useState } from "react";

import { useJourneyListManifest } from "@/hooks/queries";
import { useCreateChannel, useUpdateChannel, type Channel } from "@/hooks/queries/use-channels";
import { Badge } from "@/shared/components/ui/badges";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { journeysApi } from "@/shared/lib/api/journeys";
import { cn } from "@/shared/lib/utils";
import { notify } from "@/shared/lib/ui/notify";
import { journeyKeys } from "@/shared/lib/query-keys";

interface BotSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (botId: string) => void;
}

type WizardStep = "token" | "journey";

const STEPS: { id: WizardStep; title: string; icon: typeof Bot }[] = [
  { id: "token", title: "Connect Bot", icon: Bot },
  { id: "journey", title: "Assign Journey", icon: Workflow },
];

function StepIndicator({ currentStep, steps }: { currentStep: WizardStep; steps: typeof STEPS }) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                "flex items-center justify-center size-8 rounded-full text-xs font-medium transition-colors",
                isCompleted && "bg-primary text-primary-foreground",
                isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary/20 ring-offset-2",
                !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
              )}
            >
              {isCompleted ? <Check className="size-4" /> : index + 1}
            </div>
            {index < steps.length - 1 && (
              <div className={cn("w-8 h-0.5 mx-1", index < currentIndex ? "bg-primary" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Step 1: Token Input
function TokenStep({
  botToken,
  setBotToken,
  error,
  isLoading,
}: {
  botToken: string;
  setBotToken: (token: string) => void;
  error: string | null;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="botToken">Bot Token</Label>
        <Input
          id="botToken"
          type="password"
          placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          disabled={isLoading}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Get this token from{" "}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            @BotFather
          </a>{" "}
          on Telegram.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

// Step 2: Journey Selection
function JourneyStep({
  selectedJourneyId,
  setSelectedJourneyId,
  botName,
}: {
  selectedJourneyId: string | null;
  setSelectedJourneyId: (id: string | null) => void;
  botName: string;
}) {
  const { data: journeys = [], isLoading } = useJourneyListManifest();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
        <Check className="size-4 text-green-600" />
        <span className="text-sm text-green-700 dark:text-green-400">
          Connected: <span className="font-medium">@{botName}</span>
        </span>
      </div>

      <div className="space-y-2">
        <Label>Select a journey for this bot</Label>
        <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
          {journeys.map((journey) => (
            <button
              key={journey.id}
              type="button"
              onClick={() => setSelectedJourneyId(journey.id)}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors",
                selectedJourneyId === journey.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "size-4 rounded-full border-2 flex items-center justify-center",
                    selectedJourneyId === journey.id ? "border-primary bg-primary" : "border-muted-foreground/30"
                  )}
                >
                  {selectedJourneyId === journey.id && <Check className="size-2.5 text-primary-foreground" />}
                </div>
                <span className="font-medium">{journey.name}</span>
              </div>
              <Badge variant={journey.status === "active" ? "success" : "secondary"} className="text-[10px]">
                {journey.status === "active" ? "Active" : "Inactive"}
              </Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BotSetupWizard({ open, onOpenChange, onSuccess }: BotSetupWizardProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<WizardStep>("token");
  const [botToken, setBotToken] = useState("");
  const [createdChannel, setCreatedChannel] = useState<Channel | null>(null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const createChannelMutation = useCreateChannel();
  const updateChannelMutation = useUpdateChannel();
  const { data: journeys = [] } = useJourneyListManifest();

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStep("token");
      setBotToken("");
      setCreatedChannel(null);
      setSelectedJourneyId(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  // Handle step transitions
  const handleNext = async () => {
    setError(null);

    if (step === "token") {
      // Validate and create channel
      createChannelMutation.mutate(botToken, {
        onSuccess: (channel) => {
          setCreatedChannel(channel);
          // Check if we should skip journey step (no journeys exist)
          if (journeys.length === 0) {
            // Complete immediately without journey
            handleCompleteWithChannel(channel, null);
          } else {
            setStep("journey");
          }
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to connect bot");
        },
      });
    } else if (step === "journey") {
      // Complete setup with selected journey
      await handleComplete();
    }
  };

  const handleCompleteWithChannel = async (channel: Channel, journeyId: string | null) => {
    setIsCompleting(true);

    try {
      const updateData: { defaultJourneyId?: string | null; isActive?: boolean } = {
        isActive: true, // Always auto-activate
      };

      if (journeyId) {
        updateData.defaultJourneyId = journeyId;
        // Also activate the journey
        await journeysApi.updateJourney(journeyId, { status: "active" });
        queryClient.invalidateQueries({ queryKey: journeyKeys.list() });
      }

      await updateChannelMutation.mutateAsync({ channelId: channel.id, data: updateData });

      onSuccess(channel.id);
      handleOpenChange(false);
    } catch {
      notify.error("Failed to complete setup");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleComplete = async () => {
    if (!createdChannel) return;
    await handleCompleteWithChannel(createdChannel, selectedJourneyId);
  };

  // Determine button states
  const isLoading = createChannelMutation.isPending || isCompleting;
  const canProceed =
    (step === "token" && botToken.trim()) ||
    (step === "journey" && selectedJourneyId);

  const getStepDescription = () => {
    switch (step) {
      case "token":
        return "Enter your bot token from @BotFather to connect your Telegram bot.";
      case "journey":
        return "Choose which journey should handle messages from this bot.";
    }
  };

  const getNextButtonText = () => {
    if (isLoading) {
      if (step === "token") return "Connecting...";
      if (step === "journey") return "Completing...";
    }
    if (step === "journey") return "Complete Setup";
    return "Next";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Telegram Bot</DialogTitle>
          <DialogDescription>{getStepDescription()}</DialogDescription>
        </DialogHeader>

        <StepIndicator currentStep={step} steps={STEPS} />

        <div className="py-2">
          {step === "token" && (
            <TokenStep
              botToken={botToken}
              setBotToken={setBotToken}
              error={error}
              isLoading={createChannelMutation.isPending}
            />
          )}

          {step === "journey" && createdChannel && (
            <JourneyStep
              selectedJourneyId={selectedJourneyId}
              setSelectedJourneyId={setSelectedJourneyId}
              botName={createdChannel.botUsername || "Bot"}
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex gap-2 ml-auto">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleNext} disabled={!canProceed || isLoading}>
              {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
              {getNextButtonText()}
              {!isLoading && step === "token" && <ChevronRight className="size-4 ml-1" />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
