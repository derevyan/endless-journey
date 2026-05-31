/**
 * Agent Test Panel
 *
 * Slide-out chat interface for testing agent workflows.
 * Follows Journey Builder's simulator pattern.
 *
 * @module features/workflows/components/test-panel/agent-test-panel
 */

import { useCallback, useState } from "react";
import { useStore } from "@tanstack/react-store";
import { X, RotateCcw, MessageSquare, AlertCircle } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  ChatMessageArea,
  ChatMessageAreaContent,
  ChatMessageAreaScrollButton,
} from "@/shared/components/ui/chat-message-area";
import { ProcessingIndicator } from "@/shared/components/chat";
import { useExecuteAgentWorkflow } from "@/features/agent-workflows/hooks";
import { agentTestStore, agentTestActions } from "../../stores/agent-test-store";
import { AgentChatBubble } from "./agent-chat-bubble";
import { AgentChatInput } from "./agent-chat-input";

// =============================================================================
// TYPES
// =============================================================================

interface AgentTestPanelProps {
  workflowKey: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AgentTestPanel({ workflowKey }: AgentTestPanelProps) {
  const isOpen = useStore(agentTestStore, (s) => s.isOpen);
  const messages = useStore(agentTestStore, (s) => s.messages);
  const conversationId = useStore(agentTestStore, (s) => s.conversationId);
  const testState = useStore(agentTestStore, (s) => s.testState);
  const error = useStore(agentTestStore, (s) => s.error);

  const [inputValue, setInputValue] = useState("");
  const executeAgentWorkflow = useExecuteAgentWorkflow();

  // Core send logic - reusable for both text input and button clicks
  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim() || testState === "sending") return;

    agentTestActions.addUserMessage(message);

    // Build conversation history from previous messages
    // Must read from store.state to get the CURRENT state after addUserMessage
    const currentState = agentTestStore.state;
    const conversationHistory = currentState.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const result = await executeAgentWorkflow.mutateAsync({
        key: workflowKey,
        message,
        conversationId: conversationId ?? undefined,
        conversationHistory,
      });

      agentTestActions.addAssistantMessage(result.message, result.conversationId, {
        status: result.executionTrace.status,
        durationMs: result.executionTrace.durationMs,
        path: result.executionTrace.path,
      });
    } catch (err) {
      agentTestActions.setError(err instanceof Error ? err.message : "Failed to execute agent");
    }
  }, [workflowKey, conversationId, testState, executeAgentWorkflow]);

  // Text input submit handler
  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    handleSendMessage(inputValue.trim());
    setInputValue("");
  }, [inputValue, handleSendMessage]);

  // Button click handler - sends button label as user message
  const handleButtonClick = useCallback((buttonLabel: string) => {
    handleSendMessage(buttonLabel);
  }, [handleSendMessage]);

  const handleReset = useCallback(() => {
    agentTestActions.reset();
    setInputValue("");
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-96 border-l bg-background flex flex-col z-10 shadow-lg"
      data-testid="agent-test-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4" />
          <span className="font-medium text-sm">Test Agent</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={handleReset}
            title="Reset conversation"
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => agentTestActions.close()}
            title="Close panel"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <ChatMessageArea className="flex-1">
        <ChatMessageAreaContent className="py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
              <MessageSquare className="size-8 mb-2 opacity-50" />
              <p>Send a message to test your agent</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <AgentChatBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.timestamp}
                  buttons={msg.buttons}
                  onButtonClick={handleButtonClick}
                  trace={msg.trace}
                />
              ))}
            </>
          )}

          {/* Processing indicator */}
          {testState === "sending" && <ProcessingIndicator />}

          {/* Error display */}
          {testState === "error" && error && (
            <div className="flex gap-2 px-3 py-1">
              <div className="size-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertCircle className="size-3 text-destructive" />
              </div>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            </div>
          )}
        </ChatMessageAreaContent>
        <ChatMessageAreaScrollButton />
      </ChatMessageArea>

      {/* Input */}
      <AgentChatInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSend}
        disabled={testState === "sending"}
        isProcessing={testState === "sending"}
      />
    </div>
  );
}
