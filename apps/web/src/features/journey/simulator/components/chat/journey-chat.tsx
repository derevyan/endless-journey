/**
 * Journey Chat
 *
 * Main chat container for journey simulation and session playback.
 * Self-managing component - reads console state from uiStore, uses actions directly.
 *
 * @module features/simulator/components/chat/journey-chat
 */

import { useStore } from "@tanstack/react-store";
import type { InteractionEvent } from "@journey/schemas";
import { Bug, Eye, MessagesSquare, RotateCcw, Terminal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppHeader, AppHeaderIcon, AppHeaderSeparator, AppHeaderTitle } from "@/shared/components/layout/header-primitives";
import { Button } from "@/shared/components/ui/button";
import { ChatMessageArea, ChatMessageAreaContent, ChatMessageAreaScrollButton } from "@/shared/components/ui/chat-message-area";
import { cn } from "@/shared/lib/utils";
import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";
import { uiActions, uiStore } from "@/stores/ui-store";

import { useSimulatorContext } from "../../context";
import { replayUpToIndex } from "../../lib";
import { PlaybackControls } from "../controls/playback-controls";
import { TimerDisplay } from "../controls/timer-display";
import { ChatBubble } from "./chat-bubble";
import { ChatInput } from "./chat-input";
import { NoChatMessages, ProcessingIndicator, WaitingForUserIndicator } from "./chat-state-indicators";
import { shouldShowEventCard, SystemEventRenderer } from "./system-events";
import type { JourneyChatMessage } from "./types";

/**
 * Union type for display items - either a message or a system event
 */
type DisplayItem =
  | { type: "message"; data: JourneyChatMessage; timestamp: Date }
  | { type: "event"; data: InteractionEvent; timestamp: Date };

/**
 * Props - only data that can't be derived from stores
 */
interface JourneyChatProps {
  /** Journey nodes for button label lookup in playback mode */
  nodes?: JourneyNode[];
}

/**
 * JourneyChat - Main chat UI for simulator.
 *
 * Self-managing component - reads console visibility from uiStore,
 * uses uiActions for toggle, gets reset from simulator context.
 */
export function JourneyChat({ nodes }: JourneyChatProps) {
  // Read console visibility from uiStore
  const showConsole = useStore(uiStore, (s) => s.showConsole);

  // Get simulator state and actions from context
  const simulator = useSimulatorContext();
  const {
    messages,
    sendMessage,
    handleButtonClick: contextButtonClick,
    activeTimer: contextActiveTimer,
    skipTimer,
    chatState = "idle",
    playback,
    eventLog,
  } = simulator;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [enhancedView, setEnhancedView] = useState(false);

  const isPlaybackMode = playback?.isReadOnly ?? false;

  // Use uiActions for console toggle
  const handleToggleConsole = useCallback(() => {
    uiActions.toggleConsole();
  }, []);

  // Use simulator context for reset
  const handleReset = useCallback(() => {
    simulator.stopSession();
  }, [simulator]);

  // Construct timer display object from context values
  const activeTimer = useMemo(
    () =>
      contextActiveTimer
        ? {
            id: contextActiveTimer.id,
            durationMs: contextActiveTimer.durationMs,
            onSkip: skipTimer,
          }
        : null,
    [contextActiveTimer, skipTimer]
  );

  // Get messages to display based on mode
  const displayMessages = useMemo(() => {
    if (!isPlaybackMode || !playback || !eventLog) {
      return messages;
    }

    // Pass nodes for button label lookup from historical buttonId values
    const replayState = replayUpToIndex(
      eventLog as Parameters<typeof replayUpToIndex>[0],
      playback.playbackIndex,
      nodes
    );

    return replayState.messages.map((pm) => ({
      id: pm.id,
      message: pm.message,
      timestamp: pm.timestamp,
      from: pm.from,
    }));
  }, [isPlaybackMode, playback, eventLog, messages, nodes]);

  // Get system events to display when in enhanced view
  const displaySystemEvents = useMemo(() => {
    if (!enhancedView || !eventLog) return [];

    const events = isPlaybackMode && playback
      ? (eventLog as InteractionEvent[]).slice(0, playback.playbackIndex + 1)
      : (eventLog as InteractionEvent[]);

    return events.filter(shouldShowEventCard);
  }, [enhancedView, eventLog, isPlaybackMode, playback]);

  // Create unified display list interleaving messages and system events
  // Optimized using linear merge instead of concat+sort
  const displayItems = useMemo((): DisplayItem[] => {
    const items: DisplayItem[] = [];

    // Early exit if no data
    if (displayMessages.length === 0 && (!enhancedView || displaySystemEvents.length === 0)) {
      return items;
    }

    // Pointers for linear merge
    let msgIndex = 0;
    let eventIndex = 0;

    // Helper to get timestamp
    const getMsgTime = (idx: number) => new Date(displayMessages[idx].timestamp).getTime();
    const getEventTime = (idx: number) => new Date(displaySystemEvents[idx].timestamp).getTime();

    // Loop while there are items in either list
    while (msgIndex < displayMessages.length || (enhancedView && eventIndex < displaySystemEvents.length)) {
      const hasMoreMessages = msgIndex < displayMessages.length;
      const hasMoreEvents = enhancedView && eventIndex < displaySystemEvents.length;

      if (hasMoreMessages && (!hasMoreEvents || getMsgTime(msgIndex) <= getEventTime(eventIndex))) {
        // Next item is a message
        items.push({
          type: "message",
          data: displayMessages[msgIndex],
          timestamp: new Date(displayMessages[msgIndex].timestamp),
        });
        msgIndex++;
      } else {
        // Next item is an event
        items.push({
          type: "event",
          data: displaySystemEvents[eventIndex],
          timestamp: new Date(displaySystemEvents[eventIndex].timestamp),
        });
        eventIndex++;
      }
    }

    return items;
  }, [displayMessages, displaySystemEvents, enhancedView]);

  const currentInteractionIndex = playback?.playbackIndex ?? -1;

  const handleSubmit = () => {
    if (inputValue.trim() && !isPlaybackMode) {
      sendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  // Auto-scroll to bottom when items change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayItems.length, activeTimer, currentInteractionIndex]);

  const isDisabled = isPlaybackMode || chatState === "processing" || chatState === "completed";

  const handleButtonClick = (buttonId: string) => {
    if (!isPlaybackMode) {
      contextButtonClick(buttonId);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <AppHeader className="h-10 border-b shrink-0">
        <AppHeaderIcon className="hidden md:flex">
          <MessagesSquare className="size-4" />
        </AppHeaderIcon>
        <AppHeaderSeparator className="hidden md:block" />
        <AppHeaderTitle className="text-sm">{isPlaybackMode ? "Session Playback" : "Chat"}</AppHeaderTitle>
        <div className="ml-auto flex items-center gap-1">
          {/* Enhanced/Simple view toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEnhancedView(!enhancedView)}
            className={cn("size-7", enhancedView && "text-primary")}
            title={enhancedView ? "Switch to simple view (client view)" : "Switch to enhanced view (debug info)"}
          >
            {enhancedView ? <Eye className="h-3.5 w-3.5" /> : <Bug className="h-3.5 w-3.5" />}
          </Button>
          {!isPlaybackMode && (
            <Button variant="ghost" size="icon-sm" onClick={handleReset} className="size-7" title="Reset chat messages">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={handleToggleConsole} className="size-7" title={showConsole ? "Hide console" : "Show console"}>
            <Terminal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </AppHeader>

      {/* Playback Controls */}
      {isPlaybackMode && <PlaybackControls className="border-b" />}

      {/* Messages Area */}
      <ChatMessageArea className="flex-1 min-h-0">
        <ChatMessageAreaContent className="py-3 space-y-1">
          {displayItems.length === 0 ? (
            <NoChatMessages />
          ) : (
            displayItems.map((item, index) => {
              // Handle system events
              if (item.type === "event") {
                // Find the previous EVENT (not just the previous item) for time delta
                const prevEventItem = displayItems
                  .slice(0, index)
                  .reverse()
                  .find((i) => i.type === "event");
                const prevEvent = prevEventItem?.type === "event" ? prevEventItem.data : undefined;

                return (
                  <div key={item.data.id} className="py-0.5">
                    <SystemEventRenderer
                      event={item.data}
                      prevEvent={prevEvent}
                    />
                  </div>
                );
              }

              // Handle messages
              const msg = item.data;
              const isCurrentPlaybackMessage = isPlaybackMode && index === displayItems.length - 1 && item.type === "message";
              const isActionMessage = msg.message.content?.startsWith("__ACTION__") ?? false;
              const displayContent = isActionMessage ? msg.message.content?.replace("__ACTION__", "") : msg.message.content;

              return (
                <div key={msg.id} className={cn("transition-all duration-200", isCurrentPlaybackMessage && "border-l-2 border-primary")}>
                  <ChatBubble
                    content={displayContent}
                    buttons={isPlaybackMode ? undefined : msg.message.buttons}
                    media={msg.message.media}
                    timestamp={msg.timestamp}
                    isBot={msg.from === "bot"}
                    isAction={isActionMessage}
                    onButtonClick={handleButtonClick}
                  />
                </div>
              );
            })
          )}

          {/* Active Timer Display */}
          {!isPlaybackMode && activeTimer && (
            <div className="px-3 py-2">
              <TimerDisplay timerId={activeTimer.id} durationMs={activeTimer.durationMs} onSkip={activeTimer.onSkip} />
            </div>
          )}

          {/* State indicators */}
          {!isPlaybackMode && chatState === "waiting_for_user" && messages.length > 0 && !activeTimer && <WaitingForUserIndicator />}
          {!isPlaybackMode && chatState === "processing" && <ProcessingIndicator />}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </ChatMessageAreaContent>
        <ChatMessageAreaScrollButton alignment="center" />
      </ChatMessageArea>

      {/* Input Area */}
      {!isPlaybackMode && (
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          disabled={isDisabled}
          isProcessing={chatState === "processing"}
          isCompleted={chatState === "completed"}
        />
      )}
    </div>
  );
}
