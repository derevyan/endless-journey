/**
 * Conversation History Service
 *
 * Centralized service for building and managing conversation history from session events.
 * This is a lightweight, database-free interface that handles in-memory operations only.
 *
 * For persistence operations (database access), use AgentConversationStore from engine-integrations.
 * For strategy-based filtering (truncation, summarization), delegate to LLM package utilities.
 *
 * Architecture:
 * - This service lives in packages/engine (owns session state)
 * - Database persistence in packages/engine-integrations (has DB access)
 * - Filtering strategies in packages/llm (AI-specific algorithms)
 *
 * No circular dependencies: engine ← integrations → llm
 */

import type { ConversationMessage, InteractionEvent } from "@journey/schemas";
import { createLogger } from "@journey/logger";

const log = createLogger("engine:conversation-history");

/**
 * Conversation History Service Interface
 *
 * Provides utilities for building and managing conversation history from session events.
 * All methods are synchronous and work with in-memory data - no database calls.
 */
export interface ConversationHistoryService {
  /**
   * Build conversation history from session events
   *
   * Extracts user.message and engine.message events from the session history
   * and converts them to ConversationMessage format.
   *
   * This is the fast path when session history is cached in Redis.
   * When cache expires, use database recovery instead (see state-persistence.ts).
   *
   * @param events - Array of session interaction events
   * @returns Conversation messages in chronological order
   *
   * @example
   * ```typescript
   * const messages = conversationHistory.buildFromEvents(session.history);
   * // Returns:
   * // [
   * //   { role: "user", content: "Hello", timestamp: ... },
   * //   { role: "assistant", content: "Hi there!", timestamp: ... },
   * // ]
   * ```
   */
  buildFromEvents(events: InteractionEvent[]): ConversationMessage[];

  /**
   * Get the most recent user message from conversation history
   *
   * Searches backward through the history to find the last user message.
   * Useful for checking what the user last said.
   *
   * @param history - Conversation message history
   * @returns Content of the last user message, or empty string if no user messages
   */
  getLastUserMessage(history: ConversationMessage[]): string;

  /**
   * Check if the last message in history is from a user
   *
   * Useful for determining if we're waiting for a user response
   * or if there are pending messages to process.
   *
   * @param history - Conversation message history
   * @returns true if the last message is from user, false otherwise
   */
  hasRecentUserMessage(history: ConversationMessage[]): boolean;
}

/**
 * Create conversation history service
 *
 * Returns a service instance with methods for managing conversation history.
 * This is a stateless service - all data is passed as parameters.
 */
export function createConversationHistoryService(): ConversationHistoryService {
  return {
    buildFromEvents(events: InteractionEvent[]): ConversationMessage[] {
      const history: ConversationMessage[] = [];

      for (const event of events) {
        // Extract user messages
        if (event.type === "user.message" && event.payload) {
          const payload = event.payload as Record<string, unknown>;
          if (payload.text) {
            history.push({
              role: "user",
              content: payload.text as string,
              timestamp: new Date(event.timestamp),
              // Preserve input type (voice transcribed vs typed text)
              inputType: payload.inputType as "text" | "voice" | undefined,
            });
          }
        }
        // Extract assistant messages (engine responses)
        else if (event.type === "engine.message" && event.payload) {
          const payload = event.payload as Record<string, unknown>;
          const content = (payload.content ?? payload.text) as string | undefined;
          if (content) {
            history.push({
              role: "assistant",
              content,
              timestamp: new Date(event.timestamp),
            });
          }
        }
        // Include button clicks as user messages (for AI quick-reply context)
        // Uses buttonLabel to show what user selected, not the internal button ID
        else if (event.type === "user.click" && event.payload) {
          const payload = event.payload as Record<string, unknown>;
          const buttonLabel = payload.buttonLabel as string | undefined;
          // Only include if we have a real label (not just button ID like "ai-reply-0")
          if (buttonLabel && !buttonLabel.startsWith("ai-reply-")) {
            history.push({
              role: "user",
              content: buttonLabel,
              timestamp: new Date(event.timestamp),
            });
          }
        }
        // Note: Other event types (user.timeout, etc.) are ignored
      }

      log.debug(
        { messageCount: history.length, eventCount: events.length },
        "conversation:buildFromEvents"
      );

      return history;
    },

    getLastUserMessage(history: ConversationMessage[]): string {
      // Search backward for the most recent user message
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === "user") {
          return history[i].content;
        }
      }
      return "";
    },

    hasRecentUserMessage(history: ConversationMessage[]): boolean {
      return history.length > 0 && history[history.length - 1]?.role === "user";
    },
  };
}
