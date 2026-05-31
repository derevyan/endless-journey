/**
 * Agent Test Store
 *
 * State management for agent testing chat interface.
 *
 * @module features/workflows/stores/agent-test-store
 */

import { Store } from "@tanstack/react-store";

import { parseStructuredOutput } from "@/shared/lib/utils/parse-structured-output";

// =============================================================================
// TYPES
// =============================================================================

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** Quick-reply buttons extracted from structured AI output */
  buttons?: Array<{ id: string; label: string }>;
  trace?: {
    status: "completed" | "blocked" | "error";
    durationMs: number;
    path: string[];
  };
}

/** Console event types for workflow execution */
export type ConsoleEventType =
  | "workflow_start"
  | "workflow_complete"
  | "workflow_error"
  | "node_start"
  | "node_complete"
  | "node_error"
  | "node_blocked"
  | "tool_call";

/** Console event for workflow execution display */
export interface ConsoleEvent {
  id: string;
  timestamp: Date;
  type: ConsoleEventType;
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
  durationMs?: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface AgentTestState {
  /** Whether the test panel is open */
  isOpen: boolean;
  /** Chat messages in the conversation */
  messages: AgentChatMessage[];
  /** Current conversation ID for multi-turn testing */
  conversationId: string | null;
  /** Current test state */
  testState: "idle" | "sending" | "error";
  /** Error message if any */
  error: string | null;
  /** Console events for execution display */
  consoleEvents: ConsoleEvent[];
  /** Whether console panel is visible */
  showConsole: boolean;
  /** Test variables passed as mockContext.variables during execution */
  testVariables: Record<string, unknown>;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: AgentTestState = {
  isOpen: false,
  messages: [],
  conversationId: null,
  testState: "idle",
  error: null,
  consoleEvents: [],
  showConsole: true,
  testVariables: {},
};

// =============================================================================
// STORE
// =============================================================================

// HMR Protection: Preserve store instance across hot module reloads.
// Without this, React components remain subscribed to old instances, breaking reactivity.

declare global {
   
  var __agentTestStore: Store<AgentTestState> | undefined;
}

function getOrCreateStore(): Store<AgentTestState> {
  if (typeof globalThis.__agentTestStore !== "undefined") {
    return globalThis.__agentTestStore;
  }
  const store = new Store<AgentTestState>(initialState);
  if (import.meta.env.DEV) {
    globalThis.__agentTestStore = store;
  }
  return store;
}

export const agentTestStore = getOrCreateStore();

// =============================================================================
// ACTIONS
// =============================================================================

export const agentTestActions = {
  /**
   * Open the test panel
   */
  open() {
    agentTestStore.setState((s) => ({ ...s, isOpen: true }));
  },

  /**
   * Close the test panel
   */
  close() {
    agentTestStore.setState((s) => ({ ...s, isOpen: false }));
  },

  /**
   * Reset the test panel to initial state (clear conversation)
   */
  reset() {
    agentTestStore.setState((s) => ({
      ...initialState,
      isOpen: s.isOpen, // Keep panel open
      showConsole: s.showConsole, // Keep console visibility
    }));
  },

  /**
   * Add a user message to the conversation
   */
  addUserMessage(content: string) {
    const message: AgentChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };
    agentTestStore.setState((s) => ({
      ...s,
      messages: [...s.messages, message],
      testState: "sending",
      error: null,
    }));
  },

  /**
   * Add an assistant (agent) response to the conversation
   */
  addAssistantMessage(
    content: string,
    conversationId: string,
    trace?: AgentChatMessage["trace"]
  ) {
    // Parse structured output (e.g., {"response":"text","buttons":[...]})
    // to extract response text and optional quick-reply buttons
    const { text, buttons } = parseStructuredOutput(content);

    // Convert buttons to { id, label } format for UI rendering
    const formattedButtons = buttons?.length
      ? buttons.map((btn, idx) => ({
          id: `btn-${idx}`,
          label: btn.emoji ? `${btn.emoji} ${btn.label}` : btn.label,
        }))
      : undefined;

    const message: AgentChatMessage = {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: text,
      buttons: formattedButtons,
      timestamp: new Date(),
      trace,
    };
    agentTestStore.setState((s) => ({
      ...s,
      messages: [...s.messages, message],
      conversationId,
      testState: "idle",
    }));
  },

  /**
   * Set an error state
   */
  setError(error: string) {
    agentTestStore.setState((s) => ({
      ...s,
      testState: "error",
      error,
    }));
  },

  /**
   * Clear error and reset to idle
   */
  clearError() {
    agentTestStore.setState((s) => ({
      ...s,
      testState: "idle",
      error: null,
    }));
  },

  // =========================================================================
  // CONSOLE ACTIONS
  // =========================================================================

  /**
   * Add a single console event
   */
  addConsoleEvent(event: Omit<ConsoleEvent, "id" | "timestamp">) {
    const fullEvent: ConsoleEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(),
    };
    agentTestStore.setState((s) => ({
      ...s,
      consoleEvents: [...s.consoleEvents, fullEvent],
    }));
  },

  /**
   * Add multiple console events at once (for batch updates from execution trace)
   */
  addConsoleEvents(events: Array<Omit<ConsoleEvent, "id">>) {
    const fullEvents: ConsoleEvent[] = events.map((event, index) => ({
      ...event,
      id: `evt-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    }));
    agentTestStore.setState((s) => ({
      ...s,
      consoleEvents: [...s.consoleEvents, ...fullEvents],
    }));
  },

  /**
   * Clear all console events
   */
  clearConsoleEvents() {
    agentTestStore.setState((s) => ({
      ...s,
      consoleEvents: [],
    }));
  },

  /**
   * Set console visibility
   */
  setShowConsole(show: boolean) {
    agentTestStore.setState((s) => ({
      ...s,
      showConsole: show,
    }));
  },

  /**
   * Toggle console visibility
   */
  toggleConsole() {
    agentTestStore.setState((s) => ({
      ...s,
      showConsole: !s.showConsole,
    }));
  },

  // =========================================================================
  // TEST VARIABLES ACTIONS
  // =========================================================================

  /**
   * Set a single test variable
   */
  setTestVariable(key: string, value: unknown) {
    agentTestStore.setState((s) => ({
      ...s,
      testVariables: { ...s.testVariables, [key]: value },
    }));
  },

  /**
   * Set all test variables at once
   */
  setTestVariables(variables: Record<string, unknown>) {
    agentTestStore.setState((s) => ({
      ...s,
      testVariables: variables,
    }));
  },

  /**
   * Clear all test variables
   */
  clearTestVariables() {
    agentTestStore.setState((s) => ({
      ...s,
      testVariables: {},
    }));
  },
};
