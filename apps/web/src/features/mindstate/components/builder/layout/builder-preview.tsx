/**
 * MindState Builder Preview
 *
 * Center panel with chat interface for testing.
 * Includes push-to-talk voice input and TTS playback.
 */

import { AudioLines, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useStore } from "@tanstack/react-store";
import { AudioWaveform, VoiceButton } from "@/shared/components/chat";
import { ScrollArea, ScrollBar } from "@/shared/components/ui/scroll-area";
import { useVoiceChat } from "@/shared/hooks/audio";
import { createLogger, serializeError } from "@journey/logger";
import type { PreviewMessage } from "../../../lib/types";
import { SLASH_COMMANDS, generateId } from "../../../lib/defaults";
import { builderActions, builderSelectors, builderStore } from "../../../stores/builder-store";
import { usePreviewAnalyze } from "../../../hooks/mutations/use-mindstate-mutations";
import { CommandMenu } from "../preview/command-menu";
import { MessageBubble } from "../preview/message-bubble";
import { PlaceholdersAndVanishInput } from "../preview/placeholders-and-vanish-input";
import { ProcessingIndicator } from "@/shared/components/chat/processing-indicator";

const log = createLogger("builder-preview");

export function BuilderPreview() {
  const [input, setInput] = useState("");
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const messages = useStore(builderStore, builderSelectors.previewMessages);
  const mainAgent = useStore(builderStore, builderSelectors.mainAgent);
  const isProcessing = useStore(builderStore, builderSelectors.isProcessing);
  const processingStatus = useStore(builderStore, (s) => s.preview.processingStatus);
  const definition = useStore(builderStore, builderSelectors.definition);
  const previewParameters = useStore(builderStore, builderSelectors.previewParameters);
  const systemAgents = useStore(builderStore, builderSelectors.systemAgents);

  // Mutation hook for preview analysis
  const previewAnalyze = usePreviewAnalyze();

  // Voice chat hook
  const {
    status: voiceStatus,
    isRecording,
    isPlayingResponse,
    audioLevel,
    error: voiceError,
    startRecording,
    stopAndTranscribe,
    speakText,
    interruptPlayback,
  } = useVoiceChat({
    ttsEnabled,
    onTranscriptionComplete: (transcript) => {
      // Put transcription in input field for review before sending
      if (transcript.trim()) {
        setInput(transcript.trim());
      }
    },
  });

  // Auto-scroll to bottom when messages change or processing
  useEffect(() => {
    if (scrollAreaRef.current) {
      // Find the viewport element inside ScrollArea
      const viewport = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [messages, isProcessing]);

  // Auto-speak last assistant message when TTS is enabled
  const lastAssistantMessageRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ttsEnabled || isProcessing) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && lastMessage.id !== lastAssistantMessageRef.current) {
      lastAssistantMessageRef.current = lastMessage.id;
      speakText(lastMessage.content);
    }
  }, [messages, ttsEnabled, isProcessing, speakText]);

  // Show command menu when input starts with /
  useEffect(() => {
    setShowCommandMenu(input.startsWith("/") && input.length > 0);
  }, [input]);

  // Close command menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowCommandMenu(false);
      }
    };

    if (showCommandMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCommandMenu]);

  // Close command menu on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowCommandMenu(false);
      }
    };

    if (showCommandMenu) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showCommandMenu]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing || !definition) return;

    const text = input.trim();

    // Create user message
    const userMessage: PreviewMessage = {
      id: generateId("msg"),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    // Add user message to preview immediately
    builderActions.addPreviewMessage(userMessage);

    // Set processing state
    builderActions.setPreviewProcessing(true, "Analyzing message...");
    setShowCommandMenu(false);

    try {
      // Build message history for context (filter out system messages)
      const messageHistory = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      // Call preview analysis via mutation
      const result = await previewAnalyze.mutateAsync({
        key: definition.key,
        input: {
          message: text,
          currentState: previewParameters,
          systemAgents: systemAgents,
          mainAgent: definition.mainAgentConfig,
          messageHistory,
        },
      });

      // Apply results to store
      builderActions.applyPreviewResults({
        response: result.response,
        insights: result.insights,
        stateChanges: result.stateChanges,
        updatedState: result.updatedState,
      });

      log.info(
        {
          messageLength: text.length,
          changesCount: result.stateChanges.length,
          insightsCount: result.insights.length,
        },
        "builderPreview:handleSend:success"
      );
    } catch (error) {
      // Error already logged and toasted by mutation hook
      // Remove the user message since analysis failed
      builderActions.removeLastPreviewMessage();
      builderActions.setPreviewProcessing(false);

      log.error({ err: serializeError(error) }, "builderPreview:handleSend:error");
    }
  }, [input, isProcessing, definition, messages, previewParameters, systemAgents, previewAnalyze]);

  const handleCommandSelect = (text: string) => {
    setInput(text);
    setShowCommandMenu(false);
  };

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* Messages */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center text-muted-foreground">
          <p className="text-sm">No messages yet</p>
          <p className="text-xs mt-1">
            Type a message below or use <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">/</kbd> for quick scenarios
          </p>
        </div>
      ) : (
        <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
          <div className="px-4 py-4 space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} agentName={mainAgent?.name} agentAvatar={mainAgent?.avatar} agentColor={mainAgent?.color} />
            ))}

            {isProcessing && <ProcessingIndicator status={processingStatus} />}
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      )}

      {/* Input Area */}
      <div className="p-4">
        <div ref={containerRef} className="relative flex flex-col gap-4">
          {showCommandMenu && <CommandMenu input={input} onSelect={handleCommandSelect} onClose={() => setShowCommandMenu(false)} />}

          <div className="bg-muted/20 rounded-4xl w-full space-y-2 px-4 py-3 border border-border/50 overflow-hidden">
            <PlaceholdersAndVanishInput
              placeholder="Ask anything..."
              className="min-h-10 w-full max-w-full bg-transparent shadow-none"
              onChange={(e) => setInput(e.target.value)}
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              value={input}
              setValue={setInput}
              disabled={isProcessing}
            />

            <div className="flex h-10 w-full items-center justify-between px-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                {/* Recording waveform */}
                {isRecording && <AudioWaveform level={audioLevel} bars={7} height={14} variant="sky" />}
                {/* Voice status indicator */}
                {voiceStatus === "transcribing" && <span className="text-xs text-muted-foreground animate-pulse">Transcribing...</span>}
                {isPlayingResponse && <span className="text-xs text-primary animate-pulse">Speaking...</span>}
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                {/* Voice recording button */}
                <VoiceButton
                  isRecording={isRecording}
                  isTranscribing={voiceStatus === "transcribing"}
                  disabled={isProcessing}
                  error={voiceError}
                  onStartRecording={startRecording}
                  onStopRecording={stopAndTranscribe}
                />
                {/* TTS toggle button */}
                <button
                  onClick={() => {
                    if (isPlayingResponse) {
                      interruptPlayback();
                    }
                    setTtsEnabled(!ttsEnabled);
                  }}
                  className={`flex size-7 items-center justify-center rounded-full transition-colors ${
                    ttsEnabled ? "bg-primary text-primary-foreground" : "bg-foreground/5 hover:bg-foreground/10 text-muted-foreground"
                  }`}
                  title={ttsEnabled ? "Disable voice responses" : "Enable voice responses"}
                >
                  {ttsEnabled ? <Volume2 className="size-3.5" /> : <AudioLines className="size-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {SLASH_COMMANDS.map((cmd) => (
              <button
                key={cmd.cmd}
                onClick={() => setInput(cmd.text)}
                className="bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground inline-block cursor-pointer rounded-full px-3 py-1 text-[10px] tracking-tight transition-colors"
              >
                {cmd.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
