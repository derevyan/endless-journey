/**
 * Workflow Chat Panel
 *
 * Chat interface for testing agent workflows.
 * Designed to fit within a resizable panel in the sidebar layout.
 *
 * @module features/agent-workflows/components/test-panel/workflow-chat-panel
 */

import { useCallback, useState } from "react";
import { useStore } from "@tanstack/react-store";
import { MessageSquare, AlertCircle } from "lucide-react";
import { createLogger, serializeError } from "@journey/logger";

import {
  ChatMessageArea,
  ChatMessageAreaContent,
  ChatMessageAreaScrollButton,
} from "@/shared/components/ui/chat-message-area";
import { ProcessingIndicator } from "@/shared/components/chat";
import { useExecuteAgentWorkflow } from "@/features/agent-workflows/hooks";
import { agentWorkflowStore, agentWorkflowActions } from "../../stores/agent-workflow-store";
import { agentTestStore, agentTestActions } from "../../stores/agent-test-store";
import { AgentChatBubble } from "./agent-chat-bubble";
import { AgentChatInput } from "./agent-chat-input";

const log = createLogger("workflow-chat-panel");

/**
 * WorkflowChatPanel - Chat interface for testing agent workflows
 *
 * This component is designed to fit within a ResizablePanel in the sidebar.
 * It doesn't have its own header - that's handled by WorkflowSimulatorControls.
 */
export function WorkflowChatPanel() {
  const workflowKey = useStore(agentWorkflowStore, (s) => s.workflowKey);
  const messages = useStore(agentTestStore, (s) => s.messages);
  const conversationId = useStore(agentTestStore, (s) => s.conversationId);
  const testState = useStore(agentTestStore, (s) => s.testState);
  const error = useStore(agentTestStore, (s) => s.error);
  const testVariables = useStore(agentTestStore, (s) => s.testVariables);

  const [inputValue, setInputValue] = useState("");
  const executeAgentWorkflow = useExecuteAgentWorkflow();

  // Core send logic - reusable for both text input and button clicks
  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim() || testState === "sending" || !workflowKey) return;

    agentTestActions.addUserMessage(message);

    // Clear previous execution state before starting
    // Note: Real-time SSE events now handle console events and path highlighting
    // This call ensures clean slate if SSE events haven't arrived yet
    agentWorkflowActions.clearSimulatorVisitedNodes();
    agentTestActions.clearConsoleEvents();

    // Build conversation history from store (not from captured variable)
    // Must read from store.state to get the CURRENT state after addUserMessage
    // The captured `messages` variable is from the previous render and may be stale
    const currentState = agentTestStore.state;
    const conversationHistory = currentState.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      // Include test variables as mockContext if any are set
      const mockContext = Object.keys(testVariables).length > 0
        ? { variables: testVariables }
        : undefined;

      const result = await executeAgentWorkflow.mutateAsync({
        key: workflowKey,
        message,
        conversationId: conversationId ?? undefined,
        conversationHistory,
        mockContext,
      });

      // Add assistant message (always needed - shows actual response content)
      agentTestActions.addAssistantMessage(result.message, result.conversationId, {
        status: result.executionTrace.status,
        durationMs: result.executionTrace.durationMs,
        path: result.executionTrace.path,
      });

      // Note: Console events and path highlighting are now handled in real-time
      // by workflow-event-subscriptions.ts via SSE events. The subscription handlers
      // update simulator state (currentNode, visitedNodes, visitedEdges) and add
      // console events as each node executes, providing live feedback.
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to execute workflow";

      log.error(
        { err: serializeError(err), workflowKey, conversationId },
        "workflowChatPanel:executionFailed"
      );

      agentTestActions.setError(errorMessage);

      // Add error event to console
      agentTestActions.addConsoleEvent({
        type: "workflow_error",
        message: `Error: ${errorMessage}`,
      });
    }
  }, [workflowKey, conversationId, testState, testVariables, executeAgentWorkflow]);

  // Text input submit handler
  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    handleSendMessage(inputValue.trim());
    setInputValue("");
  }, [inputValue, handleSendMessage]);

  // Button click handler - looks up label by ID and sends as user message
  const handleButtonClick = useCallback((buttonId: string) => {
    // Find the button in the most recent assistant message that has buttons
    const currentMessages = agentTestStore.state.messages;
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      const msg = currentMessages[i];
      if (msg.role === "assistant" && msg.buttons) {
        const button = msg.buttons.find((b) => b.id === buttonId);
        if (button) {
          handleSendMessage(button.label);
          return;
        }
      }
    }
    // Fallback: if button not found, use the ID (shouldn't happen normally)
    handleSendMessage(buttonId);
  }, [handleSendMessage]);

  return (
    <div className="flex flex-col h-full" data-testid="workflow-chat-panel">
      {/* Chat Area */}
      <ChatMessageArea className="flex-1">
        <ChatMessageAreaContent className="py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
              <MessageSquare className="size-8 mb-2 opacity-50" />
              <p>Send a message to test your workflow</p>
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
            <div className="flex gap-2 px-3 py-1 min-w-0">
              <div className="size-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertCircle className="size-3 text-destructive" />
              </div>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-sm text-destructive min-w-0 break-all">
                {error}
              </div>
            </div>
          )}
        </ChatMessageAreaContent>
        <ChatMessageAreaScrollButton />
      </ChatMessageArea>

      {/* Input */}
      <AgentChatInput value={inputValue} onChange={setInputValue} onSubmit={handleSend} disabled={testState === "sending"} isProcessing={testState === "sending"} />
    </div>
  );
}
